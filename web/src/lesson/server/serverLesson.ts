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
import {
  doneRefsOf,
  hadithLessonId,
  mappedStage,
  quranLessonId,
  type ServerProgressSink,
} from './progressMap';

// ── ports ──

export interface TeacherVoice {
  /**
   * Says the line (in short pieces; `onPiece` fires as each one starts — the live
   * caption). Resolves when said or skipped; rejects with PlaybackBlocked when the
   * browser refuses audio before a tap.
   */
  speak(text: string, onPiece?: (piece: string) => void): Promise<void>;
  stop(): void;
  /** Wakes the voice service at lesson start (optional). */
  warm?(): void;
}

export interface UrlPlayer {
  /** Resolves at the end of the audio; rejects with PlaybackBlocked if autoplay is refused. */
  play(url: string): Promise<void>;
  stop(): void;
}

/** On-device speech presence — measured only, never stored or sent. */
export interface PresenceListener {
  waitForSpeech(signal: AbortSignal): Promise<'spoke' | 'silent' | 'denied'>;
}

/** Records one utterance (consent only). Null when nothing usable was heard. */
export interface UtteranceRecorder {
  record(signal: AbortSignal): Promise<Blob | null>;
}

/** The browser's speech recognition (consent only — Chrome sends the audio to Google). */
export interface SpeechInput {
  listen(signal: AbortSignal): Promise<string | null>;
}

export interface ServerLessonDeps {
  api: AgentApi;
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
  readonly caption: string;
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
  readonly canSpeak: boolean;
  readonly hearing: boolean;
  readonly nextSegment: TurnKind | null;
  readonly projects: readonly ActionItem[];
  readonly saveFailed: boolean;
  readonly paused: boolean;
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
  canSpeak: false,
  hearing: false,
  nextSegment: null,
  projects: [],
  saveFailed: false,
  paused: false,
};

/** The hadith text placeholder until a vetted source is approved (CLAUDE.md §3). */
export const HADITH_PLACEHOLDER = '[نص الحديث — يُعتمد لاحقًا من مصدر موثّق مع التخريج]';
/** Flip only after the product owner approves the server's hadith content. */
export const SERVER_HADITH_TEXT_APPROVED = false;

export const RATE_LIMIT_BACKOFF_MS = [4000, 8000, 16000, 30000];
const UNAVAILABLE_RETRY_MS = [1500, 4000];
const MAX_RESTARTS = 2;
const CONTINUE_TEXT = 'أكمل';
/** What the name stage gets instead of the child's name. */
export const NAME_STAND_IN = 'بطل';
const MAX_NAME_ANSWERS = 2;
/** Automatic listening rounds after each line before the mic waits for a tap. */
export const AUTO_LISTEN_TRIES = 2;
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
  private segHadithId: number | null = null;
  private hadithBefore: number[] | null = null;
  private pendingStage: ServerTurn | null = null;
  private unblock: (() => void) | null = null;
  private pausedByBackground = false;

  constructor(private readonly d: ServerLessonDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
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
    this.reference = null;
    if (!restarted) {
      this.segSurah = seg.kind === 'taseem' ? seg.surahNo : null;
      this.segHadithId = seg.kind === 'htaseem' ? seg.hadithId : null;
      this.pendingStage = null;
      this.hadithBefore =
        seg.kind === 'hadith' ? await this.d.api.completedHadith(this.d.deviceId).catch(() => null) : null;
    }
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
    console.warn('[gharsah] AI lesson → built-in lesson', (e as Error)?.message ?? e);
    this.cancelTurn();
    this.set({ phase: 'fallback', busy: false, expects: null });
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
    if (turn.surahNo !== null) this.segSurah = turn.surahNo;
    if (turn.hadithIds[0] !== undefined) this.segHadithId ??= turn.hadithIds[0];
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
      for (const a of turn.actions) {
        if (a.type === 'play_all') for (const u of a.urls) await this.recite(u, abort);
        if (a.type === 'play_ayah') {
          this.set({ currentAyah: a.ayah });
          await this.recite(a.url, abort);
        }
      }
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
            this.d.voice.speak(text, (piece) => !abort.signal.aborted && this.set({ caption: piece })),
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

  /** Waits for the child the way `expects` asks. */
  private async await(turn: ServerTurn, abort: AbortController): Promise<void> {
    if (turn.expects === 'none') return this.segmentEnded();
    const canSpeak = !!this.d.speechInput && this.d.consent && turn.expects !== 'repeat';
    this.set({ expects: turn.expects, quickReplies: turn.quickReplies, canSpeak });
    if (turn.expects === 'repeat') return this.listenForRepeat(abort);
    // Like a call: the child just answers — the mic opens by itself (consent only).
    if (canSpeak) await this.autoListen(abort);
  }

  /** Listens a couple of times after the teacher's line; then the mic waits for a tap. */
  private async autoListen(abort: AbortController): Promise<void> {
    for (let i = 0; i < AUTO_LISTEN_TRIES; i++) {
      if (abort.signal.aborted || this.state.value.busy) return;
      if (await this.listenOnce(abort)) return;
    }
  }

  /** One recognition; true when it produced an answer that was sent. */
  private async listenOnce(abort: AbortController): Promise<boolean> {
    const input = this.d.speechInput;
    if (!input) return false;
    this.set({ hearing: true });
    const text = await this.guard(abort, input.listen(abort.signal)).catch((e: unknown) => {
      if (e instanceof Cancelled) throw e;
      return null;
    });
    this.set({ hearing: false });
    const answer = text ? this.spokenAnswer(text) : null;
    if (!answer) return false;
    this.answer(answer);
    return true;
  }

  /** A spoken answer: a choice must match one of the buttons; free answers go as said. */
  private spokenAnswer(text: string): string | null {
    const s = this.state.value;
    const said = normalizeArabic(text);
    if (!said) return null;
    const match = s.quickReplies.find((q) => {
      const n = normalizeArabic(q);
      return n && (said.includes(n) || n.includes(said));
    });
    if (s.expects === 'choice') return match ?? null;
    return match ?? text.trim();
  }

  private async listenForRepeat(abort: AbortController): Promise<void> {
    this.set({ repeat: 'listening' });
    if (this.d.consent && this.d.recorder) {
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
        // Groq's transcription as the child's answer; else the presence-only path below.
        return this.send(score.available && score.transcription ? score.transcription : this.repeatText());
      }
      if (abort.signal.aborted) throw new Cancelled();
    }
    // On-device presence only (nothing stored or sent). «ردّدت» also works any time.
    for (;;) {
      const heard = await this.guard(abort, this.d.presence.waitForSpeech(abort.signal));
      if (heard === 'spoke') return this.send(this.repeatText());
      if (heard === 'denied') {
        this.set({ micDenied: true });
        return; // only «ردّدت» now
      }
    }
  }

  private repeatText(): string {
    return this.reference?.trim() || REPEATED_TEXT;
  }

  private async segmentEnded(): Promise<void> {
    await this.flushHadithProgress();
    this.set({ expects: null, quickReplies: [], repeat: 'idle' });
    const next = this.segments[this.segIndex + 1];
    if (next) {
      this.set({ phase: 'segmentDone', nextSegment: next.kind });
      return;
    }
    this.set({ phase: 'finished' });
    const projects = await this.d.api.actionItems(this.d.deviceId).catch(() => []);
    this.set({ projects });
  }

  // ── progress ──

  private saveProgress(turn: ServerTurn): void {
    const stage = mappedStage(turn);
    if (!stage) return;
    const lessonId = turn.kind === 'quran' ? quranLessonId(this.segSurah) : hadithLessonId(this.segHadithId);
    if (!lessonId) {
      if (turn.kind === 'hadith') this.pendingStage = turn; // the hadith id may come later
      return;
    }
    const update = {
      lessonId,
      stage,
      stepIndex: turn.stageIndex,
      doneRefs: doneRefsOf({ ...turn, surahNo: this.segSurah }, stage, this.d.ayahCount),
    };
    void this.d.sink.record(update).then(
      () => this.state.value.saveFailed && this.set({ saveFailed: false }),
      () => this.set({ saveFailed: true }),
    );
  }

  /** A hadith whose id never appeared: find it in /agent/progress (new since the start). */
  private async flushHadithProgress(): Promise<void> {
    const t = this.pendingStage;
    this.pendingStage = null;
    if (!t || this.segHadithId !== null) {
      if (t) this.saveProgress(this.turn ?? t);
      return;
    }
    const before = this.hadithBefore;
    const after = await this.d.api.completedHadith(this.d.deviceId).catch(() => null);
    const fresh = before && after ? after.filter((h) => !before.includes(h)) : [];
    if (fresh.length === 1) {
      this.segHadithId = fresh[0]!;
      this.saveProgress(this.turn ?? t);
    }
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

  /** «ردّدت» — one repeat without the mic (or without consent). */
  repeatTapped(): void {
    if (this.state.value.expects !== 'repeat' || this.state.value.busy) return;
    void this.send(this.repeatText());
  }

  /** The mic button on text/continue — the browser's recognition (consent only). */
  async speakAnswer(): Promise<void> {
    const s = this.state.value;
    const abort = this.turnAbort;
    if (!s.canSpeak || !abort || s.busy || s.hearing || !s.expects) return;
    await this.listenOnce(abort).catch(() => {});
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
