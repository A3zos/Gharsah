// The live lesson on the AI server's /agent/* state machine (ai/API_web.md) —
// VITE_AI_AGENT=1. The server decides what the teacher says and which stage comes
// next; this class speaks it, runs the actions, waits for the child the way
// `expects` asks, and keeps our own progress (stars, dashboard, leaderboard).
//
// Our rules on top of the server:
// * Ayat are shown ONLY from the verified local Tanzil text (by surah + ayah
//   number) — the server's ayah strings are never displayed. The reciter audio
//   comes only from the server's everyayah URLs; no ayah is ever sent to TTS by us.
// * Hadith text stays the approved placeholder until it's vetted (CLAUDE.md §3).
// * The child's name never leaves the device: no child_name, and the `name`
//   stage is never asked: it is answered with the neutral «بطل» (the teacher keeps
//   saying «يا بطل»); the child's own words are scrubbed of their name (api.ts).
// * Child audio goes to the server (which stores it) only with the parent's
//   consent: the recitation upload, and the browser's speech recognition. Without
//   consent, a repeat is counted on the device (presence only, nothing sent) or
//   by «ردّدت», and the reference text the server gave is sent as the answer.
// * Any server failure that a restart can't fix → `fallback` (the route then
//   runs the built-in lesson) so the child is never stuck.
import { Observable } from '../observable';
import { PlaybackBlocked } from '../ports';
import { AgentUnavailable, RateLimited, SessionExpired, type AgentApi, type Gender } from './api';
import type { ActionItem, AgentAction, AgentMode, AgentStage, Expects, ServerTurn, TurnKind } from './parse';
import { doneRefsOf, hadithMatchesTopic, mappedStage, type ServerProgressSink } from './progressMap';

// ── ports ──

export interface TeacherVoice {
  /**
   * Says the line in short pieces; `onPiece` fires as each one starts, with
   * `voiced: false` when neither the server nor the browser could voice it (the
   * screen then shows it as text). Resolves when said or skipped; rejects with
   * PlaybackBlocked when the browser refuses audio before a tap.
   */
  speak(text: string, onPiece?: (piece: string, voiced: boolean) => void): Promise<void>;
  stop(): void;
  /** Wakes the voice service at lesson start (optional). */
  warm?(): void;
  /** Resolves once the real voice is ready (or has failed) — the lesson waits for it. */
  ready?(): Promise<boolean>;
}

export interface UrlPlayer {
  /** Resolves at the end of the audio; rejects with PlaybackBlocked if autoplay is refused. */
  play(url: string): Promise<void>;
  stop(): void;
}

/** On-device speech presence — measured only, never stored or sent. */
export interface PresenceListener {
  /**
   * Resolves 'spoke' once the child spoke for at least `minMs` (then fell quiet),
   * 'silent' after `timeoutMs` without that, 'denied' when the mic can't open.
   */
  waitForSpeech(
    signal: AbortSignal,
    opts?: { purpose?: 'repeat' | 'answer'; minMs?: number; timeoutMs?: number },
  ): Promise<'spoke' | 'silent' | 'denied'>;
  /** Ask for the mic again — called inside the «سماح» tap. */
  requestAccess?(): Promise<boolean>;
}

/** Records one utterance (consent only). Null when nothing usable was heard. */
export interface UtteranceRecorder {
  record(signal: AbortSignal): Promise<Blob | null>;
}

/** The browser's speech recognition (consent only — Chrome sends the audio to Google). */
export interface SpeechInput {
  listen(signal: AbortSignal): Promise<string | null>;
}

/** Today's lesson in the pilot plan — the server must teach exactly this (no choosing). */
export interface LessonPlan {
  /** Our progress row (pilot-day-N). */
  lessonId: string;
  surahNo: number;
  /** «الإخلاص» — the answer to the server's «which surah?» stage. */
  surahName: string;
  /** «برّ الوالدين» — the server's hadith title must match it. */
  hadithTopic: string;
  /** The built-in script's hadith step / last step (so a fallback resumes in the right place). */
  hadithStepIndex: number;
  lastStepIndex: number;
}

export interface ServerLessonDeps {
  api: AgentApi;
  plan: LessonPlan;
  voice: TeacherVoice;
  player: UrlPlayer;
  presence: PresenceListener;
  sink: ServerProgressSink;
  deviceId: string;
  gender: Gender;
  /** The parent allowed sending the child's voice to the AI server. */
  consent: boolean;
  /** Present only with consent and a browser that supports it. */
  recorder?: UtteranceRecorder | null;
  speechInput?: SpeechInput | null;
  /** Verified local Tanzil text (null = not bundled → nothing is shown). */
  verifiedAyah: (surah: number, ayah: number) => string | null;
  ayahCount: (surah: number) => number;
  surahName: (surah: number) => string;
  blobToBase64?: (b: Blob) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  /** Natural pauses in the conversation (tests pass an instant one). */
  beat?: (ms: number) => Promise<void>;
  /** After this long without the first answer, show «المعلّم يتجهّز…». */
  warmingAfterMs?: number;
}

// ── state ──

export type ServerPhase =
  | 'starting'
  | 'warming' // cold start: «المعلّم يتجهّز…»
  | 'live'
  | 'segmentDone' // a session ended; «أكمل» starts the next one
  | 'finished' // all sessions done
  | 'fallback' // the server can't run the lesson — use the built-in one
  | 'ended'; // the child left

export interface ServerLessonState {
  readonly phase: ServerPhase;
  readonly segment: TurnKind | null;
  readonly teacher: string;
  readonly female: boolean;
  readonly stages: readonly AgentStage[];
  readonly stageIndex: number;
  readonly maxStageIndex: number;
  /** The piece being said — shown ONLY while `voiceMissing` (the teacher only talks). */
  readonly caption: string;
  /** Neither the server voice nor a browser voice could say the current piece. */
  readonly voiceMissing: boolean;
  readonly speaking: boolean;
  readonly reciting: boolean;
  readonly playbackBlocked: boolean;
  /** Verified ayat to show (taseem: none, on purpose). */
  readonly ayat: readonly { ayah: number; text: string }[];
  readonly currentAyah: number | null;
  readonly surahName: string | null;
  readonly hadith: { title: string | null; source: string | null } | null;
  readonly words: readonly { word: string; meaning: string }[];
  /** What the child can do now (null while the teacher talks or the server thinks). */
  readonly expects: Expects | null;
  readonly quickReplies: readonly string[];
  readonly busy: boolean;
  readonly notice: 'rateLimited' | 'restarted' | null;
  readonly repeat: 'idle' | 'listening' | 'sending';
  readonly micDenied: boolean;
  /** The one full-screen prompt: «سماح» for the mic. */
  readonly micPrompt: boolean;
  /** The mic stayed blocked: the lesson continues by itself after each line. */
  readonly listenOnly: boolean;
  /** Counts the times the child was heard — the mic shows «I heard you». */
  readonly heard: number;
  readonly canSpeak: boolean;
  readonly hearing: boolean;
  readonly nextSegment: TurnKind | null;
  readonly projects: readonly ActionItem[];
  readonly saveFailed: boolean;
  readonly paused: boolean;
  /** Today's surah part is finished — a fallback resumes the built-in lesson at the hadith. */
  readonly quranDone: boolean;
  /** Counts the cheers (a repeat accepted, a part or the lesson finished) — the teacher looks happy. */
  readonly cheer: number;
  /** Why the lesson handed over to the built-in one (logged; for support). */
  readonly fallbackReason: string | null;
}

export const initialServerState: ServerLessonState = {
  phase: 'starting',
  segment: null,
  teacher: '',
  female: false,
  stages: [],
  stageIndex: 0,
  maxStageIndex: 0,
  caption: '',
  voiceMissing: false,
  speaking: false,
  reciting: false,
  playbackBlocked: false,
  ayat: [],
  currentAyah: null,
  surahName: null,
  hadith: null,
  words: [],
  expects: null,
  quickReplies: [],
  busy: true,
  notice: null,
  repeat: 'idle',
  micDenied: false,
  micPrompt: false,
  listenOnly: false,
  heard: 0,
  canSpeak: false,
  hearing: false,
  nextSegment: null,
  projects: [],
  saveFailed: false,
  paused: false,
  quranDone: false,
  cheer: 0,
  fallbackReason: null,
};

/** The hadith text placeholder until a vetted source is approved (CLAUDE.md §3). */
export const HADITH_PLACEHOLDER = '[نص الحديث — يُعتمد لاحقًا من مصدر موثّق مع التخريج]';
/** Flip only after the product owner approves the server's hadith content. */
export const SERVER_HADITH_TEXT_APPROVED = false;

export const RATE_LIMIT_BACKOFF_MS = [4000, 8000, 16000, 30000];
const UNAVAILABLE_RETRY_MS = [1500, 4000];
const MAX_RESTARTS = 2;
const CONTINUE_TEXT = 'أكمل';
/** ~350 ms between the teacher's line and what follows (a recitation). */
export const LINE_GAP_MS = 350;
/** ~600 ms after a question before the child's turn opens. */
export const QUESTION_PAUSE_MS = 600;
/** What the name stage gets instead of the child's name. */
export const NAME_STAND_IN = 'بطل';
const MAX_NAME_ANSWERS = 2;
/** Stages before the surah is chosen — their surah_no is the server's default (1). */
const BEFORE_SURAH = new Set(['greet', 'name', 'surah']);
/** Silence (no speech) that counts as «the child said nothing». */
export const SILENCE_MS = 6000;
/** Two silences: one nudge after the first, the lesson continues after the second. */
export const SILENCES_BEFORE_CONTINUE = 2;
/** On-device: an answer is speech of at least this long. */
export const ANSWER_MIN_SPEECH_MS = 600;
/** Listen-only (mic blocked): the pause after each line before moving on. */
export const LISTEN_ONLY_PAUSE_MS = 1500;
/** The «سماح» prompt waits this long for a tap, then listen-only. */
export const MIC_PROMPT_MS = 20_000;
/** Between two parts of the lesson (no «next» button). */
export const SEGMENT_PAUSE_MS = 1500;
/** What goes to the server when the child's words aren't known (no quick replies). */
export const DEFAULT_ANSWER = 'تمام';
/** Approved nudges after a silence (the teacher speaks to a boy / a girl). */
export const NUDGE_ANSWER: Record<Gender, string> = {
  boy: 'أنا أسمعك يا بطل، قلها بصوتك',
  girl: 'أنا أسمعكِ يا بطلة، قوليها بصوتكِ',
};
export const NUDGE_REPEAT: Record<Gender, string> = {
  boy: 'أنا أسمعك يا بطل، ردّدها بصوتك',
  girl: 'أنا أسمعكِ يا بطلة، ردّديها بصوتكِ',
};

/** What one listening window brought: the child spoke (and maybe their words). */
interface Heard {
  readonly spoke: boolean;
  readonly text: string | null;
}
const REPEATED_TEXT = 'ردّدت';

type Segment =
  | { kind: 'quran' }
  | { kind: 'hadith' }
  | { kind: 'taseem'; surahNo: number; chunk: number }
  | { kind: 'htaseem'; hadithId: number };

const modeOf = (s: Segment): AgentMode => (s.kind === 'quran' || s.kind === 'taseem' ? 'quran' : 'hadith');

class Cancelled extends Error {
  override name = 'Cancelled';
}

export class ServerLesson {
  readonly state = new Observable<ServerLessonState>(initialServerState);

  private readonly sleep: (ms: number) => Promise<void>;
  private readonly beat: (ms: number) => Promise<void>;
  private segments: Segment[] = [];
  private segIndex = 0;
  private turn: ServerTurn | null = null;
  /** Cancels the current turn's speech, audio and listening. */
  private turnAbort: AbortController | null = null;
  private disposed = false;
  private restarts = 0;
  private nameAnswers = 0;
  /** What the child is asked to repeat (play_ayah text / the hadith), sent without consent. */
  private reference: string | null = null;
  private segSurah: number | null = null;
  private surahAnswers = 0;
  private listenOnly = false;
  private speechBroken = false;
  private quizUnscored = false;
  private allowAnswer: ((ok: boolean) => void) | null = null;
  private unblock: (() => void) | null = null;
  private pausedByBackground = false;

  constructor(private readonly d: ServerLessonDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.beat = d.beat ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private set(patch: Partial<ServerLessonState>): void {
    if (this.disposed) return;
    this.state.value = { ...this.state.value, ...patch };
  }

  // ── lifecycle ──

  async start(): Promise<void> {
    this.d.voice.warm?.();
    const warm = setTimeout(() => {
      if (this.state.value.phase === 'starting') this.set({ phase: 'warming' });
    }, this.d.warmingAfterMs ?? 3000);
    try {
      // Never start with the browser voice while the server voice is waking up:
      // «المعلم يتجهز…» until it is ready (≤ ~45 s) — the browser's only if it fails.
      await this.d.voice.ready?.();
      if (this.disposed) return;
      this.segments = await this.plan();
      this.segIndex = 0;
      await this.startSegment(false);
    } finally {
      clearTimeout(warm);
    }
  }

  /** Taseem first (consent only — it needs the child's voice), then quran, then hadith. */
  private async plan(): Promise<Segment[]> {
    const out: Segment[] = [];
    if (this.d.consent) {
      const [q, h] = await Promise.all([
        this.d.api.taseemReady(this.d.deviceId).catch(() => []),
        this.d.api.htaseemReady(this.d.deviceId).catch(() => []),
      ]);
      const tq = q.find((r) => r.surahNo !== undefined);
      if (tq) out.push({ kind: 'taseem', surahNo: tq.surahNo!, chunk: tq.chunk ?? 0 });
      const th = h.find((r) => r.hadithId !== undefined);
      if (th) out.push({ kind: 'htaseem', hadithId: th.hadithId! });
    }
    out.push({ kind: 'quran' }, { kind: 'hadith' });
    return out;
  }

  private async startSegment(restarted: boolean): Promise<void> {
    const seg = this.segments[this.segIndex]!;
    this.nameAnswers = 0;
    this.surahAnswers = 0;
    this.reference = null;
    this.segSurah = seg.kind === 'taseem' ? seg.surahNo : seg.kind === 'quran' ? this.d.plan.surahNo : null;
    this.set({
      busy: true,
      expects: null,
      segment: seg.kind,
      nextSegment: null,
      ayat: [],
      words: [],
      hadith: null,
      currentAyah: null,
      notice: restarted ? 'restarted' : null,
      ...(this.state.value.phase === 'segmentDone' ? { phase: 'live' as const } : {}),
    });
    const { deviceId, gender } = this.d;
    const turn = await this.call(
      () =>
        seg.kind === 'taseem'
          ? this.d.api.taseemStart({ deviceId, gender, surahNo: seg.surahNo, chunk: seg.chunk })
          : seg.kind === 'htaseem'
            ? this.d.api.htaseemStart({ deviceId, gender, hadithId: seg.hadithId })
            : this.d.api.start({ mode: seg.kind, gender, deviceId }),
      false,
    );
    if (turn) await this.play(turn);
  }

  /**
   * One server request with the documented error handling: 429 → gentle notice +
   * backoff; 404 session expired → a fresh session (transparent restart);
   * unavailable → a couple of retries, then the built-in lesson.
   */
  private async call(f: () => Promise<ServerTurn>, canRestart = true): Promise<ServerTurn | null> {
    let limited = 0;
    let unavailable = 0;
    for (;;) {
      if (this.disposed) return null;
      try {
        const t = await f();
        if (this.state.value.notice === 'rateLimited') this.set({ notice: null });
        return t;
      } catch (e) {
        if (this.disposed) return null;
        if (e instanceof RateLimited && limited < RATE_LIMIT_BACKOFF_MS.length) {
          this.set({ notice: 'rateLimited' });
          await this.sleep(RATE_LIMIT_BACKOFF_MS[limited++]!);
          continue;
        }
        if (e instanceof SessionExpired && canRestart && this.restarts < MAX_RESTARTS) {
          this.restarts++;
          await this.startSegment(true);
          return null;
        }
        if (e instanceof AgentUnavailable && unavailable < UNAVAILABLE_RETRY_MS.length) {
          await this.sleep(UNAVAILABLE_RETRY_MS[unavailable++]!);
          continue;
        }
        this.fallback(e);
        return null;
      }
    }
  }

  private fallback(e: unknown): void {
    const reason = String((e as Error)?.message ?? e);
    console.warn('[gharsah] AI lesson → built-in lesson:', reason);
    this.cancelTurn();
    this.set({ phase: 'fallback', busy: false, expects: null, fallbackReason: reason });
  }

  // ── a turn ──

  private cancelTurn(): void {
    this.turnAbort?.abort();
    this.turnAbort = null;
    this.d.voice.stop();
    this.d.player.stop();
    this.unblock = null;
  }

  private async play(turn: ServerTurn): Promise<void> {
    this.cancelTurn();
    const abort = new AbortController();
    this.turnAbort = abort;
    this.turn = turn;
    this.restarts = turn.stageIndex > 0 ? 0 : this.restarts;
    // The pilot plan: the server must teach today's surah and hadith — otherwise the
    // built-in lesson (which follows the same plan) takes over.
    // (the server's turns carry its default surah_no 1 until «which surah?» is answered)
    if (
      turn.kind === 'quran' &&
      !BEFORE_SURAH.has(turn.stage) &&
      turn.surahNo !== null &&
      turn.surahNo !== this.d.plan.surahNo
    ) {
      return this.fallback(new Error(`server surah ${turn.surahNo} ≠ today's ${this.d.plan.surahNo}`));
    }
    const title = turn.kind === 'hadith' ? hadithTitleOf(turn) : null;
    if (title && !hadithMatchesTopic(title, this.d.plan.hadithTopic, normalizeArabic)) {
      return this.fallback(new Error(`server hadith «${title}» ≠ today's «${this.d.plan.hadithTopic}»`));
    }
    this.saveProgress(turn);

    // The name stays on the device: the name stage is never shown to the child —
    // answered with the neutral «بطل», silently; if the server keeps asking, the
    // built-in lesson takes over rather than asking the child.
    if (turn.stage === 'name' && turn.expects !== 'none') {
      if (this.nameAnswers >= MAX_NAME_ANSWERS) return this.fallback(new Error('name stage repeats'));
      this.nameAnswers++;
      this.set({ busy: true, expects: null });
      return this.send(NAME_STAND_IN);
    }
    // No choosing: «which surah?» is answered with today's surah, silently.
    if (turn.kind === 'quran' && turn.stage === 'surah' && turn.expects !== 'none') {
      if (this.surahAnswers >= MAX_NAME_ANSWERS) return this.fallback(new Error('surah stage repeats'));
      this.surahAnswers++;
      this.set({ busy: true, expects: null });
      return this.send(this.d.plan.surahName);
    }
    // Arrived while ExitConfirm is open — resume() plays it.
    if (this.state.value.paused) {
      this.set({ busy: false });
      return;
    }

    this.set({
      phase: 'live',
      teacher: turn.teacher,
      female: turn.female,
      stages: turn.stages,
      stageIndex: turn.stageIndex,
      maxStageIndex: turn.maxStageIndex,
      caption: turn.say,
      busy: false,
      expects: null,
      quickReplies: [],
      repeat: 'idle',
      hearing: false,
      playbackBlocked: false,
      paused: false,
    });
    try {
      for (const a of turn.actions) this.show(a, turn);
      if (turn.say.trim()) await this.say(turn.say, abort);
      const plays = turn.actions.some((a) => a.type === 'play_all' || a.type === 'play_ayah');
      if (turn.say.trim() && plays) await this.guard(abort, this.beat(LINE_GAP_MS));
      for (const a of turn.actions) {
        if (a.type === 'play_all') for (const u of a.urls) await this.recite(u, abort);
        if (a.type === 'play_ayah') {
          this.set({ currentAyah: a.ayah });
          await this.recite(a.url, abort);
        }
      }
      // a natural pause after the teacher's question, before listening
      if (turn.expects !== 'none') await this.guard(abort, this.beat(QUESTION_PAUSE_MS));
      await this.await(turn, abort);
    } catch (e) {
      if (e instanceof Cancelled) return;
      throw e;
    }
  }

  /** The teacher's line, voiced; the caption follows the piece being said. */
  private async say(text: string, abort: AbortController): Promise<void> {
    this.set({ speaking: true });
    try {
      for (;;) {
        try {
          await this.guard(
            abort,
            this.d.voice.speak(
              text,
              (piece, voiced) => !abort.signal.aborted && this.set({ caption: piece, voiceMissing: !voiced }),
            ),
          );
          return;
        } catch (e) {
          if (!(e instanceof PlaybackBlocked)) throw e;
          // Audio refused before a tap: the small play button, then the line again.
          this.set({ playbackBlocked: true });
          await this.guard(abort, new Promise<void>((r) => (this.unblock = r)));
          this.set({ playbackBlocked: false });
        }
      }
    } finally {
      this.set({ speaking: false });
    }
  }

  /** The whole surah from the verified local text (the built-in lesson's surah card). */
  private showSurah(current: number | null): void {
    const surah = this.segSurah;
    if (surah === null) return;
    if (this.state.value.ayat[0] && this.state.value.surahName === this.d.surahName(surah)) {
      this.set({ currentAyah: current });
      return;
    }
    const ayat: { ayah: number; text: string }[] = [];
    for (let a = 1; a <= this.d.ayahCount(surah); a++) {
      const text = this.d.verifiedAyah(surah, a);
      if (text) ayat.push({ ayah: a, text });
    }
    this.set({ ayat, currentAyah: current, surahName: this.d.surahName(surah) });
  }

  /** show_ayat / show_words — the display only. */
  private show(a: AgentAction, turn: ServerTurn): void {
    if (a.type === 'play_ayah') {
      if (a.text.trim()) this.reference = a.text;
      if (turn.kind === 'quran') this.showSurah(a.ayah);
      return;
    }
    if (a.type === 'show_words') {
      this.set({ words: SERVER_HADITH_TEXT_APPROVED ? a.words : [] });
      return;
    }
    if (a.type !== 'show_ayat') return;
    if (turn.kind === 'taseem' || turn.kind === 'htaseem') {
      // Memory test: the server sends empty text on purpose — show nothing.
      this.set({ ayat: [], currentAyah: null });
      return;
    }
    if (turn.kind === 'hadith') {
      if (a.ayat[0]?.trim()) this.reference = a.ayat[0];
      this.set({ hadith: { title: a.hadithTitle ?? turn.hadithTitle, source: a.source } });
      return;
    }
    this.showSurah(a.current);
  }

  private async recite(url: string, abort: AbortController): Promise<void> {
    this.set({ reciting: true });
    try {
      for (;;) {
        try {
          await this.guard(abort, this.d.player.play(url));
          return;
        } catch (e) {
          if (!(e instanceof PlaybackBlocked)) {
            if (e instanceof Cancelled) throw e;
            return; // an ayah that can't load doesn't stop the lesson
          }
          this.set({ playbackBlocked: true });
          await this.guard(abort, new Promise<void>((r) => (this.unblock = r)));
          this.set({ playbackBlocked: false });
        }
      }
    } finally {
      this.set({ reciting: false });
    }
  }

  /**
   * A pure voice call: after every line the mic opens by itself (no buttons, no text).
   *   consent + recognition -> the child's real words (a choice -> the closest option)
   *   otherwise -> on-device voice activity only (nothing recorded or sent): speech of
   *     >=0.6 s = an answer -> the first quick reply (or «تمام»); a choice -> the first
   *     option, marked «لم يُقيَّم» for the parent; a repeat counts by presence
   *   silence ~6 s -> one gentle nudge; silence again -> the lesson continues by itself
   *   mic blocked -> one «سماح» prompt; still blocked -> listen-only (auto-continue)
   */
  private async await(turn: ServerTurn, abort: AbortController): Promise<void> {
    if (turn.expects === 'none') return this.segmentEnded();
    const canSpeak =
      !!this.d.speechInput && this.d.consent && !this.speechBroken && turn.expects !== 'repeat';
    this.set({ expects: turn.expects, quickReplies: turn.quickReplies, canSpeak });
    for (let silences = 0; ;) {
      const heard = await this.hear(turn, abort);
      if (heard !== 'silent') return this.respond(turn, heard);
      silences++;
      if (silences >= SILENCES_BEFORE_CONTINUE) return this.respond(turn, { spoke: false, text: null });
      await this.nudge(turn, abort);
    }
  }

  /** One listening window: what the child said / that they spoke, or silence. */
  private async hear(turn: ServerTurn, abort: AbortController): Promise<Heard | 'silent'> {
    if (this.listenOnly) {
      // The mic stays blocked: the lesson goes on by itself after each line.
      await this.guard(abort, this.beat(LISTEN_ONLY_PAUSE_MS));
      return { spoke: false, text: null };
    }
    const repeat = turn.expects === 'repeat';
    if (repeat) this.set({ repeat: 'listening' });
    else this.set({ hearing: true });
    try {
      // With consent: the recitation goes to the server for its transcription...
      if (repeat && this.d.consent && this.d.recorder) {
        const blob = await this.guard(abort, this.d.recorder.record(abort.signal)).catch((e: unknown) => {
          if (e instanceof Cancelled) throw e;
          return null;
        });
        if (blob) {
          this.set({ repeat: 'sending' });
          const toB64 = this.d.blobToBase64 ?? blobToBase64;
          const score = await this.guard(
            abort,
            toB64(blob).then((b) => this.d.api.scoreRecitation(this.turn!.sessionId, b)),
          ).catch((e: unknown) => {
            if (e instanceof Cancelled) throw e;
            return { available: false, transcription: null };
          });
          return { spoke: true, text: score.available ? score.transcription : null };
        }
        if (abort.signal.aborted) throw new Cancelled();
      }
      // ...and the child's words go to speech recognition.
      if (!repeat && this.d.consent && this.d.speechInput && !this.speechBroken) {
        const text = await this.guard(abort, this.d.speechInput.listen(abort.signal)).catch((e: unknown) => {
          if (e instanceof Cancelled) throw e;
          this.speechBroken = true; // unsupported / blocked -> on-device presence from now on
          return undefined;
        });
        if (text) return { spoke: true, text };
        if (text === null) return 'silent';
      }
      // On-device voice activity only — measured, never recorded or sent.
      const r = await this.guard(
        abort,
        this.d.presence.waitForSpeech(abort.signal, {
          purpose: repeat ? 'repeat' : 'answer',
          minMs: repeat ? undefined : ANSWER_MIN_SPEECH_MS,
          timeoutMs: SILENCE_MS,
        }),
      );
      if (r === 'spoke') return { spoke: true, text: null };
      if (r === 'silent') return 'silent';
      return (await this.micBlocked(abort)) ? this.hear(turn, abort) : { spoke: false, text: null };
    } finally {
      if (!abort.signal.aborted) this.set({ hearing: false, repeat: 'idle' });
    }
  }

  /** The child answered (or the lesson moves on without them): what goes to the server. */
  private respond(turn: ServerTurn, h: Heard): Promise<void> {
    if (h.spoke) this.set({ heard: this.state.value.heard + 1 }); // «I heard you» on the mic
    if (turn.expects === 'repeat') {
      if (h.spoke) this.cheer();
      return this.send(h.text?.trim() || this.repeatText());
    }
    const first = turn.quickReplies[0];
    if (turn.expects === 'choice') {
      const match = h.text ? closestReply(h.text, turn.quickReplies) : null;
      if (match) return this.send(match);
      // On-device we can't know which option was said: the first one, not scored.
      this.quizUnscored = true;
      return this.send(first ?? DEFAULT_ANSWER);
    }
    if (h.text) return this.send(this.spokenAnswer(h.text) ?? h.text.trim());
    return this.send(first ?? DEFAULT_ANSWER);
  }

  /** One gentle nudge after a silence (an approved line, in the teacher's voice). */
  private async nudge(turn: ServerTurn, abort: AbortController): Promise<void> {
    const text = turn.expects === 'repeat' ? NUDGE_REPEAT[this.d.gender] : NUDGE_ANSWER[this.d.gender];
    await this.say(text, abort);
    await this.guard(abort, this.beat(QUESTION_PAUSE_MS));
  }

  /** The mic is blocked: the one «سماح» prompt. True -> the mic works now. */
  private async micBlocked(abort: AbortController): Promise<boolean> {
    if (this.listenOnly) return false;
    this.set({ micDenied: true, micPrompt: true, hearing: false, repeat: 'idle' });
    const allowed = await this.guard(
      abort,
      new Promise<boolean>((resolve) => {
        this.allowAnswer = resolve;
        setTimeout(() => resolve(false), MIC_PROMPT_MS); // never stuck on the prompt
      }),
    ).finally(() => (this.allowAnswer = null));
    this.set({ micPrompt: false });
    if (allowed) {
      this.set({ micDenied: false });
      return true;
    }
    this.listenOnly = true;
    this.set({ listenOnly: true });
    return false;
  }

  /** «سماح» on the prompt: ask for the mic again (inside the tap). */
  allowTapped(): void {
    if (this.state.value.micPrompt) {
      const ask = this.d.presence.requestAccess?.() ?? Promise.resolve(false);
      void ask.then((ok) => this.allowAnswer?.(ok));
      return;
    }
    if (this.state.value.playbackBlocked) this.playTapped();
  }

  /** The child's words: a free answer goes as said (or its matching quick reply). */
  private spokenAnswer(text: string): string | null {
    const s = this.state.value;
    const said = normalizeArabic(text);
    if (!said) return null;
    const match = s.quickReplies.find((q) => {
      const n = normalizeArabic(q);
      return n && (said.includes(n) || n.includes(said));
    });
    return match ?? text.trim();
  }

  private cheer(): void {
    this.set({ cheer: this.state.value.cheer + 1 });
  }

  private repeatText(): string {
    return this.reference?.trim() || REPEATED_TEXT;
  }

  private async segmentEnded(): Promise<void> {
    this.set({ expects: null, quickReplies: [], repeat: 'idle' });
    this.cheer();
    const next = this.segments[this.segIndex + 1];
    if (next) {
      this.set({ phase: 'segmentDone', nextSegment: next.kind });
      // a voice call: no «next» button — the next part starts by itself after a pause
      const abort = this.turnAbort;
      await (abort ? this.guard(abort, this.beat(SEGMENT_PAUSE_MS)) : this.beat(SEGMENT_PAUSE_MS));
      if (this.state.value.phase === 'segmentDone' && !this.state.value.paused) this.continueTapped();
      return;
    }
    this.set({ phase: 'finished' });
  }

  // ── progress ──

  /** Today's progress row — the same one the built-in lesson writes. */
  private saveProgress(turn: ServerTurn): void {
    const stage = mappedStage(turn);
    if (!stage) return;
    const { plan } = this.d;
    if (turn.kind === 'quran' && stage === 'hadith' && !this.state.value.quranDone)
      this.set({ quranDone: true });
    const update = {
      lessonId: plan.lessonId,
      stage,
      // Where the built-in lesson would resume: the start, the hadith, or the end.
      stepIndex: stage === 'done' ? plan.lastStepIndex : stage === 'hadith' ? plan.hadithStepIndex : 0,
      doneRefs: doneRefsOf(turn, stage, plan.surahNo, this.d.ayahCount),
      ...(this.quizUnscored && turn.kind === 'hadith' ? { quizUnscored: true } : {}),
    };
    void this.d.sink.record(update).then(
      () => this.state.value.saveFailed && this.set({ saveFailed: false }),
      () => this.set({ saveFailed: true }),
    );
  }

  // ── child input ──

  private async send(text: string): Promise<void> {
    const t = this.turn;
    if (!t || this.disposed) return;
    this.cancelTurn();
    this.set({ busy: true, expects: null, quickReplies: [], repeat: 'idle', hearing: false, notice: null });
    const next = await this.call(() =>
      this.d.api.message(t.sessionId, text, modeOf(this.segments[this.segIndex]!)),
    );
    if (next) await this.play(next);
  }

  /** A quick reply / choice button, or the text field. */
  answer(text: string): void {
    const s = this.state.value;
    const clean = text.trim().slice(0, 500);
    if (!clean || s.busy || !s.expects || s.expects === 'none' || s.paused) return;
    void this.send(clean);
  }

  /** «أكمل» — on `continue`, or to start the next session. */
  continueTapped(): void {
    const s = this.state.value;
    if (s.phase === 'segmentDone') {
      this.segIndex++;
      this.restarts = 0;
      void this.startSegment(false);
      return;
    }
    if (s.expects === 'continue') this.answer(CONTINUE_TEXT);
  }

  /** A tap fallback kept for tests and old callers: one repeat without the mic. */
  repeatTapped(): void {
    if (this.state.value.expects !== 'repeat' || this.state.value.busy) return;
    this.cheer();
    void this.send(this.repeatText());
  }

  /** A section in the stages bar (only ones already reached). */
  jumpTo(index: number): void {
    const s = this.state.value;
    const t = this.turn;
    const stage = s.stages[index];
    if (!t || !stage || s.busy || index > s.maxStageIndex || index === s.stageIndex) return;
    if (t.kind === 'taseem' || t.kind === 'htaseem') return;
    this.cancelTurn();
    this.set({ busy: true, expects: null });
    void this.call(() => this.d.api.jump(t.sessionId, stage.id, modeOf(this.segments[this.segIndex]!))).then(
      (next) => next && this.play(next),
    );
  }

  /** The small fallback play when autoplay was refused. */
  playTapped(): void {
    this.unblock?.();
    this.unblock = null;
  }

  pause(): void {
    if (this.state.value.paused || !this.turn) return;
    this.cancelTurn();
    this.set({
      paused: true,
      speaking: false,
      reciting: false,
      hearing: false,
      repeat: 'idle',
      expects: null,
    });
  }

  /** Back from ExitConfirm / the background: the current turn again (speech + audio). */
  resume(): void {
    if (!this.state.value.paused) return;
    this.set({ paused: false });
    // Paused while the server was answering: that answer plays when it arrives.
    if (this.turn && !this.state.value.busy) void this.play(this.turn);
  }

  setForeground(visible: boolean): void {
    if (!visible && !this.state.value.paused) {
      this.pausedByBackground = true;
      this.pause();
    } else if (visible && this.pausedByBackground) {
      this.pausedByBackground = false;
      this.resume();
    }
  }

  async markProjectDone(hadithId: number): Promise<void> {
    await this.d.api.markActionDone(this.d.deviceId, hadithId);
    this.set({
      projects: this.state.value.projects.map((p) => (p.hadithId === hadithId ? { ...p, done: true } : p)),
    });
  }

  end(): void {
    this.cancelTurn();
    this.set({ phase: 'ended' });
  }

  dispose(): void {
    this.cancelTurn();
    this.disposed = true;
    this.state.dispose();
  }

  /** Rejects with Cancelled as soon as the turn is aborted. */
  private guard<T>(abort: AbortController, p: Promise<T>): Promise<T> {
    if (abort.signal.aborted) return Promise.reject(new Cancelled());
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new Cancelled());
      abort.signal.addEventListener('abort', onAbort, { once: true });
      p.then(
        (v) => {
          abort.signal.removeEventListener('abort', onAbort);
          if (abort.signal.aborted) reject(new Cancelled());
          else resolve(v);
        },
        (e: unknown) => {
          abort.signal.removeEventListener('abort', onAbort);
          reject(abort.signal.aborted ? new Cancelled() : e);
        },
      );
    });
  }
}

export async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** For matching a spoken answer to a button: no diacritics, tatweel or punctuation; one alef / ya / ha. */
export function normalizeArabic(t: string): string {
  return t
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The hadith title the server sent with this turn (field or show_ayat), if any. */
function hadithTitleOf(turn: ServerTurn): string | null {
  for (const a of turn.actions) if (a.type === 'show_ayat' && a.hadithTitle) return a.hadithTitle;
  return turn.hadithTitle;
}

/**
 * The spoken words -> the closest quick reply (a quiz option): the option sharing
 * most words with what was said; null when nothing matches at all.
 */
export function closestReply(said: string, replies: readonly string[]): string | null {
  const words = new Set(
    normalizeArabic(said)
      .split(' ')
      .map((w) => w.replace(/^(و|ال|وال)/, ''))
      .filter((w) => w.length >= 2),
  );
  let best: string | null = null;
  let bestScore = 0;
  for (const r of replies) {
    const n = normalizeArabic(r);
    const rw = n
      .split(' ')
      .map((w) => w.replace(/^(و|ال|وال)/, ''))
      .filter((w) => w.length >= 2);
    let score = rw.filter((w) => [...words].some((x) => x.includes(w) || w.includes(x))).length;
    if (n && normalizeArabic(said).includes(n)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}
