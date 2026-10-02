// The single brain of the live lesson (frames 18–23). A faithful port of
// app/lib/features/lesson/agent/lesson_agent.dart — same rules, same test cases
// (agent.test.ts mirrors app/test/lesson/lesson_agent_test.dart one-to-one).
//
// Runs a LessonScript as a state machine. Screens only render `state` and forward
// taps as commands; they never play audio or advance steps. Framework-free: no
// React, DOM or Firebase here — those are injected through ports.
//
// Rules enforced here:
// * the recitation starts by itself when an ayah appears; the teacher is silenced
//   while the reciter plays;
// * the mic never listens during recitation or teacher speech (+ an echo guard),
//   so neither is ever counted as the child;
// * muting the mic pauses counting, not the lesson;
// * backgrounding pauses everything; returning resumes the same moment;
// * autoplay blocked → state.playbackBlocked (small fallback play);
// * silence → nudge; after `maxNudges` nudges the ayah is replayed once, then the
//   agent waits.
// v0.2 (ai/CONTRACT.md §8 PROPOSAL, review notes C8–C12):
// * three memorization stages (stages.ts): 1× per ayah, 5× per ayah, whole surah ×2;
// * nothing waits for a tap: lines finish, then ~2 s, then the next step; the mic
//   opens by itself; the project report stops by itself after the child stops talking;
// * `mannersRedirect` pauses counting for one redirect line, counts kept.
import {
  MicPermissionDenied,
  type AiTeacher,
  type AnswerIntent,
  type ListenMode,
  type TeacherAction,
} from './aiTeacher';
import type { HadithRepository } from './hadith';
import { Observable } from './observable';
import {
  PlaybackBlocked,
  RecitationNotAvailable,
  type LessonProgressSink,
  type ProjectRecorder,
  type RecitationAudio,
  type RecitationPlayer,
  type RecordedAudio,
} from './ports';
import type { ProjectContent, ProjectRepository } from './projects';
import { quranRef, refKey, sameRef, type QuranMeta, type QuranRef, type QuranText } from './quran';
import { quranRefsOf, validateLessonScript, type LessonScript, type LessonStep } from './script';
import { expandLesson, FULL_PASS_PAUSE_MS, FULL_PASS_VOICED_SHARE, stageOfStep } from './stages';
import {
  initialLessonState,
  newLessonProgress,
  type LessonBeat,
  type LessonProgress,
  type LessonState,
} from './state';
import { line, TeacherLineBank, type TeacherLine } from './teacherLines';
import { toArabicDigits } from '../lib/arabicDigits';

/** Verified content the agent reads from (all local). */
export interface LessonContent {
  readonly meta: QuranMeta;
  readonly text: QuranText;
  readonly audio: {
    prefetch(refs: Iterable<QuranRef>): Promise<void>;
    resolve(ref: QuranRef): Promise<RecitationAudio>;
    /** Reciter duration of a bundled ayah (manifest) — for full-surah passes. */
    durationMsOf?(ref: QuranRef): number | undefined;
  };
  readonly hadith: HadithRepository;
  readonly projects: ProjectRepository;
}

export interface LessonTimings {
  /** Silence while the mic is open before a nudge («باقي مرة، هيا…»). */
  readonly silenceMs: number;
  /** Mic stays deaf this long after the teacher/reciter stops (room echo). */
  readonly echoGuardMs: number;
  /** Nudges before the ayah is replayed once; after that the agent just waits. */
  readonly maxNudges: number;
  /** Frame 22: «حُفظ صوتك» → moves on unless the child re-records. */
  readonly recordedAutoAdvanceMs: number;
  readonly maxRecordingMs: number;
  /** v0.2: a line finishes, then this pause, then the next step (no taps). */
  readonly advanceDelayMs: number;
  /** v0.2: silence after enough voiced time that completes a full-surah pass. */
  readonly fullPassPauseMs: number;
  /** v0.2 frame 22: the report stops by itself after this much silence following speech… */
  readonly reportSilenceMs: number;
  /** …but never before this much recording. */
  readonly reportMinMs: number;
  /**
   * A pure voice call (the web): no «ردّدت» — after a silence one nudge, after a
   * second silence the step completes by itself; a blocked mic → the «سماح» prompt,
   * then listen-only (each step continues by itself). The child is never stuck.
   */
  readonly voiceOnly: boolean;
}

/** Recorder level (0..1) that counts as the child talking during the report. */
const REPORT_VOICE_LEVEL = 0.15;
/** Assumed reciter duration of an ayah with no manifest entry. */
const DEFAULT_AYAH_MS = 2500;

export const defaultLessonTimings: LessonTimings = {
  silenceMs: 7000,
  echoGuardMs: 300,
  maxNudges: 2,
  recordedAutoAdvanceMs: 3200,
  maxRecordingMs: 3 * 60_000,
  advanceDelayMs: 2000,
  fullPassPauseMs: FULL_PASS_PAUSE_MS,
  reportSilenceMs: 3000,
  reportMinMs: 1500,
  voiceOnly: false,
};

/** Voice-only: the «سماح» prompt waits this long, then listen-only. */
const MIC_PROMPT_MS = 20_000;
/** Voice-only listen-only mode: the pause after a line before the step continues. */
const LISTEN_ONLY_PAUSE_MS = 1500;

export interface LessonAgentOptions {
  script: LessonScript;
  content: LessonContent;
  teacher: AiTeacher;
  player: RecitationPlayer;
  recorder: ProjectRecorder;
  sink: LessonProgressSink;
  childFirstName: string;
  timings?: Partial<LessonTimings>;
  lineBank?: TeacherLineBank;
  now?: () => Date;
  /**
   * Debug builds only: tapping the teacher counts a repeat (to walk the flow in a
   * browser without a working mic — the design prototype's tap). The caller passes
   * `import.meta.env.DEV && …`; this module never reads build flags itself.
   */
  debugTapCountsRepeat?: boolean;
  /** Where non-fatal problems are reported (Dart's debugPrint). */
  log?: (message: string, error?: unknown) => void;
}

type Timer = ReturnType<typeof setTimeout>;
type Interval = ReturnType<typeof setInterval>;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Applies only the defined fields (Dart copyWith: null/undefined keeps the value). */
function copy(s: LessonState, p: Partial<LessonState>): LessonState {
  const out: Record<string, unknown> = { ...s };
  for (const [k, v] of Object.entries(p)) if (v !== undefined) out[k] = v;
  return out as unknown as LessonState;
}

export class LessonAgent {
  readonly script: LessonScript;
  readonly content: LessonContent;
  readonly teacher: AiTeacher;
  readonly player: RecitationPlayer;
  readonly recorder: ProjectRecorder;
  readonly sink: LessonProgressSink;
  readonly childFirstName: string;
  readonly timings: LessonTimings;
  readonly lineBank: TeacherLineBank;
  private readonly now: () => Date;
  private readonly debugTapCountsRepeat: boolean;
  private readonly log: (message: string, error?: unknown) => void;

  readonly state = new Observable<LessonState>(initialLessonState);
  /** Child's live voice level (0..1) for the voice bars — never stored. */
  readonly level = new Observable<number>(0);

  private _progress: LessonProgress;
  get progress(): LessonProgress {
    return this._progress;
  }

  // Every beat change bumps the generation; stale async work checks it and stops.
  private gen = 0;
  private resumeFn: (() => void) | undefined;
  private skipFn: (() => void) | undefined;
  private beatTimer: Timer | undefined;
  private clock: Interval | undefined;
  private recClock: Interval | undefined;
  private userPaused = false;
  private background = false;
  private pauseApplied = false;
  private listening = false;
  private disposed = false;
  private readonly unsubs: (() => void)[] = [];

  // Per-step
  private nudges = 0;
  private autoReplayed = false;
  /** Voice-only: silences at the go-ahead, mic refusals, listen-only mode. */
  private goAheadSilences = 0;
  private micDenials = 0;
  private listenOnly = false;
  private recorded: RecordedAudio | undefined;
  private saving = false;
  // Stage 3 (full passes): voiced time so far in this pass, and the pause timer.
  private passVoicedMs = 0;
  private passTimer: Timer | undefined;
  // Frame 22: has the child spoken yet, and when last.
  private recVoiced = false;
  private recLastVoiceAt = 0;
  private readonly isReview: boolean;

  constructor(o: LessonAgentOptions) {
    // v0.1 scripts become the three stages (idempotent for v0.2 scripts).
    this.script = expandLesson(o.script);
    this.isReview = this.script.steps[0]?.type === 'review_intro';
    this.content = o.content;
    this.teacher = o.teacher;
    this.player = o.player;
    this.recorder = o.recorder;
    this.sink = o.sink;
    this.childFirstName = o.childFirstName;
    this.timings = { ...defaultLessonTimings, ...o.timings };
    this.lineBank = o.lineBank ?? new TeacherLineBank();
    this.now = o.now ?? (() => new Date());
    this.debugTapCountsRepeat = o.debugTapCountsRepeat ?? false;
    this.log = o.log ?? ((m, e) => console.warn(m, e));
    this._progress = newLessonProgress(o.script.lessonId);
  }

  private get s(): LessonState {
    return this.state.value;
  }

  private set(s: LessonState): void {
    if (!this.disposed) this.state.value = s;
  }

  private setLevel(v: number): void {
    if (!this.disposed) this.level.value = v;
  }

  private get paused(): boolean {
    return this.userPaused || this.background;
  }

  private get step(): LessonStep {
    return this.script.steps[this.s.stepIndex]!;
  }

  /** Fire-and-forget (Dart's unawaited): errors are logged, never unhandled. */
  private fire(p: Promise<unknown>): void {
    p.catch((e: unknown) => this.log('Lesson background task failed', e));
  }

  // ═══ Lifecycle ═════════════════════════════════════════════════════════════

  /** Starts at `from`'s step (resume from a checkpoint) or at the beginning. */
  async start(from?: LessonProgress): Promise<void> {
    if (from && from.lessonId === this.script.lessonId && !from.completed) this._progress = from;
    try {
      validateLessonScript(this.script, this.content.meta);
      // The surah card shows every ayah: all must be in the verified text (throws otherwise).
      for (const st of this.script.steps) {
        if (st.type === 'stage_intro' || st.type === 'listen_surah' || st.type === 'full_surah') {
          this.surahAyatOf(st.surah);
        }
      }
      const refs = quranRefsOf(this.script);
      for (const st of this.script.steps) {
        if (st.type !== 'listen_surah') continue;
        for (let a = 1; a <= this.content.meta.ayahCount(st.surah); a++) refs.push(quranRef(st.surah, a));
      }
      await this.content.audio.prefetch(refs);
    } catch (e) {
      this.log('Lesson content not available', e);
      this.set(copy(this.s, { screen: 'failed', contentUnavailable: true }));
      return;
    }
    this.unsubs.push(
      this.teacher.actions((a) => this.onAction(a)),
      this.teacher.inputLevel((v) => {
        if (this.listening) this.setLevel(v);
      }),
      this.recorder.level((v) => {
        if (this.s.beat !== 'recording') return;
        this.setLevel(v);
        if (v >= REPORT_VOICE_LEVEL) {
          this.recVoiced = true;
          this.recLastVoiceAt = Date.now();
        }
      }),
      this.player.completed(() => this.onRecitationComplete()),
    );
    this.teacher.onEvent({
      type: 'lessonStarted',
      lessonId: this.script.lessonId,
      childFirstName: this.childFirstName,
    });
    this.startClock();
    this.enterStep(Math.min(Math.max(this._progress.stepIndex, 0), this.script.steps.length - 1));
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.gen++;
    this.cancelTimers();
    clearInterval(this.clock);
    for (const u of this.unsubs) u();
    this.disposed = true;
    await Promise.all([
      this.player.stop(),
      this.teacher.stopSpeaking(),
      ...(this.listening ? [this.teacher.stopListening()] : []),
      ...(this.recorded ? [this.recorder.discard(this.recorded)] : []),
    ]);
    this.state.dispose();
    this.level.dispose();
  }

  /** The page went to the background / came back (visibilitychange). */
  setForeground(foreground: boolean): void {
    this.background = !foreground;
    if (foreground) this.maybeResume();
    else this.applyPause();
  }

  // ═══ Commands (from the UI) ════════════════════════════════════════════════

  /**
   * Plays the current ayah's recitation — also the fallback play control when
   * autoplay was blocked. With `ref`, jumps to that ayah's step first.
   */
  play(ref?: QuranRef): void {
    if (this.paused) return;
    if (ref && !sameRef(ref, this.s.ayahRef ?? undefined)) {
      const i = this.script.steps.findIndex((s) => s.type === 'ayah_loop' && sameRef(s.ref, ref));
      if (i >= 0) this.enterStep(i);
      return;
    }
    if (this.s.screen === 'ayah' || (this.s.screen === 'hadith' && this.s.hadith?.canPlay === true)) {
      void this.startRecitation();
    }
  }

  pause(): void {
    this.userPaused = true;
    this.applyPause();
  }

  resume(): void {
    this.userPaused = false;
    this.maybeResume();
  }

  /** Stops the reciter; the child can repeat straight away (stage 1 listening: the next ayah). */
  stop(): void {
    if (this.s.beat === 'reciting') {
      this.fire(this.player.stop());
      if (this.step.type === 'listen_surah') this.nextListenAyah();
      else this.promptRepeat();
    }
  }

  /** Card tap (frames 18/20): hear the ayah again; repeats already counted stay. */
  replayAyah(): void {
    const allowed: LessonBeat[] = ['reciting', 'awaitMic', 'listening', 'counted', 'nudging'];
    if (this.paused || !allowed.includes(this.s.beat)) return;
    this.play();
  }

  nextAyah(): void {
    this.jumpAyah(1);
  }

  previousAyah(): void {
    this.jumpAyah(-1);
  }

  async setVolume(volume: number): Promise<void> {
    const v = Math.min(1, Math.max(0, volume));
    await Promise.all([this.player.setVolume(v), this.teacher.setVolume(v)]);
  }

  /**
   * v0.2: the mic opens by itself (D2) — this only retries after it couldn't
   * (permission refused → `awaitMic` + `micDenied`), or ends a recording early.
   */
  micTap(): void {
    if (this.paused) return;
    switch (this.s.beat) {
      case 'awaitMic':
        this.teacher.onEvent({ type: 'micOpened' });
        if (this.s.screen === 'projectReport') void this.startRecording();
        else if (this.s.screen === 'surahDone') this.enterGoAhead();
        else this.enterListening();
        break;
      case 'recording':
        void this.stopRecording();
        break;
      default:
        break;
    }
  }

  /** Tap on the teacher: skip the current line / recitation (as in the design). */
  tapTeacher(): void {
    if (this.paused) return;
    const beat = this.s.beat;
    if (beat === 'reciting') this.stop();
    else if (beat === 'hearingAnswer') this.onGoAhead();
    else if ((beat === 'listening' || beat === 'nudging') && this.debugTapCountsRepeat) {
      // Debug builds: a tap stands for one repeat (stage 3: one whole pass).
      if (this.step.type === 'full_surah') this.completePass();
      else this.countRepeat();
    } else if (beat === 'recorded') this.continueTapped();
    else this.skipFn?.();
  }

  /**
   * «ردّدت» — offered only when the mic can't hear the child (permission refused) or
   * after a silence nudge. One tap = one repeat (stage 1/3: one whole pass; before the
   * hadith: the go-ahead; the report with the mic blocked: told without a recording).
   * Presence is never graded, so a tap is as good as a detected repeat — nothing on
   * the lesson path depends on the mic or the AI server.
   */
  repeatTapped(): void {
    if (this.paused || !this.s.manualRepeat) return;
    const beat = this.s.beat;
    if (this.s.screen === 'projectReport') {
      if (beat === 'awaitMic') this.reportWithoutRecording();
      return;
    }
    if (this.s.screen === 'surahDone') {
      if (beat === 'hearingAnswer' || beat === 'nudging' || beat === 'awaitMic') {
        this.set(copy(this.s, { beat: 'hearingAnswer' }));
        this.onGoAhead();
      }
      return;
    }
    if (beat !== 'listening' && beat !== 'nudging' && beat !== 'awaitMic') return;
    if (this.step.type === 'full_surah') this.completePass();
    else this.countRepeat();
  }

  /** v0.1 short answers — v0.2 never asks a question, so there is nothing to answer. */
  tapFallback(_answer: AnswerIntent): void {}

  /** Retry a report / the final save that couldn't be saved, or skip a handoff line. */
  continueTapped(): void {
    if (this.paused) return;
    switch (this.s.beat) {
      case 'saveFailed':
        void this.finishLesson();
        break;
      case 'recorded':
        void this.saveReport();
        break;
      case 'advancing':
        this.skipFn?.();
        break;
      default:
        break;
    }
  }

  /** Frame 22 «أعِد التسجيل». */
  reRecord(): void {
    if (this.paused || this.s.beat !== 'recorded' || this.saving) return;
    const old = this.recorded;
    this.recorded = undefined;
    if (old) this.fire(this.recorder.discard(old));
    void this.startRecording();
  }

  /** «إنهاء المكالمة» — saves a checkpoint so «أكمل الحصة» resumes here. */
  async endCall(): Promise<void> {
    if (this.s.screen === 'ended') return;
    const finished = this._progress.completed;
    this.gen++;
    this.cancelTimers();
    clearInterval(this.clock);
    await this.stopListening();
    await Promise.all([this.player.stop(), this.teacher.stopSpeaking()]);
    const live = this.s.beat === 'recording' ? await this.recorder.stop() : null;
    if (live) await this.recorder.discard(live);
    const rec = this.recorded;
    this.recorded = undefined;
    if (rec) await this.recorder.discard(rec);
    this.set(copy(this.s, { screen: 'ended', endedByUser: !finished, teacherSpeaking: false }));
    if (!finished) await this.checkpoint({ ...this._progress, stepIndex: this.s.stepIndex });
  }

  // ═══ Steps ═════════════════════════════════════════════════════════════════

  private enterStep(i: number): void {
    if (i >= this.script.steps.length) return;
    this.nudges = 0;
    this.autoReplayed = false;
    this.passVoicedMs = 0;
    clearTimeout(this.passTimer);
    this._progress = { ...this._progress, stepIndex: i };
    const step = this.script.steps[i]!;
    this.set(
      copy(this.s, {
        manualRepeat: false,
        stepIndex: i,
        lineIndex: 0,
        happy: false,
        repeatsDone: 0,
        playbackBlocked: false,
        contentUnavailable: false,
        stage: stageOfStep(step),
        stageTransition: false,
      }),
    );
    this.teacher.onEvent({ type: 'stepShown', stepIndex: i });
    // A checkpoint after every step — and so at every stage end (the next stage_intro).
    if (step.type !== 'lesson_end') this.fire(this.checkpoint(this._progress));
    switch (step.type) {
      case 'intro':
        this.set(
          copy(this.s, {
            screen: 'intro',
            surahName: this.content.meta.surahName(step.surah),
            surahAyahCount: this.content.meta.ayahCount(step.surah),
          }),
        );
        this.sayLines(step.lines, { onDone: () => this.advanceAfterPause() });
        break;
      case 'review_intro':
        this.set(copy(this.s, { screen: 'reviewIntro' }));
        this.sayLines(step.lines, { onDone: () => this.advanceAfterPause() });
        break;
      case 'stage_intro':
        this.showSurah(step.surah, { stageTransition: true, ayahRef: null });
        this.say(this.isReview ? this.line('review.surah') : line(`stage.${step.stage}`), {
          beat: 'speaking',
          then: () => this.advanceAfterPause(),
        });
        break;
      case 'ayah_loop': {
        const r = step.ref;
        this.showSurah(r.surah, { ayahRef: r });
        const surah = this.content.meta.surahName(r.surah);
        this.set(
          copy(this.s, {
            screen: 'ayah',
            ayahRef: r,
            ayahText: this.content.text.text(r),
            ayahReference: `سورة ${surah} · الآية ${toArabicDigits(r.ayah)}`,
            repeatsTarget: step.repeats,
          }),
        );
        void this.startRecitation();
        break;
      }
      case 'listen_surah':
        // Stage 1: the reciter plays the whole surah, ayah by ayah; the highlight follows it.
        this.showSurah(step.surah, { ayahRef: quranRef(step.surah, 1) });
        this.playListenAyah(quranRef(step.surah, 1));
        break;
      case 'full_surah':
        this.showSurah(step.surah, { ayahRef: null });
        this.set(copy(this.s, { passesDone: 0, passesTarget: step.passes, repeatsTarget: step.passes }));
        this.say(
          step.stage === 1
            ? line('stage1.your_turn')
            : this.line('full.start', { ordinalTime: TeacherLineBank.ordinalTime(1) }),
          { beat: 'speaking', then: () => this.enterListening() },
        );
        break;
      case 'surah_done':
        this.set(copy(this.s, { screen: 'surahDone', stageTransition: false }));
        // The hadith starts only after the child's go-ahead (voice; a tap on the teacher also works).
        this.sayLines([...step.lines, step.question], {
          happyLines: true,
          onDone: () => this.enterGoAhead(),
        });
        break;
      case 'hadith_loop': {
        const h = this.content.hadith.byId(step.hadithId);
        this.set(copy(this.s, { screen: 'hadith', hadith: h, repeatsTarget: step.repeats }));
        this.say(this.line('hadith.today'), {
          beat: 'speaking',
          then: h.canPlay
            ? () => void this.startRecitation()
            : // Unapproved: the topic only — nothing recited, attributed or explained (D5).
              () =>
                this.say(line('hadith.soon'), {
                  beat: 'speaking',
                  lineIndex: 1,
                  then: () => this.advanceAfterPause(),
                }),
        });
        break;
      }
      case 'project_assign': {
        const project = this.content.projects.byId(step.projectId);
        this.set(copy(this.s, { screen: 'projectAssign', project }));
        this._progress = { ...this._progress, projectAssigned: step.projectId };
        // «مشروعك اليوم: …», then the three steps one by one (lineIndex reveals them), then on (C12).
        const hints = project.hints.map((hint) => line('project.hint', { hint }));
        const say = (k: number): void => {
          if (k > hints.length) {
            this.advanceAfterPause();
            return;
          }
          this.say(k === 0 ? this.line('project.today') : hints[k - 1]!, {
            beat: 'speaking',
            lineIndex: k,
            then: () => say(k + 1),
          });
        };
        say(0);
        break;
      }
      case 'project_report':
        this.set(
          copy(this.s, {
            screen: 'projectReport',
            project: this.content.projects.byId(step.projectId),
            recordingElapsedMs: 0,
            recordedDurationMs: null,
            saveFailed: false,
          }),
        );
        this.say(this.line(this.now().getHours() < 12 ? 'report.greet.morning' : 'report.greet.evening'), {
          beat: 'speaking',
          happy: true,
          then: () =>
            this.say(this.line(step.question), {
              beat: 'speaking',
              lineIndex: 1,
              then: () => void this.startRecording(),
            }),
        });
        break;
      case 'lesson_end':
        this._progress = { ...this._progress, completed: true, stepIndex: i };
        void this.finishLesson();
        break;
    }
  }

  private next(): void {
    this.enterStep(this.s.stepIndex + 1);
  }

  // ── Stage 1: the whole surah from the reciter ──

  private playListenAyah(r: QuranRef): void {
    const name = this.content.meta.surahName(r.surah);
    this.set(
      copy(this.s, {
        ayahRef: r,
        ayahText: this.content.text.text(r),
        ayahReference: `سورة ${name} · الآية ${toArabicDigits(r.ayah)}`,
      }),
    );
    void this.startRecitation();
  }

  /** The reciter finished one ayah of the whole-surah listening → the next one, or on to the child's turn. */
  private nextListenAyah(): void {
    const r = this.s.ayahRef!;
    if (r.ayah < this.content.meta.ayahCount(r.surah)) this.playListenAyah(quranRef(r.surah, r.ayah + 1));
    else this.next();
  }

  // ── Before the hadith: the child's go-ahead (voice) ──

  private enterGoAhead(): void {
    this.teacher.onEvent({ type: 'micOpened' });
    const g = this.enter(
      copy(this.s, {
        beat: 'hearingAnswer',
        captionId: 'ui.hearing',
        caption: this.lineBank.resolve(line('ui.hearing')),
        teacherSpeaking: false,
        micDenied: false,
      }),
      { resume: () => this.enterGoAhead(), skip: () => this.onGoAhead(), keepListening: true },
    );
    this.fire(this.teacher.stopSpeaking());
    void this.listen('answer', g).then((ok) => {
      if (!ok || g !== this.gen) return;
      // Silence: a gentle re-ask, then listen again. Voice-only: after a second silence
      // the lesson moves on by itself.
      this.beatTimer = setTimeout(() => {
        if (g === this.gen && !this.paused && this.s.beat === 'hearingAnswer') {
          if (this.timings.voiceOnly && ++this.goAheadSilences >= 2) {
            this.onGoAhead();
            return;
          }
          if (!this.timings.voiceOnly) this.set(copy(this.s, { manualRepeat: true }));
          this.say(line('nudge.answer'), { beat: 'nudging', then: () => this.enterGoAhead() });
        }
      }, this.timings.silenceMs);
    });
  }

  private onGoAhead(): void {
    if (this.s.beat !== 'hearingAnswer') return;
    this.fire(this.stopListening());
    this.say(line('surah.to_hadith'), {
      beat: 'advancing',
      happy: true,
      then: () => this.advanceAfterPause(),
    });
  }

  // ── Frame 23 — only after the final save succeeded ──

  private async finishLesson(): Promise<void> {
    const g = this.enter(
      copy(this.s, {
        beat: 'saving',
        captionId: 'end.saving',
        caption: this.lineBank.resolve(line('end.saving')),
        teacherSpeaking: false,
        saveFailed: false,
      }),
      { resume: () => void this.finishLesson() },
    );
    try {
      await this.sink.completed(this._progress);
    } catch (e) {
      this.log('Lesson completion not saved', e);
      if (g !== this.gen) return;
      // Never show the lesson as finished when the server doesn't have it.
      this.enter(copy(this.s, { beat: 'saveFailed', progressSaveFailed: true }), {
        resume: () => void this.finishLesson(),
      });
      return;
    }
    if (g !== this.gen || this.disposed) return;
    const step = this.step;
    if (step.type !== 'lesson_end') return;
    this.set(copy(this.s, { screen: 'lessonEnd', progressSaveFailed: false }));
    // «أراك غدًا يا {name}» ends the lesson (C12); no question, no tap.
    this.sayLines([...step.lines, 'end.see_you'], {
      happyFirst: true,
      onDone: () => {
        this.enter(copy(this.s, { beat: 'done', happy: true, teacherSpeaking: false }), { resume: () => {} });
        this.stopClock();
      },
    });
  }

  /** v0.2: the line finished — wait ~2 s, then the next step (no tap). Tapping the teacher skips the wait. */
  private advanceAfterPause(then: () => void = () => this.next()): void {
    const g = this.gen;
    this.resumeFn = () => this.advanceAfterPause(then);
    this.skipFn = () => {
      if (g === this.gen) then();
    };
    clearTimeout(this.beatTimer);
    this.beatTimer = setTimeout(() => {
      if (g === this.gen && !this.paused) then();
    }, this.timings.advanceDelayMs);
  }

  /** The whole surah on the card (verified text), current ayah highlighted. */
  private showSurah(surah: number, o: { ayahRef: QuranRef | null; stageTransition?: boolean }): void {
    const name = this.content.meta.surahName(surah);
    this.set(
      copy(this.s, {
        screen: 'ayah',
        surahName: name,
        surahAyahCount: this.content.meta.ayahCount(surah),
        surahAyat:
          this.s.surahName === name && this.s.surahAyat.length ? this.s.surahAyat : this.surahAyatOf(surah),
        stageTransition: o.stageTransition ?? false,
        ...(o.ayahRef === null ? { ayahRef: null, ayahText: null, ayahReference: `سورة ${name}` } : {}),
      }),
    );
  }

  private surahAyatOf(surah: number): { ayah: number; text: string }[] {
    const count = this.content.meta.ayahCount(surah);
    return Array.from({ length: count }, (_, k) => ({
      ayah: k + 1,
      text: this.content.text.text(quranRef(surah, k + 1)),
    }));
  }

  private jumpAyah(dir: 1 | -1): void {
    if (this.paused) return;
    for (let i = this.s.stepIndex + dir; i >= 0 && i < this.script.steps.length; i += dir) {
      if (this.script.steps[i]!.type === 'ayah_loop') {
        this.enterStep(i);
        return;
      }
    }
  }

  // ═══ Recitation → repeats ═════════════════════════════════════════════════

  private async startRecitation(): Promise<void> {
    const isHadith = this.s.screen === 'hadith';
    const captionId = isHadith ? 'ui.listen_hadith' : 'ui.listen_ayah';
    const g = this.enter(
      copy(this.s, {
        beat: 'reciting',
        captionId,
        caption: this.lineBank.resolve(line(captionId)),
        teacherSpeaking: false,
        playbackBlocked: false,
        happy: false,
      }),
      {
        resume: () => {
          if (!this.s.playbackBlocked) this.fire(this.player.resume());
        },
        skip: () => this.stop(),
      },
    );
    await this.teacher.stopSpeaking(); // the teacher is silent while the reciter plays
    // The call may have moved on (ended, disposed, another step) while the teacher stopped.
    if (g !== this.gen || this.disposed) return;
    let audio: RecitationAudio;
    try {
      audio = isHadith
        ? { kind: 'asset', assetPath: this.s.hadith!.audioAsset! }
        : await this.content.audio.resolve(this.s.ayahRef!);
    } catch (e) {
      if (!(e instanceof RecitationNotAvailable)) throw e;
      if (g !== this.gen) return;
      this.set(copy(this.s, { contentUnavailable: true }));
      this.promptRepeat();
      return;
    }
    if (g !== this.gen) return;
    const ref = isHadith ? null : this.s.ayahRef;
    this.teacher.onEvent({ type: 'recitationStarted', ref });
    try {
      await this.player.start(audio);
    } catch (e) {
      if (!(e instanceof PlaybackBlocked)) throw e;
      if (g !== this.gen) return;
      this.teacher.onEvent({ type: 'playbackBlocked', ref });
      this.set(copy(this.s, { playbackBlocked: true }));
      return;
    }
    if (g !== this.gen || this.paused) await this.player.pause();
  }

  private onRecitationComplete(): void {
    if (this.s.beat !== 'reciting' || this.paused) return;
    this.teacher.onEvent({
      type: 'recitationFinished',
      ref: this.s.screen === 'hadith' ? null : this.s.ayahRef,
    });
    if (this.step.type === 'listen_surah') this.nextListenAyah();
    else this.promptRepeat();
  }

  /** «دورك… ردّدها مرة» (stage 1) / «الآن ردّد بصوتك… خمس مرات» — then the mic opens by itself. */
  private promptRepeat(): void {
    const l =
      this.s.stage === 1
        ? line('stage1.your_turn')
        : line('ayah.repeat_now', { times: TeacherLineBank.timesInWords(this.s.repeatsTarget) });
    this.say(l, { beat: 'speaking', then: () => this.enterListening() });
  }

  private enterListening(): void {
    const isHadith = this.s.screen === 'hadith';
    const full = this.step.type === 'full_surah';
    const id =
      this.s.repeatsDone === 0 && !full ? (isHadith ? 'ui.hearing_hadith' : 'ui.hearing_ayah') : 'ui.hearing';
    const g = this.enter(
      copy(this.s, {
        beat: 'listening',
        captionId: id,
        caption: this.lineBank.resolve(line(id)),
        teacherSpeaking: false,
        micDenied: false,
      }),
      { resume: () => this.enterListening(), keepListening: true },
    );
    this.fire(this.teacher.stopSpeaking());
    void this.listen('repeats', g).then((ok) => {
      if (ok && g === this.gen) this.armSilence(g);
    });
  }

  private armSilence(g: number): void {
    clearTimeout(this.beatTimer);
    this.beatTimer = setTimeout(() => {
      if (g === this.gen && !this.paused && this.s.beat === 'listening') this.onSilence();
    }, this.timings.silenceMs);
  }

  private onSilence(): void {
    if (this.timings.voiceOnly) {
      // One gentle nudge; silence again → the step completes by itself (never stuck).
      if (++this.nudges >= 2) {
        this.autoContinue();
        return;
      }
      const id =
        this.step.type === 'full_surah'
          ? 'nudge.full'
          : this.s.repeatsTarget - this.s.repeatsDone === 1
            ? 'nudge.one_left'
            : this.s.repeatsTarget - this.s.repeatsDone === 2
              ? 'nudge.two_left'
              : 'nudge.start';
      this.say(line(id), { beat: 'nudging', then: () => this.enterListening() });
      return;
    }
    // The mic may not be hearing the child — offer «ردّدت» from now on (this step).
    if (!this.s.manualRepeat) this.set(copy(this.s, { manualRepeat: true }));
    if (this.step.type === 'full_surah') {
      // Keep the voiced time of this pass; just encourage.
      this.say(line('nudge.full'), { beat: 'nudging', then: () => this.enterListening() });
      return;
    }
    this.nudges++;
    if (this.nudges > this.timings.maxNudges) {
      const canReplay = this.s.screen === 'ayah' || this.s.hadith?.canPlay === true;
      if (!this.autoReplayed && canReplay) {
        this.autoReplayed = true;
        this.nudges = 0;
        void this.startRecitation();
      }
      // Already replayed once: keep listening quietly.
      return;
    }
    const remaining = this.s.repeatsTarget - this.s.repeatsDone;
    const id = remaining === 1 ? 'nudge.one_left' : remaining === 2 ? 'nudge.two_left' : 'nudge.start';
    this.say(line(id), { beat: 'nudging', then: () => this.enterListening() });
  }

  private countRepeat(): void {
    const n = this.s.repeatsDone + 1;
    this.nudges = 0; // the child is repeating again — nudges start over
    this.set(copy(this.s, { repeatsDone: n }));
    const remaining = this.s.repeatsTarget - n;
    if (remaining <= 0) {
      this.praise();
      return;
    }
    this.say(
      remaining === 1
        ? line('count.one_left')
        : remaining === 2
          ? line('count.two_left')
          : line('count.more', { remaining: toArabicDigits(remaining) }),
      { beat: 'counted', then: () => this.enterListening() },
    );
  }

  // ── Stage 3: whole-surah passes (presence only — D3) ──

  /** One utterance while reciting the whole surah: add its voiced time; enough + a pause = a pass. */
  private onFullUtterance(voicedMs: number): void {
    this.passVoicedMs += voicedMs;
    clearTimeout(this.beatTimer); // not silent — no nudge
    clearTimeout(this.passTimer);
    const step = this.step;
    if (step.type !== 'full_surah') return;
    if (this.passVoicedMs >= this.passNeedMs(step.surah)) {
      const g = this.gen;
      this.passTimer = setTimeout(() => {
        if (g === this.gen && !this.paused && this.s.beat === 'listening') this.completePass();
      }, this.timings.fullPassPauseMs);
    } else {
      this.armSilence(this.gen);
    }
  }

  /** Half the reciter's duration for the whole surah (manifest; a default per ayah otherwise). */
  private passNeedMs(surah: number): number {
    let total = 0;
    for (let a = 1; a <= this.content.meta.ayahCount(surah); a++) {
      total += this.content.audio.durationMsOf?.(quranRef(surah, a)) ?? DEFAULT_AYAH_MS;
    }
    return total * FULL_PASS_VOICED_SHARE;
  }

  private completePass(): void {
    const step = this.step;
    if (step.type !== 'full_surah') return;
    clearTimeout(this.passTimer);
    this.passVoicedMs = 0;
    const done = this.s.passesDone + 1;
    this.set(copy(this.s, { passesDone: done, repeatsDone: done }));
    if (done < step.passes) {
      this.say(this.line('full.again', { ordinalTime: TeacherLineBank.ordinalTime(done + 1) }), {
        beat: 'counted',
        happy: true,
        then: () => this.enterListening(),
      });
      return;
    }
    if (step.stage === 1) {
      // Stage 1 done (one reading after the reciter) — on to «آية آية».
      this.say(line('praise.good'), { beat: 'praising', happy: true, then: () => this.advanceAfterPause() });
      return;
    }
    // Whole surah recited: memorized (every ayah) and complete.
    const refs = this.surahAyatOf(step.surah).map((a) => refKey(quranRef(step.surah, a.ayah)));
    this._progress = {
      ...this._progress,
      doneRefs: new Set([...this._progress.doneRefs, ...refs]),
      surahsCompleted: new Set([...this._progress.surahsCompleted, step.surah]),
    };
    this.say(line('full.done'), { beat: 'praising', happy: true, then: () => this.advanceAfterPause() });
  }

  /** Voice-only: after `ms`, the current step completes by itself (if nothing moved meanwhile). */
  private scheduleAutoContinue(g: number, ms: number): void {
    clearTimeout(this.beatTimer);
    this.beatTimer = setTimeout(() => {
      if (g === this.gen && !this.paused) this.autoContinue();
    }, ms);
  }

  /** Voice-only: the child stayed silent (or can't be heard) — complete the step and go on. */
  private autoContinue(): void {
    clearTimeout(this.beatTimer);
    this.fire(this.stopListening());
    this.nudges = 0;
    if (this.s.screen === 'surahDone') {
      this.set(copy(this.s, { beat: 'hearingAnswer' }));
      this.onGoAhead();
      return;
    }
    if (this.s.screen === 'projectReport') {
      this.reportWithoutRecording();
      return;
    }
    const step = this.step;
    if (step.type === 'full_surah') {
      this.set(copy(this.s, { passesDone: Math.max(this.s.passesDone, step.passes - 1) }));
      this.completePass();
      return;
    }
    this.set(copy(this.s, { repeatsDone: Math.max(this.s.repeatsDone, this.s.repeatsTarget - 1) }));
    this.countRepeat();
  }

  private praise(): void {
    const steps = this.script.steps;
    const i = this.s.stepIndex;
    if (this.s.screen === 'hadith') {
      this._progress = {
        ...this._progress,
        hadithDone: new Set([...this._progress.hadithDone, this.s.hadith!.id]),
      };
      const toProject = i + 1 < steps.length && steps[i + 1]!.type === 'project_assign';
      this.say(this.line('hadith.praise'), {
        beat: 'praising',
        happy: true,
        then: toProject
          ? () =>
              this.say(line('hadith.to_project'), {
                beat: 'advancing',
                happy: true,
                then: () => this.advanceAfterPause(),
              })
          : () => this.advanceAfterPause(),
      });
      return;
    }
    const ref = this.s.ayahRef!;
    if (this.s.stage === 1) {
      // Stage 1: one repeat, a short «أحسنت!», on to the next ayah (or stage).
      this.say(line('praise.good'), { beat: 'praising', happy: true, then: () => this.next() });
      return;
    }
    this._progress = { ...this._progress, doneRefs: new Set([...this._progress.doneRefs, refKey(ref)]) };
    const sameSurahAyah = (k: number): QuranRef | null => {
      const st = steps[k];
      return st?.type === 'ayah_loop' && st.ref.surah === ref.surah ? st.ref : null;
    };
    const nextRef = sameSurahAyah(i + 1);
    if (!nextRef) {
      this.say(line('praise.all_done'), {
        beat: 'praising',
        happy: true,
        then: () => this.advanceAfterPause(),
      });
      return;
    }
    const isLastNext = !sameSurahAyah(i + 2);
    const firstOfRun = !(i > 0 && sameSurahAyah(i - 1));
    const id = isLastNext ? 'praise.last_left' : firstOfRun ? 'praise.first' : 'praise.next';
    this.say(this.line(id, { ordinal: TeacherLineBank.ordinal(nextRef.ayah) }), {
      beat: 'praising',
      happy: true,
      then: () => this.next(),
    });
  }

  // ═══ Lines (v0.2: nothing waits for an answer) ═══════════════════════════════

  /** Says `lines` in order, then `onDone`. */
  private sayLines(
    lines: readonly string[],
    o: { onDone?: () => void; happyLines?: boolean; happyFirst?: boolean },
    from = 0,
  ): void {
    if (from >= lines.length) {
      o.onDone?.();
      return;
    }
    const id = lines[from]!;
    this.say(this.line(id), {
      beat: 'speaking',
      lineIndex: from,
      happy: (o.happyLines ?? false) || ((o.happyFirst ?? false) && from === 0),
      then: () => this.sayLines(lines, o, from + 1),
    });
  }

  /** v0.2 §8.4: one redirect line, nothing counted; the same moment resumes (counts kept). */
  private mannersRedirect(): void {
    clearTimeout(this.passTimer);
    this.say(this.line('manners.redirect'), { beat: 'speaking', then: () => this.enterListening() });
  }

  // ═══ Project report (frame 22) ════════════════════════════════════════════

  private async startRecording(): Promise<void> {
    const g = this.enter(
      copy(this.s, {
        beat: 'recording',
        captionId: 'ui.hearing_report',
        caption: this.lineBank.resolve(line('ui.hearing_report')),
        teacherSpeaking: false,
        recordingElapsedMs: 0,
        recordedDurationMs: null,
        micDenied: false,
        saveFailed: false,
      }),
      {
        resume: () => {
          this.fire(this.recorder.resume());
          this.startRecClock();
        },
      },
    );
    this.recVoiced = false;
    this.recLastVoiceAt = 0;
    await this.teacher.stopSpeaking();
    try {
      await this.recorder.start();
    } catch (e) {
      if (!(e instanceof MicPermissionDenied)) throw e;
      if (g !== this.gen) return;
      this.enter(copy(this.s, { beat: 'awaitMic', micDenied: true, manualRepeat: true }), {
        resume: () => {},
      });
      return;
    }
    if (g !== this.gen) return;
    if (this.paused) {
      await this.recorder.pause();
      return;
    }
    this.startRecClock();
    this.beatTimer = setTimeout(() => {
      if (g === this.gen && this.s.beat === 'recording') void this.stopRecording();
    }, this.timings.maxRecordingMs);
  }

  private startRecClock(): void {
    clearInterval(this.recClock);
    this.recClock = setInterval(() => {
      if (this.s.beat === 'recording' && !this.paused) {
        this.set(copy(this.s, { recordingElapsedMs: this.s.recordingElapsedMs + 1000 }));
        // v0.2: the child spoke, then went quiet → the report is done (no tap).
        if (
          this.recVoiced &&
          this.s.recordingElapsedMs >= this.timings.reportMinMs &&
          Date.now() - this.recLastVoiceAt >= this.timings.reportSilenceMs
        ) {
          void this.stopRecording();
        }
      }
    }, 1000);
  }

  private async stopRecording(): Promise<void> {
    clearInterval(this.recClock);
    const g = ++this.gen;
    clearTimeout(this.beatTimer);
    const rec = await this.recorder.stop();
    if (g !== this.gen) {
      if (rec) await this.recorder.discard(rec);
      return;
    }
    this.setLevel(0);
    if (!rec) {
      // Nothing usable — ask again, and listen again by itself.
      this.say(this.line((this.step as { question: string }).question), {
        beat: 'speaking',
        then: () => void this.startRecording(),
      });
      return;
    }
    this.recorded = rec;
    this.set(copy(this.s, { recordedDurationMs: rec.durationMs }));
    this.say(this.line('report.thanks'), {
      beat: 'recorded',
      happy: true,
      then: () => this.armAutoAdvance(),
    });
  }

  private armAutoAdvance(): void {
    const g = this.gen;
    this.resumeFn = () => this.armAutoAdvance();
    clearTimeout(this.beatTimer);
    this.beatTimer = setTimeout(() => {
      if (g === this.gen && !this.paused && this.s.beat === 'recorded') void this.saveReport();
    }, this.timings.recordedAutoAdvanceMs);
  }

  private async saveReport(): Promise<void> {
    const rec = this.recorded;
    const step = this.step;
    if (!rec || this.saving || step.type !== 'project_report') return;
    this.saving = true;
    this.set(copy(this.s, { saveFailed: false }));
    const i = this.s.stepIndex;
    const toHadith = i + 1 < this.script.steps.length && this.script.steps[i + 1]!.type === 'hadith_loop';
    let saidDone!: () => void;
    const said = new Promise<void>((r) => (saidDone = r));
    if (toHadith) {
      this.say(line('report.to_hadith'), { beat: 'advancing', happy: true, then: saidDone });
    } else {
      this.enter(copy(this.s, { beat: 'advancing' }), { resume: () => {} });
      saidDone();
    }
    const g = this.gen;
    try {
      await this.sink.saveReport(step.projectId, rec);
    } catch (e) {
      this.saving = false;
      this.log('Project report not saved', e);
      // TODO(design): no designed "couldn't save" state — the recorded state
      // stays with a retry (continueTapped) and the recording is kept.
      this.enter(copy(this.s, { beat: 'recorded', saveFailed: true, happy: false }), { resume: () => {} });
      return;
    }
    this.saving = false;
    this.recorded = undefined;
    this.fire(this.recorder.discard(rec)); // the local copy isn't needed any more
    this._progress = { ...this._progress, reportedProject: step.projectId };
    if (g === this.gen) await Promise.race([said, delay(15_000)]);
    if (this.s.screen === 'projectReport' && !this.disposed) this.next();
  }

  /**
   * The report with the mic blocked: the child told the teacher, nothing is recorded or
   * uploaded (the parent gets no recording for this day). The step counts as reported so
   * tomorrow doesn't ask again; the lesson moves on as after a saved report.
   */
  private reportWithoutRecording(): void {
    const step = this.step;
    if (step.type !== 'project_report' || this.saving) return;
    this._progress = { ...this._progress, reportedProject: step.projectId };
    const i = this.s.stepIndex;
    const toHadith = i + 1 < this.script.steps.length && this.script.steps[i + 1]!.type === 'hadith_loop';
    this.say(this.line('report.thanks'), {
      beat: 'praising',
      happy: true,
      then: () =>
        toHadith
          ? this.say(line('report.to_hadith'), { beat: 'advancing', happy: true, then: () => this.next() })
          : this.next(),
    });
  }

  // ═══ Beat plumbing ════════════════════════════════════════════════════════

  /**
   * Enters a beat: bumps the generation (stale work stops), cancels timers,
   * closes the listening gate unless `keepListening`.
   */
  private enter(
    s: LessonState,
    o: { resume: () => void; skip?: () => void; keepListening?: boolean },
  ): number {
    const g = ++this.gen;
    clearTimeout(this.beatTimer);
    clearTimeout(this.passTimer);
    this.resumeFn = o.resume;
    this.skipFn = o.skip;
    if (!o.keepListening) this.fire(this.stopListening());
    this.set(s);
    return g;
  }

  /**
   * Teacher says `l`; the mic is deaf meanwhile. `then` runs after the line (or
   * immediately when the child taps the teacher to skip it).
   */
  private say(
    l: TeacherLine,
    o: { beat: LessonBeat; happy?: boolean; lineIndex?: number; then?: () => void },
  ): void {
    const text = this.lineBank.resolve(l);
    let g = 0;
    const done = () => {
      if (g !== this.gen) return;
      this.set(copy(this.s, { teacherSpeaking: false }));
      o.then?.();
    };
    g = this.enter(
      copy(this.s, {
        beat: o.beat,
        captionId: l.id,
        caption: text,
        teacherSpeaking: true,
        happy: o.happy ?? false,
        lineIndex: o.lineIndex,
      }),
      {
        resume: () => this.say(l, o),
        skip: () => {
          if (g !== this.gen) return;
          this.fire(this.teacher.stopSpeaking());
          done();
        },
      },
    );
    if (this.paused) return;
    void (async () => {
      try {
        await this.teacher.speak(l, text);
      } catch (e) {
        this.log('Teacher line not spoken', e); // caption still shows it
      }
      if (g !== this.gen || this.paused) return;
      // Echo guard before anything that listens.
      await delay(this.timings.echoGuardMs);
      done();
    })();
  }

  private async listen(mode: ListenMode, g: number): Promise<boolean> {
    await delay(this.timings.echoGuardMs);
    if (g !== this.gen || this.paused) return false;
    if (this.listenOnly) {
      this.scheduleAutoContinue(g, LISTEN_ONLY_PAUSE_MS);
      return false;
    }
    try {
      await this.teacher.listen(mode);
    } catch (e) {
      if (!(e instanceof MicPermissionDenied)) throw e;
      if (g !== this.gen) return false;
      if (this.timings.voiceOnly && ++this.micDenials >= 2) {
        // Still blocked after «سماح»: listen-only — each step continues by itself.
        this.listenOnly = true;
        this.scheduleAutoContinue(g, LISTEN_ONLY_PAUSE_MS);
        return false;
      }
      const prompt = this.enter(copy(this.s, { beat: 'awaitMic', micDenied: true, manualRepeat: true }), {
        resume: () => {},
      });
      if (this.timings.voiceOnly) {
        // nobody taps «سماح» → listen-only, so the child is never stuck on the prompt
        this.beatTimer = setTimeout(() => {
          if (prompt !== this.gen || this.paused || this.s.beat !== 'awaitMic') return;
          this.listenOnly = true;
          this.autoContinue();
        }, MIC_PROMPT_MS);
      }
      return false;
    }
    if (g !== this.gen) {
      await this.teacher.stopListening();
      return false;
    }
    this.listening = true;
    return true;
  }

  private async stopListening(): Promise<void> {
    if (!this.listening) return;
    this.listening = false;
    this.setLevel(0);
    await this.teacher.stopListening();
  }

  private onAction(a: TeacherAction): void {
    if (this.paused || !this.listening) return;
    switch (a.type) {
      case 'speechStarted':
        if (this.s.beat === 'hearingAnswer') clearTimeout(this.beatTimer);
        if (this.s.beat === 'listening') {
          clearTimeout(this.beatTimer);
          clearTimeout(this.passTimer); // still reciting — the pass isn't over
        }
        break;
      case 'repeatDetected':
        if (this.s.beat !== 'listening') break;
        if (this.step.type === 'full_surah') this.onFullUtterance(a.voicedMs ?? 1000);
        else this.countRepeat();
        break;
      case 'mannersRedirect':
        if (this.s.beat === 'listening' || this.s.beat === 'counted' || this.s.beat === 'nudging') {
          this.mannersRedirect();
        }
        break;
      case 'answerDetected':
        // The only question left: the go-ahead before the hadith (presence = yes).
        if (this.s.beat === 'hearingAnswer') this.onGoAhead();
        break;
    }
  }

  private applyPause(): void {
    if (this.pauseApplied || this.disposed) return;
    this.pauseApplied = true;
    this.gen++;
    clearTimeout(this.beatTimer);
    clearTimeout(this.passTimer);
    clearInterval(this.recClock);
    this.fire(this.player.pause());
    this.fire(this.teacher.stopSpeaking());
    this.fire(this.stopListening());
    if (this.s.beat === 'recording') this.fire(this.recorder.pause());
    this.set(copy(this.s, { paused: true, teacherSpeaking: false }));
  }

  private maybeResume(): void {
    if (this.paused || !this.pauseApplied || this.disposed) return;
    this.pauseApplied = false;
    this.set(copy(this.s, { paused: false }));
    if (this.s.screen === 'ended') return;
    this.resumeFn?.();
  }

  private startClock(): void {
    clearInterval(this.clock);
    this.clock = setInterval(() => {
      if (!this.paused) this.set(copy(this.s, { elapsedMs: this.s.elapsedMs + 1000 }));
    }, 1000);
  }

  private stopClock(): void {
    clearInterval(this.clock);
  }

  private cancelTimers(): void {
    clearTimeout(this.beatTimer);
    clearTimeout(this.passTimer);
    clearInterval(this.recClock);
  }

  /** A checkpoint; a failure (after the sink's own retries) is shown, and the lesson goes on. */
  private async checkpoint(p: LessonProgress): Promise<void> {
    try {
      await this.sink.checkpoint(p);
      if (this.s.progressSaveFailed && !this.disposed) this.set(copy(this.s, { progressSaveFailed: false }));
    } catch (e) {
      this.log('Lesson progress not saved', e);
      if (!this.disposed) this.set(copy(this.s, { progressSaveFailed: true }));
    }
  }

  private async safe(f: () => Promise<void>): Promise<void> {
    try {
      await f();
    } catch (e) {
      this.log('Lesson progress not saved', e);
    }
  }

  /** A bank line with this lesson's slots filled. */
  private line(id: string, extra: Record<string, string> = {}): TeacherLine {
    if (id === 'greet') id = this.now().getHours() < 12 ? 'greet.morning' : 'greet.evening';
    const project = this.s.project ?? this.firstProject();
    const st = this.script.steps[this.s.stepIndex];
    const surah =
      this.s.ayahRef?.surah ??
      (st?.type === 'stage_intro' || st?.type === 'full_surah' ? st.surah : null) ??
      this.introSurah();
    const slots: Record<string, string> = { name: this.childFirstName };
    if (surah !== null) {
      slots.surah = this.content.meta.surahName(surah);
      slots.countWords = TeacherLineBank.ayatInWords(this.content.meta.ayahCount(surah));
    }
    if (this.s.hadith) {
      slots.hadithTitle = this.s.hadith.title;
      slots.topic = this.s.hadith.topic;
    }
    if (project) {
      slots.projectTitle = project.title;
      slots.projectIntro = project.intro;
      slots.projectTomorrow = project.tomorrow;
      slots.reportAsk = project.reportAsk;
    }
    return line(id, { ...slots, ...extra });
  }

  private introSurah(): number | null {
    for (const s of this.script.steps) {
      if (s.type === 'intro' || s.type === 'stage_intro' || s.type === 'full_surah') return s.surah;
      if (s.type === 'ayah_loop') return s.ref.surah;
    }
    return null;
  }

  private firstProject(): ProjectContent | null {
    for (const s of this.script.steps) {
      if (s.type === 'project_assign' || s.type === 'project_report')
        return this.content.projects.byId(s.projectId);
    }
    return null;
  }
}
