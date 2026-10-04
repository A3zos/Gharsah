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
// * The teacher always hears the child (PO, 2026-10-04 — disclosed at sign-up): free
//   speech → the browser's speech recognition (or, without it, the recorder → the
//   server's transcription); a recitation → the recorder → /agent/score-recitation.
//   The mic is asked for once at the start of the call; refused → on-device presence
//   only (the reference text the server gave is sent as the answer). Only transcripts
//   are logged, never audio.
// * Silence is never praised: a silent repeat → a nudge + the ayah again; silent
//   again → a neutral line, the ayah once more, and «تخطّي الآية» (no «repeated»
//   signal); that ayah is «لم يُردَّد» for the parent and is not memorized.
// * No word-level judgment we can't verify: a server line like «نسيت كلمة» is
//   replaced by an approved encouragement unless the server's recitation score of that
//   attempt was low too (voice/recitationVerifier.ts).
// * Any server failure that a restart can't fix → `fallback` (the route then
//   runs the built-in lesson) so the child is never stuck.
import { changed, lessonLog } from '../lessonLog';
import { Observable } from '../observable';
import { PlaybackBlocked } from '../ports';
import {
  AgentUnavailable,
  RateLimited,
  SessionExpired,
  type AgentApi,
  type AgentLang,
  type Gender,
} from './api';
import type {
  ActionItem,
  AgentAction,
  AgentMode,
  AgentStage,
  Expects,
  ScoreResult,
  ServerTurn,
  TurnKind,
} from './parse';
import { doneRefsOf, hadithMatchesTopic, mappedStage, type ServerProgressSink } from './progressMap';
import type { ProgressStage } from '../web/progressSink';
import type { TeacherVoice } from '../voice/tts';
import {
  canGiveWordFeedback,
  ENCOURAGE_RETRY,
  isWordJudgment,
  PresenceOnlyVerifier,
  RECITATION_PASS_SCORE,
  REPEAT_MIN_SPEECH_MS,
  WORD_FEEDBACK_MIN_CONFIDENCE,
  type RecitationResult,
  type RecitationVerifier,
} from '../voice/recitationVerifier';

/** The lesson-facing voice port (voice/tts.ts — with the swappable TTS provider). */
export type { TeacherVoice } from '../voice/tts';

// ── ports ──

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
    opts?: {
      purpose?: 'repeat' | 'answer';
      minMs?: number;
      timeoutMs?: number;
      /** How long the child actually spoke (for the recitation verifier). */
      onVoiced?: (ms: number) => void;
    },
  ): Promise<'spoke' | 'silent' | 'denied'>;
  /** Ask for the mic — at the start of the call, and inside the «سماح» tap. */
  requestAccess?(): Promise<boolean>;
  /** The mic permission as the browser knows it now (no prompt). */
  permission?(): Promise<'granted' | 'denied' | 'prompt'>;
}

/** Records one utterance. Null when nothing usable was heard. */
export interface UtteranceRecorder {
  record(signal: AbortSignal): Promise<Blob | null>;
}

/** The browser's speech recognition (Chrome sends the audio to Google). */
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
  /**
   * The AI server's quran stages run today (pilot.ts quranStages; undefined = all of them).
   * A stage not listed is skipped: before the recitation it is continued silently; after
   * the recitation it means the surah part is done → straight to the hadith.
   */
  quranStages?: readonly string[];
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
  /** The session language sent to /agent/start — every start and restart (default "ar"). */
  lang?: AgentLang;
  /**
   * Where today's lesson starts: the surah (default), or the hadith when today's surah
   * was already finished earlier TODAY (the route decides — data/student.ts surahDoneToday).
   */
  startAt?: 'quran' | 'hadith';
  /** Present when the browser can record (MediaRecorder). */
  recorder?: UtteranceRecorder | null;
  /** Did the child really recite? Presence only by default (voice/recitationVerifier.ts). */
  verifier?: RecitationVerifier;
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
  /** Dead-end guard: idle this long (nothing playing, listening or pending) → recover. false = off. */
  watchdog?: { idleMs: number; tickMs: number } | false;
  /** Waiting on the server (tests pass short ones): filler after `fillerMs`, a retry after `timeoutMs`. */
  waits?: { fillerMs: number; timeoutMs: number; longEveryMs?: number };
}

/** Idle (no audio, not listening, no request) this long = stuck → recover. */
export const WATCHDOG_IDLE_MS = 20_000;
/** Waiting on the server longer than this → the teacher's short filler (never a silent call). */
export const FILLER_AFTER_MS = 1200;
/** At most one filler in this window (a repeat's reply often takes ~1.5 s — no filler every ayah). */
export const FILLER_EVERY_MS = 20_000;
/** A wait that goes on (a slow server): a «getting it ready» line this far in, whatever the window above… */
export const FILLER_LONG_FIRST_MS = 3000;
/** …then this often until the reply. */
export const FILLER_LONG_EVERY_MS = 5000;
/** No answer from the server in this long → the request once more; still nothing → move on. */
export const SERVER_WAIT_MS = 15_000;
/** The server's quran stage of the ayah-by-ayah recitation (ai/API_web.md). */
const RECITATION_STAGE = 'recitation';
/** Skipped stages in a row before giving up on the day plan (a server that never moves on). */
const MAX_SKIPS = 4;

/** The server took longer than SERVER_WAIT_MS (twice). */
export class ServerSlow extends Error {
  constructor() {
    super('the AI server did not answer in time');
  }
}
const WATCHDOG_TICK_MS = 1000;
/** State fields logged on every transition. */
const LOGGED: readonly (keyof ServerLessonState)[] = [
  'phase',
  'segment',
  'stageIndex',
  'expects',
  'busy',
  'speaking',
  'reciting',
  'repeat',
  'hearing',
  'currentAyah',
  'paused',
  'micPrompt',
  'playbackBlocked',
  'listenOnly',
];

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
  /** The surah shown (for its translation in English / Indonesian). */
  readonly surahNo: number | null;
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
  surahNo: null,
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
// a timeout / 5xx: the last server call is retried ONCE, then the part ends (hadith: a
// closing line) or the built-in lesson takes over — never minutes of silence
const UNAVAILABLE_RETRY_MS = [1500];
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
const ARABIC_LETTER = /[\u0621-\u064A]/;

const HELP = /\bhelp\b|bantuan|tolong|مساعد/i;
export const isHelpReply = (r: string) => HELP.test(r);

/** The first quick reply that doesn't ask for help («I'm okay», «No»…), else the default. */
export function safeReply(replies: readonly string[]): string {
  return replies.find((r) => !isHelpReply(r)) ?? DEFAULT_ANSWER;
}

/** The server's own «skip» quick reply (any language), else the Arabic «تخطّي الآية». */
export function skipReply(replies: readonly string[]): string {
  return replies.find((r) => /skip|lewati|lompat|تخط/i.test(r)) ?? SKIP_AYAH;
}

/** What moves an en / id session on at a «continue» turn (its own translated button doesn't). */
export const CONTINUE_WORD: Record<'en' | 'id', string> = { en: 'continue', id: 'Lanjutkan' };

/** The hadith path's «which hadith?» stage (ai/API_web.md §1). */
const HADITH_CHOOSE_STAGE = 'intro';
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
  boy: 'أنا أسمعك… ردّدها بصوتك',
  girl: 'أنا أسمعكِ… ردّديها بصوتكِ',
};
/** Silent twice on a repeat: said before the ayah plays once more and the lesson moves on (no praise). */
export const MOVE_ON_UNREPEATED = 'نسمعها مرة ثانية من القارئ ونكمل';
/** After the reciter played the whole surah, before the repeats: the mic never opens silently. */
export const REPEATS_START: Record<Gender, string> = {
  boy: 'الحين نبدأ نردّد الآيات مع بعض… جاهز؟',
  girl: 'الحين نبدأ نردّد الآيات مع بعض… جاهزة؟',
};
/** The child answered REPEATS_START. */
export const REPEATS_START_REPLY = 'ممتاز! يلا نبدأ بالآية الأولى';
/** The whole surah was played and the child is asked to recite it. */
export const WHOLE_SURAH_TURN: Record<Gender, string> = {
  boy: 'الحين دورك… سمّعني السورة كاملة بصوتك',
  girl: 'الحين دورك… سمّعيني السورة كاملة بصوتكِ',
};
/** The server's own quick reply for moving past an ayah — never a «repeated» signal. */
export const SKIP_AYAH = 'تخطّي الآية';
// REVIEW: said once at the start of the call, right before the browser asks for the mic.
export const MIC_ASK: Record<Gender, string> = {
  boy: 'أهلًا يا بطل! عشان أسمعك وأنت تتكلّم وتقرأ، اسمح لي أستخدم المايك',
  girl: 'أهلًا يا بطلة! عشان أسمعكِ وأنتِ تتكلّمين وتقرئين، اسمحي لي أستخدم المايك',
};
// REVIEW: two fixed teacher lines of the day plan (surah → hadith).
/** Today's surah is done: said at once, while the hadith part is prepared. */
export const TO_HADITH: Record<Gender, string> = {
  boy: 'ما شاء الله يا بطل! خلّصت السورة. الحين نتعلّم حديثًا عن النبي ﷺ',
  girl: 'ما شاء الله يا بطلة! خلّصتِ السورة. الحين نتعلّم حديثًا عن النبي ﷺ',
};
// REVIEW: the filler while the server is slow (> FILLER_AFTER_MS).
export const FILLER: Record<Gender, string> = {
  boy: 'ممتاز… لحظة يا بطل',
  girl: 'ممتاز… لحظة يا بطلة',
};
// REVIEW: the server is still slow (every FILLER_LONG_EVERY_MS of a long wait).
export const FILLER_LONG: Record<Gender, string> = {
  boy: 'لحظات يا بطل، أجهّز لك الدرس…',
  girl: 'لحظات يا بطلة، أجهّز لكِ الدرس…',
};
/** The hadith part can't be served by the server: said, then the call ends (never a silent card). */
export const HADITH_LATER = 'أحسنت يا بطل! نكمل الحديث في المرة القادمة إن شاء الله';

/** The fixed lines above, by key (the teacher speaks to a boy / a girl where Arabic differs). */
export type FixedLine =
  | 'nudgeAnswer'
  | 'nudgeRepeat'
  | 'moveOnUnrepeated'
  | 'repeatsStart'
  | 'repeatsStartReply'
  | 'wholeSurahTurn'
  | 'toHadith'
  | 'hadithLater'
  | 'micAsk'
  | 'filler'
  | 'fillerLong';
type FixedLines = Record<FixedLine, string | Record<Gender, string>>;

/**
 * The fixed lines in each session language (the session's `lang` — the language the
 * AI server speaks too, so a call never mixes languages). Arabic = the constants above,
 * unchanged; English / Indonesian say the same thing (GLOSSARY.md: champ / jagoan).
 */
export const FIXED_LINES: Record<AgentLang, FixedLines> = {
  ar: {
    nudgeAnswer: NUDGE_ANSWER,
    nudgeRepeat: NUDGE_REPEAT,
    moveOnUnrepeated: MOVE_ON_UNREPEATED,
    repeatsStart: REPEATS_START,
    repeatsStartReply: REPEATS_START_REPLY,
    wholeSurahTurn: WHOLE_SURAH_TURN,
    toHadith: TO_HADITH,
    hadithLater: HADITH_LATER,
    micAsk: MIC_ASK,
    filler: FILLER,
    fillerLong: FILLER_LONG,
  },
  en: {
    nudgeAnswer: "I'm listening, champ — say it out loud",
    nudgeRepeat: "I'm listening… repeat it out loud",
    moveOnUnrepeated: "Let's hear it once more from the reciter, then carry on",
    repeatsStart: "Now let's repeat the ayat together… ready?",
    repeatsStartReply: "Excellent! Let's start with the first ayah",
    wholeSurahTurn: "Now it's your turn… recite the whole surah to me",
    toHadith:
      "Masha Allah, champ! You finished the surah. Now let's learn a hadith of the Prophet, peace and blessings be upon him",
    hadithLater: "Well done, champ! We'll continue the hadith next time, in sha Allah",
    micAsk: 'Hi champ! So I can hear you talk and recite, please let me use the microphone',
    filler: 'Great… one moment, champ',
    fillerLong: "Just a few seconds, champ, I'm getting it ready…",
  },
  id: {
    nudgeAnswer: 'Aku mendengarkan, jagoan — ucapkan dengan suaramu',
    nudgeRepeat: 'Aku mendengarkan… tirukan dengan suaramu',
    moveOnUnrepeated: 'Kita dengarkan sekali lagi dari qari, lalu kita lanjutkan',
    repeatsStart: 'Sekarang kita tirukan ayat-ayatnya bersama… siap?',
    repeatsStartReply: 'Hebat! Ayo kita mulai dari ayat pertama',
    wholeSurahTurn: 'Sekarang giliranmu… setorkan seluruh surahnya padaku',
    toHadith:
      "Masya Allah, jagoan! Kamu sudah menyelesaikan surahnya. Sekarang kita belajar hadis Nabi Muhammad shallallahu 'alaihi wa sallam",
    hadithLater: 'Bagus sekali, jagoan! Kita lanjutkan hadisnya lain kali, insya Allah',
    micAsk: 'Halo jagoan! Supaya aku bisa mendengarmu berbicara dan membaca, izinkan aku memakai mikrofon ya',
    filler: 'Bagus… sebentar ya, jagoan',
    fillerLong: 'Sebentar lagi, jagoan, aku sedang menyiapkannya…',
  },
};

/** A fixed line in the session language, for this child's gender. */
export function fixedLine(lang: AgentLang, key: FixedLine, gender: Gender): string {
  const l = (FIXED_LINES[lang] ?? FIXED_LINES.ar)[key];
  return typeof l === 'string' ? l : l[gender];
}

/**
 * The answer to the server's «أي حديث تحب أن نتعلم اليوم؟» (hadith stage `intro`):
 * today's hadith, never the first option — the server offers only hadiths this device
 * hasn't finished, and it accepts today's typed by name even when not offered.
 */
export function todayHadithAnswer(replies: readonly string[], topic: string): string {
  return replies.find((r) => hadithMatchesTopic(r, topic, normalizeArabic)) ?? topic;
}

/** What one listening window brought: the child spoke (and maybe their words). */
interface Heard {
  readonly spoke: boolean;
  readonly text: string | null;
  /** How long the child spoke (on-device presence). */
  readonly voicedMs?: number;
  /** A recitation's server score (0..1) — null when the server didn't score it. */
  readonly score?: number | null;
  /** The words the server marked (score-recitation tajweed_errors positions). */
  readonly marked?: readonly string[];
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
  /** What the child is asked to repeat (play_ayah text / the hadith), sent when nothing was transcribed. */
  private reference: string | null = null;
  private segSurah: number | null = null;
  private surahAnswers = 0;
  private listenOnly = false;
  private speechBroken = false;
  /** The mic was refused at the start: on-device presence only (no recorder, no recognition). */
  private voiceOff = false;
  /** The hadith session started (and its greeting / «which hadith?» answered) in the background. */
  private prewarm: Promise<ServerTurn> | null = null;
  /** A new segment's first turn replaces the last card (kept, dimmed, until then). */
  private freshSegment = false;
  /** Day-plan stages skipped in a row. */
  private skips = 0;
  private lastFillerAt = -Infinity;
  private quizUnscored = false;
  private allowAnswer: ((ok: boolean) => void) | null = null;
  private readonly verifier: RecitationVerifier;
  /** The last verifier result (word feedback is allowed only on a confident server one). */
  private lastVerify: RecitationResult | null = null;
  /** This segment's ayat the child stayed silent on — «لم يُردَّد», never memorized. */
  private notRepeated = new Set<number>();
  /** The session language (default "ar"). */
  private get lang(): AgentLang {
    return this.d.lang ?? 'ar';
  }
  /**
   * Ayat whose repeat the server answered with a comfort interjection instead of the next
   * repeat — its distress filter reads the ayah's own words («مِن شَرِّ…») as the child's.
   * The next repeat of such an ayah goes with the server's «تخطّي الآية» (the child DID
   * repeat it — presence — so it stays memorized on our side).
   */
  private interjected = new Set<number>();
  private lastRepeatAyah: number | null = null;
  /** A repeat turn was already played in this segment (the repeats have started). */
  private repeatsStarted = false;
  /** The last message sent answered a repeat (the next line may judge it). */
  private answeredRepeat = false;
  /** The reciter URLs of the current turn (replayed after a silence). */
  private turnAudio: string[] = [];
  private unblock: (() => void) | null = null;
  private pausedByBackground = false;

  constructor(private readonly d: ServerLessonDeps) {
    this.sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.beat = d.beat ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.verifier = d.verifier ?? new PresenceOnlyVerifier();
  }

  private set(patch: Partial<ServerLessonState>): void {
    if (this.disposed || this.halted) return;
    const before = this.state.value;
    const after = { ...before, ...patch };
    this.state.value = after;
    const diff = changed(before, after, LOGGED);
    if (diff) lessonLog('ai', 'state', diff);
  }

  // ── dead-end guard ──

  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private idleSince: number | null = null;
  /** Recoveries on the current turn: 1st → the turn again; 2nd → move on. */
  private rescues = 0;
  /** Fell back / disposed: nothing of this engine may run any more. */
  private halted = false;

  private startWatchdog(): void {
    const w = this.d.watchdog ?? { idleMs: WATCHDOG_IDLE_MS, tickMs: WATCHDOG_TICK_MS };
    if (!w || this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      if (!this.isIdle()) {
        this.idleSince = null;
        return;
      }
      const now = Date.now();
      this.idleSince ??= now;
      if (now - this.idleSince >= w.idleMs) {
        this.idleSince = null;
        this.rescue();
      }
    }, w.tickMs);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
  }

  /** Live, and nothing is happening: no audio, not listening, no request, no prompt. */
  private isIdle(): boolean {
    const s = this.state.value;
    return (
      !this.disposed &&
      !this.halted &&
      s.phase === 'live' &&
      !s.paused &&
      !s.busy &&
      !s.speaking &&
      !s.reciting &&
      s.repeat === 'idle' &&
      !s.hearing &&
      !s.micPrompt &&
      !s.playbackBlocked
    );
  }

  /** A dead end: say the current turn again; stuck again → move on (never a frozen screen). */
  private rescue(): void {
    const s = this.state.value;
    lessonLog('ai', 'STUCK — recovering', {
      stage: s.stages[s.stageIndex]?.id,
      expects: s.expects,
      rescue: this.rescues + 1,
    });
    const t = this.turn;
    if (!t) {
      void this.startSegment(false);
      return;
    }
    this.rescues++;
    if (this.rescues === 1) {
      void this.play(t);
      return;
    }
    // stuck twice on the same turn: move on — a repeat is skipped (never counted as repeated)
    const next =
      t.expects === 'repeat'
        ? SKIP_AYAH
        : t.expects === 'none'
          ? null
          : (t.quickReplies[0] ?? DEFAULT_ANSWER);
    if (next === null) void this.segmentEnded();
    else void this.send(next, false);
  }

  // ── lifecycle ──

  async start(): Promise<void> {
    lessonLog('ai', 'engine start', { gender: this.d.gender, lesson: this.d.plan.lessonId });
    this.startWatchdog();
    this.d.voice.warm?.();
    const warm = setTimeout(() => {
      if (this.state.value.phase === 'starting') this.set({ phase: 'warming' });
    }, this.d.warmingAfterMs ?? 3000);
    try {
      // Never start with the browser voice while the server voice is waking up:
      // «المعلم يتجهز…» until it is ready (≤ ~45 s) — the browser's only if it fails.
      await this.d.voice.ready?.();
      if (this.disposed) return;
      await this.askMic();
      if (this.disposed) return;
      this.segments = await this.plan();
      this.segIndex = 0;
      await this.startSegment(false);
    } finally {
      clearTimeout(warm);
    }
  }

  /** Taseem first (it needs the child's voice — not when the mic was refused), then quran, then hadith. */
  private async plan(): Promise<Segment[]> {
    const out: Segment[] = [];
    if (this.hears) {
      const [q, h] = await Promise.all([
        this.d.api.taseemReady(this.d.deviceId).catch(() => []),
        this.d.api.htaseemReady(this.d.deviceId).catch(() => []),
      ]);
      const tq = q.find((r) => r.surahNo !== undefined);
      if (tq) out.push({ kind: 'taseem', surahNo: tq.surahNo!, chunk: tq.chunk ?? 0 });
      const th = h.find((r) => r.hadithId !== undefined);
      if (th) out.push({ kind: 'htaseem', hadithId: th.hadithId! });
    }
    // the day plan, in order: today's surah, then today's hadith
    if (this.d.startAt === 'hadith') {
      lessonLog('ai', 'resume at the hadith (surah done earlier today)');
      this.set({ quranDone: true });
      out.push({ kind: 'hadith' });
    } else out.push({ kind: 'quran' }, { kind: 'hadith' });
    return out;
  }

  private async startSegment(restarted: boolean): Promise<void> {
    const seg = this.segments[this.segIndex]!;
    this.nameAnswers = 0;
    this.surahAnswers = 0;
    this.reference = null;
    this.notRepeated = new Set();
    this.interjected = new Set();
    this.lastRepeatAyah = null;
    this.repeatsStarted = false;
    this.answeredRepeat = false;
    this.segSurah = seg.kind === 'taseem' ? seg.surahNo : seg.kind === 'quran' ? this.d.plan.surahNo : null;
    this.set({
      busy: true,
      expects: null,
      segment: seg.kind,
      nextSegment: null,
      // the last card stays (dimmed while busy) until the new segment's first turn
      notice: restarted ? 'restarted' : null,
      ...(this.state.value.phase === 'segmentDone' ? { phase: 'live' as const } : {}),
    });
    this.freshSegment = true;
    this.skips = 0;
    const { deviceId, gender } = this.d;
    const warm = seg.kind === 'hadith' && !restarted ? this.prewarm : null;
    this.prewarm = null;
    if (warm) {
      const turn = await this.waiting(warm).catch((e: unknown) => {
        this.fallback(e);
        return null;
      });
      if (turn) await this.play(turn);
      return;
    }
    const turn = await this.call(
      () =>
        seg.kind === 'taseem'
          ? this.d.api.taseemStart({ deviceId, gender, surahNo: seg.surahNo, chunk: seg.chunk })
          : seg.kind === 'htaseem'
            ? this.d.api.htaseemStart({ deviceId, gender, hadithId: seg.hadithId })
            : this.d.api.start({ mode: seg.kind, gender, deviceId, lang: this.d.lang ?? 'ar' }),
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
    // The hadith part can't be served (wrong hadith, server down…): never the built-in
    // lesson's hadith card — a closing line, then the call ends; logged.
    if (this.segments[this.segIndex]?.kind === 'hadith' && !this.halted && !this.disposed) {
      void this.endGracefully(reason);
      return;
    }
    lessonLog('ai', 'FALLBACK → builtin', { reason });
    this.set({ phase: 'fallback', busy: false, expects: null, fallbackReason: reason });
    // One engine at a time: this one stops for good before the built-in lesson starts.
    this.halt();
  }

  private ending = false;

  private async endGracefully(reason: string): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    lessonLog('ai', 'HADITH UNAVAILABLE → graceful end', { reason });
    this.cancelTurn();
    this.stopWatchdog();
    this.set({
      busy: false,
      expects: null,
      quickReplies: [],
      repeat: 'idle',
      hearing: false,
      fallbackReason: reason,
    });
    const abort = new AbortController();
    this.turnAbort = abort;
    await this.say(this.fixed('hadithLater'), abort).catch(() => {});
    if (this.disposed) return;
    this.set({ phase: 'ended' });
    this.halt();
  }

  /** Stops everything this engine does: speech, audio, listening, requests, timers. */
  private halt(): void {
    if (this.halted) return;
    this.cancelTurn();
    this.stopWatchdog();
    this.d.api.abortAll?.();
    this.allowAnswer?.(false);
    this.allowAnswer = null;
    this.halted = true;
    lessonLog('ai', 'engine stopped');
  }

  /** True once this engine fell back or was disposed. */
  get stopped(): boolean {
    return this.halted || this.disposed;
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
    if (this.halted || this.disposed) return;
    if (turn !== this.turn) this.rescues = 0;
    this.cancelTurn();
    const abort = new AbortController();
    this.turnAbort = abort;
    // our repeat of an ayah was answered with a comfort line, not the next repeat
    if (
      this.answeredRepeat &&
      this.lastRepeatAyah !== null &&
      turn.kind === 'quran' &&
      turn.stage === 'recitation' &&
      turn.expects !== 'repeat'
    ) {
      this.interjected.add(this.lastRepeatAyah);
      lessonLog('ai', 'server interjected on a repeat → that ayah will be skipped', {
        ayah: this.lastRepeatAyah,
      });
    }
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
      // Today's surah is done and the server moved on to the next one: that is simply
      // the end of the Quran part (the hadith part follows) — never a fallback mid-lesson.
      if (this.state.value.quranDone) {
        lessonLog('ai', 'next surah offered after today’s → end of the Quran part', {
          surah: turn.surahNo,
        });
        this.turn = turn;
        return this.segmentEnded();
      }
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
    // The day's stage plan (pilot.ts quranStages).
    const run = this.d.plan.quranStages;
    if (turn.kind === 'quran' && run && !run.includes(turn.stage)) {
      const rec = turn.stages.findIndex((s) => s.id === RECITATION_STAGE);
      const at = turn.stages.findIndex((s) => s.id === turn.stage);
      // After the recitation: the surah part is done — straight to the hadith.
      if (rec >= 0 && at > rec) return this.surahDone(turn);
      // Before it (the meanings, …): continued silently, never voiced or shown.
      if (turn.expects !== 'none' && turn.expects !== 'repeat' && this.skips < MAX_SKIPS) {
        this.skips++;
        lessonLog('ai', 'stage skipped (day plan)', { stage: turn.stage });
        this.set({ busy: true, expects: null });
        return this.send(turn.quickReplies[0] ?? CONTINUE_TEXT);
      }
    }
    if (turn.kind === 'quran') this.skips = 0;
    // Arrived while ExitConfirm is open — resume() plays it.
    if (this.state.value.paused) {
      this.set({ busy: false });
      return;
    }

    const fresh = this.freshSegment ? { ayat: [], words: [], hadith: null, currentAyah: null } : {};
    this.freshSegment = false;
    this.set({
      ...fresh,
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
    const audio = turn.actions.flatMap((a) =>
      a.type === 'play_all' ? a.urls : a.type === 'play_ayah' ? [a.url] : [],
    );
    // a judgment line arrives without audio: the ayah the child just tried plays again
    const judged = this.judges(turn);
    if (audio.length) this.turnAudio = audio;
    const wholeSurah =
      turn.kind === 'quran' && turn.actions.some((a) => a.type === 'play_all' && a.urls.length > 1);
    try {
      for (const a of turn.actions) this.show(a, turn);
      const line = judged ? ENCOURAGE_RETRY : turn.say;
      if (line.trim()) await this.say(line, abort);
      const plays = audio.length > 0 || (judged && this.turnAudio.length > 0);
      if (line.trim() && plays) await this.guard(abort, this.beat(LINE_GAP_MS));
      for (const a of turn.actions) {
        if (a.type === 'play_all') for (const u of a.urls) await this.recite(u, abort);
        if (a.type === 'play_ayah') {
          this.set({ currentAyah: a.ayah });
          await this.recite(a.url, abort);
        }
      }
      if (judged && !audio.length) for (const u of this.turnAudio) await this.recite(u, abort);
      // After the reciter played the whole surah the mic never opens silently: the teacher speaks first.
      let startsRepeats = false;
      if (wholeSurah && turn.expects === 'repeat') await this.say(this.fixed('wholeSurahTurn'), abort);
      else if (wholeSurah && turn.expects !== 'none' && !this.repeatsStarted) {
        await this.say(this.fixed('repeatsStart'), abort);
        startsRepeats = true;
      }
      if (turn.expects === 'repeat') this.repeatsStarted = true;
      // a natural pause after the teacher's question, before listening
      if (turn.expects !== 'none') await this.guard(abort, this.beat(QUESTION_PAUSE_MS));
      await this.await(turn, abort, startsRepeats);
    } catch (e) {
      if (e instanceof Cancelled) return;
      // Never a silent dead end: log it; the watchdog recovers the turn.
      lessonLog('ai', 'turn failed', { error: String((e as Error)?.message ?? e) });
      this.set({ speaking: false, reciting: false, repeat: 'idle', hearing: false, busy: false });
    }
  }

  /**
   * The server's line judges the child's words («نسيت كلمة», «سنحاول مرة أخرى»…) right
   * after a repeat, and no confident verifier backs it → the approved encouragement instead.
   */
  private judges(turn: ServerTurn): boolean {
    if (!(turn.expects === 'repeat' || this.answeredRepeat)) return false;
    return isWordJudgment(turn.say) && !canGiveWordFeedback(this.lastVerify);
  }

  /** The teacher's line, voiced; the caption follows the piece being said. */
  /** A fixed client line in the session language (Arabic = the constants, unchanged). */
  private fixed(key: FixedLine): string {
    return fixedLine(this.d.lang ?? 'ar', key, this.d.gender);
  }

  private async say(text: string, abort: AbortController): Promise<void> {
    lessonLog('ai', 'voice start', { text: text.slice(0, 40) });
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
      lessonLog('ai', 'voice end');
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
    this.set({ ayat, currentAyah: current, surahName: this.d.surahName(surah), surahNo: surah });
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
      this.set({
        hadith: shownHadith(
          this.d.lang ?? 'ar',
          a.hadithTitle ?? turn.hadithTitle,
          a.source,
          this.d.plan.hadithTopic,
        ),
      });
      return;
    }
    // The whole surah asked for: the server's own text of it is the reference (never «ردّدت»).
    if (a.current === null && turn.expects === 'repeat' && a.ayat.some((x) => x.trim()))
      this.reference = a.ayat.filter((x) => x.trim()).join(' ');
    this.showSurah(a.current);
  }

  private async recite(url: string, abort: AbortController): Promise<void> {
    lessonLog('ai', 'audio start', { url: url.split('/').pop() });
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
      lessonLog('ai', 'audio end', { url: url.split('/').pop() });
      this.set({ reciting: false });
    }
  }

  /**
   * A pure voice call: after every line the mic opens by itself (no buttons, no text).
   *   recognition / the server's transcription -> the child's real words (a choice -> the closest option)
   *   otherwise -> on-device voice activity only (nothing recorded or sent): speech of
   *     >=0.6 s = an answer -> the first quick reply (or «تمام»); a choice -> the first
   *     option, marked «لم يُقيَّم» for the parent; a repeat counts by presence
   *   silence ~6 s -> one gentle nudge; silence again -> the lesson continues by itself
   *   mic blocked -> one «سماح» prompt; still blocked -> listen-only (auto-continue)
   */
  private async await(turn: ServerTurn, abort: AbortController, startsRepeats = false): Promise<void> {
    // A part's «done» turn ends it: the server would otherwise offer the next surah /
    // «حديث آخر» (and «أكتفي اليوم» trips its distress filter) — one surah + one hadith a day.
    if (turn.stage === 'done' && (turn.kind === 'quran' || turn.kind === 'hadith')) {
      lessonLog('ai', 'part done', { kind: turn.kind });
      return this.segmentEnded();
    }
    if (turn.expects === 'none') return this.segmentEnded();
    const repeat = turn.expects === 'repeat';
    // never the browser's speech recognition for a recitation
    const canSpeak =
      this.hears && !repeat && ((!!this.d.speechInput && !this.speechBroken) || !!this.d.recorder);
    this.set({ expects: turn.expects, quickReplies: turn.quickReplies, canSpeak });
    for (let misses = 0; ;) {
      const heard = await this.hear(turn, abort);
      if (heard !== 'silent' && heard.spoke) {
        if (!repeat) {
          // our «let's start» only when we don't know the child's words (they may have asked something)
          if (startsRepeats && !heard.text) await this.say(this.fixed('repeatsStartReply'), abort);
          return this.respond(turn, heard);
        }
        const v = await this.verifyRepeat(turn, heard);
        if (v.ok) return this.respond(turn, heard);
        if (++misses >= SILENCES_BEFORE_CONTINUE) return this.moveOnUnrepeated(turn, abort);
        if (v.by === 'server') {
          // the verification model heard it but didn't accept it: encourage, the ayah again
          await this.say(ENCOURAGE_RETRY, abort);
          await this.replayTurnAudio(abort);
        } else await this.nudge(turn, abort); // not enough real speech = as if silent (no praise)
        continue;
      }
      // Can't hear at all (mic blocked / listen-only): a repeat is never counted.
      if (heard !== 'silent') return repeat ? this.moveOnUnrepeated(turn, abort) : this.respond(turn, heard);
      if (++misses >= SILENCES_BEFORE_CONTINUE)
        return repeat ? this.moveOnUnrepeated(turn, abort) : this.respond(turn, { spoke: false, text: null });
      await this.nudge(turn, abort);
    }
  }

  /**
   * The child spoke on a repeat: does it count? Scored by the server → it counts (its
   * transcription goes to /agent/message), and word feedback is allowed only when that
   * score is low (`canGiveWordFeedback`). Otherwise presence: ≥ REPEAT_MIN_SPEECH_MS.
   */
  private async verifyRepeat(turn: ServerTurn, h: Heard): Promise<RecitationResult> {
    if (typeof h.score === 'number') {
      // the server marked a word, or scored it low (live: a wrong word → 60 + the word marked)
      const low = (h.marked?.length ?? 0) > 0 || h.score < RECITATION_PASS_SCORE;
      const r: RecitationResult = {
        ok: true,
        by: 'server',
        confidence: low ? WORD_FEEDBACK_MIN_CONFIDENCE : 0,
        ...(low && h.marked?.length ? { missedWords: h.marked } : {}),
      };
      lessonLog('ai', 'recitation scored', { score: h.score, low });
      this.lastVerify = r;
      return r;
    }
    const surah = this.segSurah ?? this.d.plan.surahNo;
    const r = await this.verifier
      .verify({ voicedMs: h.voicedMs ?? REPEAT_MIN_SPEECH_MS }, surah, turn.ayah)
      .catch(() => ({ ok: true, confidence: 0, by: 'presence' as const }));
    this.lastVerify = r;
    return r;
  }

  /**
   * Silent twice (or the child can't be heard): a neutral line, the ayah once more,
   * then the server's own «تخطّي الآية» — no «repeated» signal, no praise. The ayah
   * is «لم يُردَّد» for the parent and doesn't count as memorized.
   */
  private async moveOnUnrepeated(turn: ServerTurn, abort: AbortController): Promise<void> {
    await this.say(this.fixed('moveOnUnrepeated'), abort);
    await this.guard(abort, this.beat(LINE_GAP_MS));
    await this.replayTurnAudio(abort);
    if ((turn.kind === 'quran' || turn.kind === 'taseem') && turn.ayah !== null) {
      this.notRepeated.add(turn.ayah);
      this.saveProgress(turn);
    }
    return this.send(SKIP_AYAH, false);
  }

  private async replayTurnAudio(abort: AbortController): Promise<void> {
    for (const u of this.turnAudio) await this.recite(u, abort);
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
      // A recitation goes to the server for its transcription and score...
      if (repeat && this.hears && this.d.recorder) {
        const blob = await this.guard(abort, this.d.recorder.record(abort.signal)).catch((e: unknown) => {
          if (e instanceof Cancelled) throw e;
          return null;
        });
        if (blob) {
          this.set({ repeat: 'sending' });
          const toB64 = this.d.blobToBase64 ?? blobToBase64;
          const score = await this.guard(
            abort,
            // a recitation: always Arabic, whatever the session language (the server tries its Quran
            // model on Modal first, then Groq — up to ~6 s: the wait gets the fillers)
            this.waiting(
              toB64(blob).then((b) =>
                this.d.api.scoreRecitation(this.turn!.sessionId, b, { forScore: true }),
              ),
            ),
          ).catch((e: unknown) => {
            if (e instanceof Cancelled) throw e;
            return { available: false, transcription: null, score: null, marked: [] } as ScoreResult;
          });
          lessonLog('ai', 'heard (recitation)', {
            text: score.available ? score.transcription : null,
            score: score.score,
          });
          return {
            spoke: true,
            text: score.available ? score.transcription : null,
            score: score.available ? score.score : null,
            marked: score.marked,
          };
        }
        if (abort.signal.aborted) throw new Cancelled();
      }
      // ...and the child's words go to speech recognition.
      if (!repeat && this.hears && this.d.speechInput && !this.speechBroken) {
        const text = await this.guard(abort, this.d.speechInput.listen(abort.signal)).catch((e: unknown) => {
          if (e instanceof Cancelled) throw e;
          this.speechBroken = true; // unsupported / blocked -> on-device presence from now on
          return undefined;
        });
        if (text) {
          lessonLog('ai', 'heard (speech recognition)', { text });
          return { spoke: true, text };
        }
        if (text === null) return 'silent';
      }
      // No speech recognition (Firefox / Safari, or it broke): the recorder → the server's
      // transcription of free speech in the session language (forScore=false, API_web.md 2026-10-02).
      if (!repeat && this.hears && this.d.recorder && (!this.d.speechInput || this.speechBroken)) {
        const blob = await this.guard(abort, this.d.recorder.record(abort.signal)).catch((e: unknown) => {
          if (e instanceof Cancelled) throw e;
          return null;
        });
        if (blob) {
          const toB64 = this.d.blobToBase64 ?? blobToBase64;
          const lang = this.d.lang ?? 'ar';
          const score = await this.guard(
            abort,
            toB64(blob).then((b) =>
              this.d.api.scoreRecitation(this.turn!.sessionId, b, { forScore: false, lang }),
            ),
          ).catch((e: unknown) => {
            if (e instanceof Cancelled) throw e;
            return { available: false, transcription: null, score: null, marked: [] } as ScoreResult;
          });
          const text = score.available ? score.transcription?.trim() || null : null;
          lessonLog('ai', 'heard (server transcription)', { text });
          return { spoke: true, text };
        }
        if (abort.signal.aborted) throw new Cancelled();
      }
      // On-device voice activity only — measured, never recorded or sent.
      let voicedMs: number | undefined;
      const r = await this.guard(
        abort,
        this.d.presence.waitForSpeech(abort.signal, {
          purpose: repeat ? 'repeat' : 'answer',
          // a repeat counts only after real speech (energy above the adaptive threshold ≥0.6 s)
          minMs: repeat ? REPEAT_MIN_SPEECH_MS : ANSWER_MIN_SPEECH_MS,
          timeoutMs: SILENCE_MS,
          onVoiced: (ms) => (voicedMs = ms),
        }),
      );
      if (r === 'spoke') return { spoke: true, text: null, ...(voicedMs !== undefined ? { voicedMs } : {}) };
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
      this.cheer(); // only ever reached when the child really spoke (see await)
      this.lastRepeatAyah = turn.kind === 'quran' ? turn.ayah : null;
      // the server can't take this ayah's text (see `interjected`): its own skip
      if (turn.kind === 'quran' && turn.ayah !== null && this.interjected.has(turn.ayah))
        return this.send(SKIP_AYAH, true);
      const said = h.text?.trim() || this.repeatText();
      // What the child recites is Arabic. In an en / id session the server's hadith text is
      // its own translation — never sent back as a «repeat» (it reads it as a question and
      // loops, live 2026-10-04): its own skip instead (the child did repeat — presence).
      if (this.lang !== 'ar' && !ARABIC_LETTER.test(said)) {
        lessonLog('ai', 'repeat reference is not Arabic → the server’s skip', { stage: turn.stage });
        return this.send(skipReply(turn.quickReplies), true);
      }
      return this.send(said, true);
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
    const repeat = turn.expects === 'repeat';
    await this.say(this.fixed(repeat ? 'nudgeRepeat' : 'nudgeAnswer'), abort);
    if (repeat) {
      // «أنا أسمعك… ردّدها بصوتك» → the reciter once more → listen again
      await this.guard(abort, this.beat(LINE_GAP_MS));
      await this.replayTurnAudio(abort);
    }
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

  /** The child can be heard (the mic wasn't refused at the start). */
  private get hears(): boolean {
    return !this.voiceOff;
  }

  /**
   * The mic, asked for once at the start of the call with a friendly line (skipped when
   * the browser already allows it). Refused → on-device presence only, logged.
   */
  private async askMic(): Promise<void> {
    const p = this.d.presence;
    if (!p.requestAccess) return;
    const now = await (p.permission?.() ?? Promise.resolve('prompt' as const)).catch(() => 'prompt' as const);
    if (now === 'granted') return;
    let ok = false;
    if (now === 'prompt') {
      const abort = new AbortController();
      this.turnAbort = abort;
      await this.say(this.fixed('micAsk'), abort).catch(() => {});
      ok = await p.requestAccess().catch(() => false);
    }
    if (ok) return;
    this.voiceOff = true;
    this.listenOnly = true;
    this.set({ micDenied: true, listenOnly: true });
    lessonLog('ai', 'mic refused at the start → presence only (the lesson goes on by itself)', { now });
  }

  private async segmentEnded(): Promise<void> {
    this.set({ expects: null, quickReplies: [], repeat: 'idle' });
    this.cheer();
    const next = this.segments[this.segIndex + 1];
    if (next) {
      this.set({ phase: 'segmentDone', nextSegment: next.kind });
      if (next.kind === 'hadith') {
        // the hadith session gets ready WHILE the teacher praises (no gap after the line)
        this.prewarm ??= this.prewarmHadith();
        this.prewarm.catch(() => {}); // handled where it is awaited
        const abort = this.turnAbort ?? new AbortController();
        await this.say(this.fixed('toHadith'), abort).catch(() => {});
      }
      // a voice call: no «next» button — the next part starts by itself (the hadith right
      // after the praise line; anything else after a short pause)
      const pause = next.kind === 'hadith' ? LINE_GAP_MS : SEGMENT_PAUSE_MS;
      const abort = this.turnAbort;
      await (abort ? this.guard(abort, this.beat(pause)) : this.beat(pause));
      if (this.state.value.phase === 'segmentDone' && !this.state.value.paused) this.continueTapped();
      return;
    }
    this.set({ phase: 'finished' });
  }

  // ── progress ──

  /** Today's progress row — the same one the built-in lesson writes. */
  private saveProgress(turn: ServerTurn, forced?: ProgressStage): void {
    const stage = forced ?? mappedStage(turn);
    if (!stage) return;
    const { plan } = this.d;
    if (turn.kind === 'quran' && stage === 'hadith' && !this.state.value.quranDone)
      this.set({ quranDone: true });
    const update = {
      lessonId: plan.lessonId,
      stage,
      // Where the built-in lesson would resume: the start, the hadith, or the end.
      stepIndex: stage === 'done' ? plan.lastStepIndex : stage === 'hadith' ? plan.hadithStepIndex : 0,
      doneRefs: doneRefsOf(turn, stage, plan.surahNo, this.d.ayahCount, this.notRepeatedOf(plan.surahNo)),
      ...(this.quizUnscored && turn.kind === 'hadith' ? { quizUnscored: true } : {}),
      ...(this.notRepeated.size && this.segSurah === plan.surahNo
        ? { notRepeatedRefs: [...this.notRepeated].sort((a, b) => a - b).map((a) => `${plan.surahNo}:${a}`) }
        : {}),
    };
    void this.d.sink.record(update).then(
      () => this.state.value.saveFailed && this.set({ saveFailed: false }),
      () => this.set({ saveFailed: true }),
    );
  }

  /** Today's surah's silent ayat (only while this segment teaches it). */
  private notRepeatedOf(surah: number): ReadonlySet<number> {
    return this.segSurah === surah ? this.notRepeated : new Set();
  }

  // ── child input ──

  private async send(text: string, repeated = false): Promise<void> {
    const t = this.turn;
    if (!t || this.disposed || this.halted) return;
    // «أي حديث؟» — whatever answered it (voice, a tap, the watchdog): today's hadith
    if (t.kind === 'hadith' && t.stage === HADITH_CHOOSE_STAGE)
      text = todayHadithAnswer(t.quickReplies, this.d.plan.hadithTopic);
    // en / id «continue» turns: the server doesn't take its own translated button back
    // («Complete the lesson» → it chats instead of moving on — live 2026-10-04); a plain
    // continue word does. Arabic answers exactly as before.
    else if (
      t.expects === 'continue' &&
      this.lang !== 'ar' &&
      (text === t.quickReplies[0] || text === DEFAULT_ANSWER || text === CONTINUE_TEXT)
    )
      text = CONTINUE_WORD[this.lang];
    // en / id choices: the option's NUMBER — the server misreads its own translated option
    // text (its quiz answer trips the distress filter, live 2026-10-04) but takes «1», «2»…
    else if (t.expects === 'choice' && this.lang !== 'ar' && t.quickReplies.includes(text))
      text = String(t.quickReplies.indexOf(text) + 1);
    // An answer picked FOR the child (not their words) is never «I need help»: the server
    // would open an emotional-support talk on the child's behalf.
    if (text === t.quickReplies[0] && isHelpReply(text)) text = safeReply(t.quickReplies);
    lessonLog('ai', 'send', { stage: t.stage, expects: t.expects, repeated });
    // the reply to a repeat (or a skip) may judge it — see judges()
    this.answeredRepeat = repeated || (t.expects === 'repeat' && text === SKIP_AYAH);
    this.cancelTurn();
    this.set({ busy: true, expects: null, quickReplies: [], repeat: 'idle', hearing: false, notice: null });
    const mode = modeOf(this.segments[this.segIndex]!);
    const next = await this.waiting(
      this.call(() => this.patient(() => this.d.api.message(t.sessionId, text, mode))),
    );
    if (next) await this.play(next);
  }

  // ── the surah → the hadith ──

  /**
   * The recitation of today's surah is complete (the server's first stage after it):
   * the surah part is done — saved at once (a resume starts at the hadith), then the
   * praise line and the hadith, with no stage of the server's in between.
   */
  private async surahDone(turn: ServerTurn): Promise<void> {
    lessonLog('ai', 'surah recitation complete → hadith', { stage: turn.stage });
    this.set({ quranDone: true, busy: false });
    this.saveProgress(turn, 'hadith');
    return this.segmentEnded();
  }

  /**
   * The hadith session, started in the background: its greeting (the child was already
   * greeted), the name stand-in and «which hadith?» (today's) are answered silently, so
   * the child goes straight from the surah to the hadith's own first stage.
   */
  private async prewarmHadith(): Promise<ServerTurn> {
    const { deviceId, gender } = this.d;
    let t = await this.patient(() => this.d.api.start({ mode: 'hadith', gender, deviceId, lang: this.lang }));
    for (let i = 0; i < 4 && t.expects !== 'none'; i++) {
      const reply =
        t.stage === 'greet'
          ? safeReply(t.quickReplies.length ? t.quickReplies : [DEFAULT_ANSWER])
          : t.stage === 'name'
            ? NAME_STAND_IN
            : t.stage === HADITH_CHOOSE_STAGE
              ? todayHadithAnswer(t.quickReplies, this.d.plan.hadithTopic)
              : null;
      if (!reply) break;
      lessonLog('ai', 'hadith preamble answered in the background', { stage: t.stage });
      const sid = t.sessionId;
      t = await this.patient(() => this.d.api.message(sid, reply, 'hadith'));
    }
    return t;
  }

  // ── waiting on the server ──

  /**
   * A request that never leaves the call silent: no answer in SERVER_WAIT_MS → once
   * more; still nothing → ServerSlow (the lesson moves on — see call / fallback).
   */
  private async patient<T>(f: () => Promise<T>): Promise<T> {
    const limit = this.d.waits?.timeoutMs ?? SERVER_WAIT_MS;
    for (let attempt = 0; ; attempt++) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const slow = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ServerSlow()), limit);
      });
      try {
        return await Promise.race([f(), slow]);
      } catch (e) {
        if (!(e instanceof ServerSlow) || attempt >= 1 || this.disposed) throw e;
        lessonLog('ai', 'server slow → the request once more', { afterMs: limit });
      } finally {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Waits on the server, never silently: past FILLER_AFTER_MS a short filler (at most one
   * per FILLER_EVERY_MS — a repeat's reply often takes ~1.5 s); a wait that goes on gets a
   * «getting it ready» line at FILLER_LONG_FIRST_MS, then every FILLER_LONG_EVERY_MS. The
   * sprite keeps blinking meanwhile.
   */
  private async waiting<T>(p: Promise<T>): Promise<T> {
    let filler: Promise<void> | null = null;
    const quiet = () => {
      const s = this.state.value;
      return !(this.disposed || this.halted || s.paused || s.speaking || s.reciting);
    };
    const sayFiller = (key: 'filler' | 'fillerLong') => {
      this.lastFillerAt = Date.now();
      lessonLog('ai', 'waiting on the server → filler', { key });
      const prev = filler ?? Promise.resolve();
      filler = prev.then(() => this.say(this.fixed(key), new AbortController())).catch(() => {});
    };
    const first = this.d.waits?.fillerMs ?? FILLER_AFTER_MS;
    const every = this.d.waits?.longEveryMs ?? FILLER_LONG_EVERY_MS;
    const timer = setTimeout(() => {
      if (quiet() && Date.now() - this.lastFillerAt >= FILLER_EVERY_MS) sayFiller('filler');
    }, first);
    let long: ReturnType<typeof setInterval> | undefined;
    const longStart = setTimeout(() => {
      if (quiet()) sayFiller('fillerLong');
      long = setInterval(() => quiet() && sayFiller('fillerLong'), every);
    }, this.d.waits?.longEveryMs ?? FILLER_LONG_FIRST_MS);
    try {
      return await p;
    } finally {
      clearTimeout(timer);
      clearTimeout(longStart);
      clearInterval(long);
      if (filler) await filler; // the filler ends before the next line starts
    }
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
    void this.send(this.repeatText(), true);
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
    this.halt();
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
/**
 * The hadith card's title / source. In an en / id session the server sends ITS OWN
 * translation in these fields (not QuranEnc / HadeethEnc; ai/API_web.md 2026-10-03) —
 * never shown: today's topic from our content, no source.
 */
export function shownHadith(
  lang: AgentLang,
  title: string | null,
  source: string | null,
  topic: string,
): { title: string | null; source: string | null } {
  return lang === 'ar' ? { title, source } : { title: topic, source: null };
}

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
