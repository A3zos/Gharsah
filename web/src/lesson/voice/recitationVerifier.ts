// Did the child really recite the ayah? One interface for every way of checking.
//
// * PresenceOnlyVerifier (used now): on-device voice activity only — the child spoke
//   for at least REPEAT_MIN_SPEECH_MS. It knows NOTHING about the words: `missedWords`
//   is never set and `confidence` is 0, so no word-level feedback may be spoken.
// * ServerVerifier (stub): the new recitation-verification model (VITE_VERIFY_URL —
//   empty = disabled). Not deployed yet; when it is, only a HIGH-confidence result may
//   produce word-level feedback (`canGiveWordFeedback`). It needs the child's audio.
//
// Until then the lesson must never claim a word-level mistake (see `isWordJudgment`).

/** On-device: a repeat counts only after this much real speech (energy above the adaptive threshold). */
export const REPEAT_MIN_SPEECH_MS = 600;
/** A server result at or above this confidence may name missed words. */
export const WORD_FEEDBACK_MIN_CONFIDENCE = 0.85;
/** /agent/score-recitation: a score below this (0..1), or any marked word = mistakes → word feedback allowed. */
export const RECITATION_PASS_SCORE = 0.6;

export interface RecitationAttempt {
  /** How long the child actually spoke (on-device presence). */
  readonly voicedMs: number;
  /** The recording — only for a server verifier. */
  readonly audio?: Blob | null;
}

export interface RecitationResult {
  /** The attempt counts as a repeat. */
  readonly ok: boolean;
  /** Words the model is sure were missed (server only, high confidence only). */
  readonly missedWords?: readonly string[];
  /** 0..1 — how sure the result is about the WORDS (presence-only: 0). */
  readonly confidence: number;
  /** Which verifier decided (for logs / tests). */
  readonly by: 'presence' | 'server';
}

export interface RecitationVerifier {
  verify(attempt: RecitationAttempt, surah: number, ayah: number | null): Promise<RecitationResult>;
}

/** Presence only (no words): real speech ≥ REPEAT_MIN_SPEECH_MS = a repeat. */
export class PresenceOnlyVerifier implements RecitationVerifier {
  constructor(private readonly minMs = REPEAT_MIN_SPEECH_MS) {}

  async verify(attempt: RecitationAttempt): Promise<RecitationResult> {
    return { ok: attempt.voicedMs >= this.minMs, confidence: 0, by: 'presence' };
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * STUB for the recitation-verification endpoint (not deployed yet). Expected reply:
 * `{ ok: boolean, missed_words?: string[], confidence: number }`. Any failure or an
 * unreadable reply falls back to presence (never blocks the lesson, never invents words).
 */
export class ServerVerifier implements RecitationVerifier {
  private readonly fallback = new PresenceOnlyVerifier();

  constructor(
    private readonly url: string,
    private readonly fetchFn: FetchLike = (i, o) => fetch(i, o),
    private readonly timeoutMs = 8000,
  ) {}

  /** VITE_VERIFY_URL → a ServerVerifier; empty / unset → null (disabled). */
  static fromEnv(env: Record<string, unknown> = import.meta.env): ServerVerifier | null {
    const url = typeof env.VITE_VERIFY_URL === 'string' ? env.VITE_VERIFY_URL.trim() : '';
    return url ? new ServerVerifier(url) : null;
  }

  async verify(attempt: RecitationAttempt, surah: number, ayah: number | null): Promise<RecitationResult> {
    if (!attempt.audio || ayah === null) return this.fallback.verify(attempt);
    try {
      const form = new FormData();
      form.append('surah', String(surah));
      form.append('ayah', String(ayah));
      form.append('audio', attempt.audio);
      const r = await this.fetchFn(this.url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!r.ok) return this.fallback.verify(attempt);
      const j = (await r.json()) as { ok?: unknown; missed_words?: unknown; confidence?: unknown };
      const confidence = typeof j.confidence === 'number' ? Math.min(1, Math.max(0, j.confidence)) : 0;
      if (typeof j.ok !== 'boolean') return this.fallback.verify(attempt);
      const missed = Array.isArray(j.missed_words)
        ? j.missed_words.filter((w): w is string => typeof w === 'string' && w.trim() !== '')
        : [];
      return { ok: j.ok, confidence, by: 'server', ...(missed.length ? { missedWords: missed } : {}) };
    } catch {
      return this.fallback.verify(attempt);
    }
  }
}

/** Word-level feedback («نسيت كلمة…») only from the server model, only when it is sure. */
export function canGiveWordFeedback(r: RecitationResult | null): boolean {
  return !!r && r.by === 'server' && r.confidence >= WORD_FEEDBACK_MIN_CONFIDENCE;
}

/**
 * A server line that judges the child's words or says the attempt failed — something
 * we can't verify on the device («نسيت كلمة», «فاتتك كلمة», «أخطأت», «سنحاول مرة أخرى»…).
 */
const JUDGMENT = [
  /نسيت/,
  /فاتت?(ك|كِ|ني)/,
  /فاتك/,
  /أخطأ|اخطأ|خطأ|غلط/,
  /ناقص|نقص(ت|تك)/,
  /أسقطت|سقطت/,
  /(ما|لم)\s+(تقل|تقول|قلت|نطقت|تنطق)/,
  /كلمة\s+(ناقصة|خاطئة|ضائعة)/,
  /تلعثم/,
  /(سنحاول|نحاول|نجرّب|نجرب|حاول)\s+[^.!؟]*مرة\s+(أخرى|ثانية)/,
];

export function isWordJudgment(text: string): boolean {
  const t = text.replace(/[ً-ٰٟ]/g, ''); // without diacritics
  return JUDGMENT.some((r) => r.test(t));
}

/**
 * The approved line said instead of an unverifiable judgment. No retry promised: the server
 * asks for each ayah ONCE and moves on (ai/API_web.md 2026-10-04).
 */
export const ENCOURAGE_LINE = 'أحسنت المحاولة!';

/**
 * The verifier a lesson uses when a repeat wasn't scored by /agent/score-recitation:
 * the verification model when VITE_VERIFY_URL is set; presence only otherwise.
 */
export function createRecitationVerifier(o: { env?: Record<string, unknown> } = {}): RecitationVerifier {
  return ServerVerifier.fromEnv(o.env) ?? new PresenceOnlyVerifier();
}
