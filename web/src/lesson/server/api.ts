// The AI teacher server (ai/API_web.md) called straight from the browser — CORS
// allows the production origin. Only the documented child endpoints: /agent/*
// (never /agent/admin/*, /agent/pilot-report) and /speak. The removed /chat,
// /recite and /api/* are never called. No Supabase ids or tokens are ever sent —
// the only identifier is the per-child random device id (device.ts).
import {
  parseActionItems,
  parseCompletedHadith,
  parseReady,
  parseScore,
  parseTurn,
  type ActionItem,
  type AgentMode,
  type ReadyReview,
  type ScoreResult,
  type ServerTurn,
} from './parse';

export type Gender = 'boy' | 'girl';
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** 404 «session expired, please start again» — start a new session. */
export class SessionExpired extends Error {
  override name = 'SessionExpired';
}
/** 429 — too many requests; wait and retry. */
export class RateLimited extends Error {
  override name = 'RateLimited';
}
/** Network error, timeout, 5xx or an unreadable response. */
export class AgentUnavailable extends Error {
  override name = 'AgentUnavailable';
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Every path this client may call (anything else is a programming error). */
const ALLOWED = new Set([
  '/agent/status',
  '/agent/start',
  '/agent/message',
  '/agent/jump',
  '/agent/score-recitation',
  '/agent/progress',
  '/agent/actions',
  '/agent/actions/done',
  '/agent/surahs',
  '/agent/content',
  '/agent/taseem/start',
  '/agent/taseem/status',
  '/agent/htaseem/start',
  '/agent/htaseem/status',
  '/speak',
  '/speak/status',
]);

/** Render's free tier sleeps: the first request can take ~50 s. */
export const COLD_START_TIMEOUT_MS = 75_000;
const TURN_TIMEOUT_MS = 45_000;
const SCORE_TIMEOUT_MS = 30_000;
const SPEAK_TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 20_000;
/** How long the lesson waits for the server voice before using the browser's. */
export const SPEAK_WARM_TIMEOUT_MS = 45_000;
const speakReadiness = new Map<string, Promise<boolean>>();

export class AgentApi {
  private readonly base: string;

  private readonly redact: (text: string) => string;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
    /** The child's real name (and its parts) — scrubbed from everything the child says or types. */
    privateNames: readonly string[] = [],
  ) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.redact = nameRedactor(privateNames);
  }

  // ── lesson sessions ──

  start(o: { mode: AgentMode; gender: Gender; deviceId: string }): Promise<ServerTurn> {
    // No child_name: the server's default «يا بطل» keeps the name on the device.
    return this.turn('/agent/start', { mode: o.mode, gender: o.gender, device_id: o.deviceId }, o.mode, true);
  }

  message(sessionId: string, text: string, mode: AgentMode): Promise<ServerTurn> {
    // The child's words are the only free text we send: never with their name in it.
    return this.turn('/agent/message', { session_id: sessionId, text: this.redact(text), mode: null }, mode);
  }

  jump(sessionId: string, stage: string, mode: AgentMode): Promise<ServerTurn> {
    return this.turn('/agent/jump', { session_id: sessionId, stage }, mode);
  }

  taseemStart(o: { deviceId: string; gender: Gender; surahNo: number; chunk: number }): Promise<ServerTurn> {
    return this.turn(
      '/agent/taseem/start',
      { device_id: o.deviceId, gender: o.gender, surah_no: o.surahNo, chunk: o.chunk },
      'quran',
      true,
    );
  }

  htaseemStart(o: { deviceId: string; gender: Gender; hadithId: number }): Promise<ServerTurn> {
    return this.turn(
      '/agent/htaseem/start',
      { device_id: o.deviceId, gender: o.gender, hadith_id: o.hadithId },
      'hadith',
      true,
    );
  }

  /** Only while `expects === "repeat"` and with the parent's consent (the server stores the audio). */
  async scoreRecitation(sessionId: string, audioBase64: string): Promise<ScoreResult> {
    const r = await this.request('/agent/score-recitation', {
      method: 'POST',
      body: { session_id: sessionId, audio_base64: audioBase64 },
      timeoutMs: SCORE_TIMEOUT_MS,
    });
    return parseScore(await this.json(r));
  }

  // ── reads ──

  /** Wakes a sleeping server; true when it answers. */
  async status(timeoutMs = COLD_START_TIMEOUT_MS): Promise<boolean> {
    try {
      const r = await this.request('/agent/status', { timeoutMs });
      return r.ok;
    } catch {
      return false;
    }
  }

  async taseemReady(deviceId: string): Promise<ReadyReview[]> {
    return parseReady(await this.get('/agent/taseem/status', { device_id: deviceId }));
  }

  async htaseemReady(deviceId: string): Promise<ReadyReview[]> {
    return parseReady(await this.get('/agent/htaseem/status', { device_id: deviceId }));
  }

  async completedHadith(deviceId: string): Promise<number[]> {
    return parseCompletedHadith(await this.get('/agent/progress', { device_id: deviceId }));
  }

  async actionItems(deviceId: string): Promise<ActionItem[]> {
    return parseActionItems(await this.get('/agent/actions', { device_id: deviceId }));
  }

  async markActionDone(deviceId: string, hadithId: number): Promise<void> {
    const r = await this.request('/agent/actions/done', {
      method: 'POST',
      body: { device_id: deviceId, hadith_id: hadithId },
      timeoutMs: READ_TIMEOUT_MS,
    });
    await this.json(r);
  }

  /** The 114-surah index (the lesson itself only teaches the pilot surahs). */
  surahs(): Promise<unknown> {
    return this.get('/agent/surahs');
  }

  /** The server's content index (not needed by the conversation; informational). */
  content(): Promise<unknown> {
    return this.get('/agent/content');
  }

  // ── voice ──

  /** False when the server can't voice at all (then the browser's voice is used). */
  async speakAvailable(timeoutMs = READ_TIMEOUT_MS): Promise<boolean> {
    try {
      const r = await this.request('/speak/status', { timeoutMs });
      const j = (await this.json(r)) as { elevenlabs?: unknown } | null;
      return j?.elevenlabs === true;
    } catch {
      return false;
    }
  }

  /**
   * The server voice is ready (shared per server for the page: the child home starts
   * it, the lesson reuses it). Waits up to ~45 s for a cold start; a failure is not
   * cached, so the next lesson tries again.
   */
  speakReady(): Promise<boolean> {
    const known = speakReadiness.get(this.base);
    if (known) return known;
    const p = this.speakAvailable(SPEAK_WARM_TIMEOUT_MS).then((ok) => {
      if (!ok) speakReadiness.delete(this.base);
      return ok;
    });
    speakReadiness.set(this.base, p);
    return p;
  }

  /** The teacher's line as MP3, or null (any non-audio answer → the browser's voice). */
  async speak(text: string, gender: Gender): Promise<Blob | null> {
    try {
      const r = await this.request('/speak', {
        method: 'POST',
        body: { text, gender },
        timeoutMs: SPEAK_TIMEOUT_MS,
      });
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) return null;
      return await r.blob();
    } catch {
      return null;
    }
  }

  // ── plumbing ──

  private async turn(path: string, body: unknown, mode: AgentMode, cold = false): Promise<ServerTurn> {
    const r = await this.request(path, {
      method: 'POST',
      body,
      timeoutMs: cold ? COLD_START_TIMEOUT_MS : TURN_TIMEOUT_MS,
    });
    try {
      return parseTurn(await this.json(r), mode);
    } catch (e) {
      if (e instanceof SessionExpired || e instanceof RateLimited || e instanceof AgentUnavailable) throw e;
      throw new AgentUnavailable(`Unreadable response from ${path}: ${(e as Error).message}`);
    }
  }

  private async get(path: string, query?: Record<string, string>): Promise<unknown> {
    const r = await this.request(path, { query, timeoutMs: READ_TIMEOUT_MS });
    return this.json(r);
  }

  private async request(
    path: string,
    o: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string>; timeoutMs: number },
  ): Promise<Response> {
    if (!ALLOWED.has(path)) throw new Error(`Not an allowed AI endpoint: ${path}`);
    const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : '';
    let r: Response;
    try {
      r = await this.fetchImpl(`${this.base}${path}${qs}`, {
        method: o.method ?? 'GET',
        headers: o.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: AbortSignal.timeout(o.timeoutMs),
      });
    } catch (e) {
      throw new AgentUnavailable(`${path}: ${(e as Error).message || 'network error'}`);
    }
    if (r.status === 429) throw new RateLimited(path);
    if (r.status === 404 && (path === '/agent/message' || path === '/agent/jump'))
      throw new SessionExpired(path);
    if (!r.ok) throw new AgentUnavailable(`${path}: HTTP ${r.status}`, r.status);
    return r;
  }

  private async json(r: Response): Promise<unknown> {
    try {
      return await r.json();
    } catch {
      throw new AgentUnavailable('Response is not JSON');
    }
  }
}

/** VITE_AI_AGENT=1 + a base URL → the lesson runs on the AI server. */
export function agentBaseUrl(): string | null {
  if (import.meta.env.VITE_AI_AGENT !== '1') return null;
  const url = (import.meta.env.VITE_AI_BASE_URL as string | undefined)?.trim();
  return url ? url : null;
}

export const agentEnabled = (): boolean => agentBaseUrl() !== null;

/** Wakes a sleeping server when the child opens the app (fire and forget, once per page load). */
let warmed = false;
export function warmAgent(): void {
  const url = agentBaseUrl();
  if (!url || warmed) return;
  warmed = true;
  const api = new AgentApi(url);
  void api.status();
  void api.speakReady(); // so the first line is the teacher's real voice, not the browser's
}

/** Replaces the child's name in their own words with «بطل». */
export const NAME_REPLACEMENT = 'بطل';

/** Arabic diacritics and tatweel (regex source). */
const MARK_CLASS = String.raw`[ً-ٰٟـ]`;
const LETTER: Record<string, string> = {
  ا: '[اأإآٱ]',
  أ: '[اأإآٱ]',
  إ: '[اأإآٱ]',
  آ: '[اأإآٱ]',
  ٱ: '[اأإآٱ]',
  ي: '[يى]',
  ى: '[يى]',
  ة: '[ةه]',
  ه: '[ةه]',
};

/**
 * A function that removes the given names (whole words, any diacritics or
 * hamza/ya/ta-marbuta spelling, an attached و/ب/ل/ف/ك prefix) from a text.
 */
export function nameRedactor(names: readonly string[]): (text: string) => string {
  const words = [
    ...new Set(
      names
        .flatMap((n) => [n, ...n.split(/\s+/)])
        .map((w) => w.replace(new RegExp(MARK_CLASS, 'gu'), '').trim())
        .filter((w) => [...w].length >= 2),
    ),
  ].sort((a, b) => b.length - a.length);
  if (!words.length) return (t) => t;
  const esc = (c: string) => LETTER[c] ?? c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const between = `${MARK_CLASS}*`;
  const pattern = words
    .map((w) => [...w].map((c) => (/\s/.test(c) ? String.raw`\s+` : esc(c))).join(between))
    .join('|');
  const re = new RegExp(String.raw`(?<![\p{L}\p{M}])([وبلفك]?)(?:${pattern})(?![\p{L}\p{M}])`, 'giu');
  return (t) => t.replace(re, `$1${NAME_REPLACEMENT}`);
}
