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
}

export const defaultLessonTimings: LessonTimings = {
  silenceMs: 7000,
  echoGuardMs: 300,
  maxNudges: 2,
  recordedAutoAdvanceMs: 3200,
  maxRecordingMs: 3 * 60_000,
};

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

interface Question {
  line: TeacherLine;
  expect: AnswerIntent;
  onYes: () => void;
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
  private question: Question | undefined;
  private recorded: RecordedAudio | undefined;
  private saving = false;

  constructor(o: LessonAgentOptions) {
    this.script = o.script;
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
      await this.content.audio.prefetch(quranRefsOf(this.script));
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
        if (this.s.beat === 'recording') this.setLevel(v);
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

  /** Stops the reciter; the child can repeat straight away. */
  stop(): void {
    if (this.s.beat === 'reciting') {
      this.fire(this.player.stop());
      this.promptRepeat();
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

  /** The one persistent mic control. */
  micTap(): void {
    if (this.paused) return;
    switch (this.s.beat) {
      case 'awaitMic':
        if (this.s.screen === 'projectReport') {
          void this.startRecording();
        } else if (this.question) {
          this.enterHearingAnswer();
        } else {
          this.teacher.onEvent({ type: 'micOpened' });
          this.enterListening();
        }
        break;
      case 'listening':
      case 'counted':
      case 'nudging':
        // Muting pauses counting only; repeats so far are kept.
        this.teacher.onEvent({ type: 'micMuted' });
        this.enter(
          copy(this.s, {
            beat: 'awaitMic',
            captionId: 'ayah.repeat_now',
            caption: this.lineBank.resolve(line('ayah.repeat_now')),
            teacherSpeaking: false,
          }),
          { resume: () => {} },
        );
        break;
      case 'hearingAnswer':
        if (this.s.screen === 'intro') {
          // Frame 18: the live mic reads «قلت نعم» — the design's tap fallback.
          this.tapFallback('yes');
        } else {
          this.enter(copy(this.s, { beat: 'awaitMic', teacherSpeaking: false }), { resume: () => {} });
        }
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
    else if (beat === 'hearingAnswer') this.tapFallback('yes');
    else if ((beat === 'listening' || beat === 'nudging') && this.debugTapCountsRepeat) this.countRepeat();
    else if (beat === 'recorded') this.continueTapped();
    else this.skipFn?.();
  }

  /** The child tapped instead of speaking a short answer. */
  tapFallback(answer: AnswerIntent): void {
    if (this.paused || !this.question) return;
    this.teacher.onEvent({ type: 'tapFallback', answer });
    this.onAnswer(answer);
  }

  /** Gold arrow / «تابع» moments. */
  continueTapped(): void {
    if (this.paused) return;
    switch (this.s.beat) {
      case 'awaitContinue':
        this.enterStep(this.s.stepIndex + 1);
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
    this.question = undefined;
    this._progress = { ...this._progress, stepIndex: i };
    this.set(
      copy(this.s, {
        stepIndex: i,
        lineIndex: 0,
        happy: false,
        repeatsDone: 0,
        playbackBlocked: false,
        contentUnavailable: false,
      }),
    );
    this.teacher.onEvent({ type: 'stepShown', stepIndex: i });
    const step = this.script.steps[i]!;
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
        this.sayLines(step.lines, {
          question: step.lines.length === 0 ? undefined : step.lines[step.lines.length - 1],
          onYes: () => this.next(),
        });
        break;
      case 'ayah_loop': {
        const r = step.ref;
        const surah = this.content.meta.surahName(r.surah);
        this.set(
          copy(this.s, {
            screen: 'ayah',
            ayahRef: r,
            ayahText: this.content.text.text(r),
            ayahReference: `سورة ${surah} · الآية ${toArabicDigits(r.ayah)}`,
            surahName: surah,
            surahAyahCount: this.content.meta.ayahCount(r.surah),
            repeatsTarget: step.repeats,
          }),
        );
        void this.startRecitation();
        break;
      }
      case 'surah_done':
        this.set(copy(this.s, { screen: 'surahDone' }));
        this.sayLines([...step.lines, step.question], {
          question: step.question,
          happyLines: true,
          onYes: () =>
            this.say(line('surah.go_hadith'), { beat: 'advancing', happy: true, then: () => this.next() }),
        });
        break;
      case 'hadith_loop': {
        const h = this.content.hadith.byId(step.hadithId);
        this.set(copy(this.s, { screen: 'hadith', hadith: h, repeatsTarget: step.repeats }));
        this.say(this.line('hadith.topic'), {
          beat: 'speaking',
          then: h.canPlay ? () => void this.startRecitation() : () => this.promptRepeat(),
        });
        break;
      }
      case 'project_assign':
        this.set(
          copy(this.s, { screen: 'projectAssign', project: this.content.projects.byId(step.projectId) }),
        );
        this._progress = { ...this._progress, projectAssigned: step.projectId };
        this.sayLines([...step.lines, step.question], {
          question: step.question,
          expect: 'understood',
          onYes: () =>
            this.say(this.line('project.bye'), { beat: 'advancing', happy: true, then: () => this.next() }),
        });
        break;
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
          then: () => this.say(this.line(step.question), { beat: 'awaitMic', lineIndex: 1 }),
        });
        break;
      case 'lesson_end': {
        this._progress = { ...this._progress, completed: true, stepIndex: i };
        this.fire(this.safe(() => this.sink.completed(this._progress)));
        this.set(copy(this.s, { screen: 'lessonEnd' }));
        const bye = () =>
          this.say(this.line('end.bye'), { beat: 'done', happy: true, then: () => this.stopClock() });
        if (step.question === null) {
          this.sayLines(step.lines, { happyFirst: true, onDone: bye });
        } else {
          this.sayLines([...step.lines, step.question], {
            question: step.question,
            happyFirst: true,
            onYes: bye,
          });
        }
        break;
      }
    }
  }

  private next(): void {
    this.enterStep(this.s.stepIndex + 1);
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
    this.promptRepeat();
  }

  /** «الآن ردّد بصوتك… ثلاث مرات.» with the mic's gold ring. */
  private promptRepeat(): void {
    this.say(line('ayah.repeat_now'), { beat: 'awaitMic' });
  }

  private enterListening(): void {
    const isHadith = this.s.screen === 'hadith';
    const id = this.s.repeatsDone === 0 ? (isHadith ? 'ui.hearing_hadith' : 'ui.hearing_ayah') : 'ui.hearing';
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
              this.say(line('hadith.to_project'), { beat: 'advancing', happy: true, then: () => this.next() })
          : () => this.next(),
      });
      return;
    }
    const ref = this.s.ayahRef!;
    const done = new Set([...this._progress.doneRefs, refKey(ref)]);
    this._progress = { ...this._progress, doneRefs: done };
    const sameSurahAyah = (k: number): QuranRef | null => {
      const st = steps[k];
      return st?.type === 'ayah_loop' && st.ref.surah === ref.surah ? st.ref : null;
    };
    const nextRef = sameSurahAyah(i + 1);
    if (!nextRef) {
      const count = this.content.meta.ayahCount(ref.surah);
      let whole = true;
      for (let a = 1; a <= count; a++) if (!done.has(refKey(quranRef(ref.surah, a)))) whole = false;
      if (whole) {
        this._progress = {
          ...this._progress,
          surahsCompleted: new Set([...this._progress.surahsCompleted, ref.surah]),
        };
      }
      this.say(line('praise.all_done'), {
        beat: 'praising',
        happy: true,
        then: () => this.say(this.line('surah.complete'), { beat: 'awaitContinue', happy: true }),
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

  // ═══ Questions («جاهز؟» / «إن شاء الله» / «أبشر») ════════════════════════

  /** Says `lines` in order; if `question` is the last one, waits for the answer. */
  private sayLines(
    lines: readonly string[],
    o: {
      question?: string;
      expect?: AnswerIntent;
      onYes?: () => void;
      onDone?: () => void;
      happyLines?: boolean;
      happyFirst?: boolean;
    },
    from = 0,
  ): void {
    if (from >= lines.length) {
      o.onDone?.();
      return;
    }
    const id = lines[from]!;
    const isQuestion = o.question !== undefined && from === lines.length - 1;
    if (isQuestion) {
      this.question = { line: line(id), expect: o.expect ?? 'yes', onYes: o.onYes ?? (() => {}) };
      this.say(this.line(id), { beat: 'awaitMic', lineIndex: from });
      return;
    }
    this.say(this.line(id), {
      beat: 'speaking',
      lineIndex: from,
      happy: (o.happyLines ?? false) || ((o.happyFirst ?? false) && from === 0),
      then: () => this.sayLines(lines, o, from + 1),
    });
  }

  private enterHearingAnswer(): void {
    this.teacher.onEvent({ type: 'micOpened' });
    const g = this.enter(
      copy(this.s, {
        beat: 'hearingAnswer',
        captionId: 'ui.hearing',
        caption: this.lineBank.resolve(line('ui.hearing')),
        teacherSpeaking: false,
        micDenied: false,
      }),
      { resume: () => this.enterHearingAnswer(), keepListening: true },
    );
    this.fire(this.teacher.stopSpeaking());
    this.fire(this.listen('answer', g));
  }

  private onAnswer(intent: AnswerIntent): void {
    const q = this.question;
    if (!q) return;
    const accepted =
      intent === q.expect ||
      (intent === 'yes' && q.expect === 'understood') ||
      (intent === 'understood' && q.expect === 'yes');
    if (!accepted) {
      // Ask again, kindly — the mic closes until the child opens it.
      this.say(this.line(q.line.id), { beat: 'awaitMic' });
      return;
    }
    this.question = undefined;
    this.fire(this.stopListening());
    q.onYes();
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
    await this.teacher.stopSpeaking();
    try {
      await this.recorder.start();
    } catch (e) {
      if (!(e instanceof MicPermissionDenied)) throw e;
      if (g !== this.gen) return;
      this.enter(copy(this.s, { beat: 'awaitMic', micDenied: true }), { resume: () => {} });
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
      // Nothing usable — ask again.
      this.say(this.line((this.step as { question: string }).question), { beat: 'awaitMic' });
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
    try {
      await this.teacher.listen(mode);
    } catch (e) {
      if (!(e instanceof MicPermissionDenied)) throw e;
      if (g !== this.gen) return false;
      this.enter(copy(this.s, { beat: 'awaitMic', micDenied: true }), { resume: () => {} });
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
        if (this.s.beat === 'listening') clearTimeout(this.beatTimer);
        break;
      case 'repeatDetected':
        if (this.s.beat === 'listening') this.countRepeat();
        break;
      case 'answerDetected':
        if (this.s.beat === 'hearingAnswer') this.onAnswer(a.intent);
        break;
    }
  }

  private applyPause(): void {
    if (this.pauseApplied || this.disposed) return;
    this.pauseApplied = true;
    this.gen++;
    clearTimeout(this.beatTimer);
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
    clearInterval(this.recClock);
  }

  private checkpoint(p: LessonProgress): Promise<void> {
    return this.safe(() => this.sink.checkpoint(p));
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
    const surah = this.s.ayahRef?.surah ?? this.introSurah();
    const slots: Record<string, string> = { name: this.childFirstName };
    if (surah !== null) {
      slots.surah = this.content.meta.surahName(surah);
      slots.countWords = TeacherLineBank.ayatInWords(this.content.meta.ayahCount(surah));
    }
    if (this.s.hadith) slots.hadithTitle = this.s.hadith.title;
    if (project) {
      slots.projectIntro = project.intro;
      slots.projectTomorrow = project.tomorrow;
      slots.reportAsk = project.reportAsk;
    }
    return line(id, { ...slots, ...extra });
  }

  private introSurah(): number | null {
    for (const s of this.script.steps) {
      if (s.type === 'intro') return s.surah;
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
