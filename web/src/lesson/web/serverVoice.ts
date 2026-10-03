// The teacher's server voice (VITE_AI_VOICE=1): approved lines voiced by the AI
// server's /speak, reached ONLY through our `ai-speak` Edge Function (the AI server
// has no auth — the browser never calls it). Only the line id + the slots that
// line uses are sent; the function resolves the text from the approved bank and
// an allow-list. Never an ayah or a hadith (the reciter plays those), never the
// child's audio, and never the child's name: a line with a {name} slot is not
// sent at all — the browser's voice says it on the device.
//
// Reliability first: any failure — timeout, Render cold start, 404/5xx, no ElevenLabs
// key — returns null and the SpeechTeacher uses the browser's voice for that line.
// The lesson never waits more than SERVER_VOICE_WAIT_MS on the server.
//
// English / Indonesian lines: the request carries `lang` and the slot values in that
// language; the audio is accepted ONLY when ai-speak answers `X-Line-Lang: <lang>`
// (an older deployment voices the Arabic bank → refused, the browser's voice is used).
import { supabase } from '../../supabase/client';
import { isBankLine, NAME_SLOT, slotKeysOf } from '../aiSpeakSlots';
import { localizedSlots, type LineLang, type TeacherLine } from '../teacherLines';

/** A line waits at most this long for the server; later → the browser's voice. */
export const SERVER_VOICE_WAIT_MS = 4000;
/** After a server failure, the browser's voice only for this long, then try again. */
export const SERVER_VOICE_COOLDOWN_MS = 60_000;
const MAX_CACHED_LINES = 80;

/** POSTs a JSON body to ai-speak (injectable for tests). */
export type VoicePost = (body: Record<string, unknown>) => Promise<Response>;

export class ServerVoice {
  private readonly cache = new Map<string, Promise<Blob | null>>();
  /** Languages the deployed function answered without a matching X-Line-Lang. */
  private readonly langUnsupported = new Set<LineLang>();
  private downUntil = 0;
  /** A warm-up or a late request is still out (cold start) — don't make lines wait. */
  private busy = 0;

  constructor(
    private readonly post: VoicePost,
    private readonly now: () => number = Date.now,
  ) {}

  private warming: Promise<boolean> | null = null;

  /** Wakes the server at lesson load; if it can't voice (e.g. no key), skip it for a while. */
  warm(): void {
    if (this.warming) return;
    this.busy++;
    this.warming = warmAiSpeak(this.post)
      .then((ready) => {
        if (!ready) this.markDown();
        return ready;
      })
      .finally(() => this.busy--);
  }

  /** Resolves when the warm-up is over (ready or not) — the lesson waits for it. */
  whenReady(): Promise<boolean> {
    this.warm();
    return this.warming!;
  }

  /**
   * The line's MP3 in `lang` (the language the line is voiced in), or null → use the
   * browser's voice for it.
   */
  async audioFor(
    line: TeacherLine,
    lang: LineLang = 'ar',
    waitMs = SERVER_VOICE_WAIT_MS,
  ): Promise<Blob | null> {
    if (this.langUnsupported.has(lang)) return null; // the deployed function has no bank in it
    const sent = serverRequestFor(line, lang);
    if (!sent) return null; // the child's name (or not a bank line) — stays on the device
    const key = JSON.stringify([lang, sent.id, sent.slots]);
    const cached = this.cache.get(key);
    if (!cached && (this.busy > 0 || this.now() < this.downUntil)) return null;
    const p = cached ?? this.fetchLine(key, sent, lang);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let late = false;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        late = true;
        resolve(null);
      }, waitMs);
    });
    const blob = await Promise.race([p, timeout]);
    clearTimeout(timer);
    if (late) {
      // Still coming (cold start): later lines use the browser until it answers.
      this.busy++;
      void p.finally(() => this.busy--);
    }
    return blob;
  }

  private fetchLine(key: string, sent: ServerLineRequest, lang: LineLang): Promise<Blob | null> {
    const p = this.post(sent)
      .then(async (r) => {
        // en / id: only an answer the function marks as that language (X-Line-Lang). An
        // older deployment voices the Arabic bank (or refuses the slots) without the
        // header → never play it for an English / Indonesian line; the browser's voice
        // says this language from now on.
        if (lang !== 'ar' && r.headers.get(LINE_LANG_HEADER) !== lang) {
          this.langUnsupported.add(lang);
          return null;
        }
        if (r.ok && (r.headers.get('content-type') ?? '').includes('audio')) return await r.blob();
        // 400 = not a bank line (only this line); anything else = the server can't voice now.
        if (r.status !== 400) this.markDown();
        return null;
      })
      .catch(() => {
        this.markDown();
        return null;
      })
      .then((b) => {
        if (!b) this.cache.delete(key);
        return b;
      });
    this.cache.set(key, p);
    if (this.cache.size > MAX_CACHED_LINES) this.cache.delete(this.cache.keys().next().value!);
    return p;
  }

  private markDown(): void {
    this.downUntil = this.now() + SERVER_VOICE_COOLDOWN_MS;
  }
}

/** The response header naming the language of ai-speak's audio (the line's bank). */
export const LINE_LANG_HEADER = 'X-Line-Lang';

/** A request body for ai-speak: Arabic = { id, slots } (unchanged); en / id add `lang`. */
export type ServerLineRequest = { id: string; slots: Record<string, string>; lang?: 'en' | 'id' };

/**
 * What goes to ai-speak for a line: its id + only the slots its template uses
 * (the agent attaches every slot, including the name, to every line) — for en / id,
 * the slot values in that language + `lang`. Null when the line uses the child's name,
 * isn't in the bank, or can't be said in `lang` — the browser voices it.
 */
export function serverRequestFor(line: TeacherLine, lang: LineLang = 'ar'): ServerLineRequest | null {
  const keys = slotKeysOf(line.id);
  if (!isBankLine(line.id)) return null;
  if (keys.includes(NAME_SLOT)) return null;
  const slots: Record<string, string> = {};
  for (const k of keys) {
    const v = line.slots?.[k];
    if (v === undefined) return null;
    slots[k] = v;
  }
  if (lang === 'ar') return { id: line.id, slots };
  let localized: Record<string, string> | null;
  try {
    localized = localizedSlots(lang, { id: line.id, slots });
  } catch {
    return null;
  }
  return localized ? { id: line.id, slots: localized, lang } : null;
}

/** The ai-speak Edge Function with the device's (anonymous) session. */
export const aiSpeakPost: VoicePost = async (body) => {
  const { data } = await supabase().auth.getSession();
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  return fetch(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/ai-speak`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${data.session?.access_token ?? anon}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50_000), // a Render cold start takes ~50 s
  });
};

/** VITE_AI_VOICE=1 turns the server voice on; otherwise the browser's voice only. */
export const serverVoiceEnabled = () => import.meta.env.VITE_AI_VOICE === '1';

let aiSpeakWarm: Promise<boolean> | null = null;

/**
 * Wakes ai-speak (and the AI server behind it) once per page — the child home starts
 * it, the lesson reuses it. A failed warm-up is not cached.
 */
export function warmAiSpeak(post: VoicePost = aiSpeakPost): Promise<boolean> {
  if (aiSpeakWarm) return aiSpeakWarm;
  const p = post({ warm: true })
    .then((r) => (r.ok ? (r.json() as Promise<{ ready?: boolean }>) : null))
    .then((j) => j?.ready === true)
    .catch(() => false)
    .then((ready) => {
      if (!ready) aiSpeakWarm = null;
      return ready;
    });
  aiSpeakWarm = p;
  return p;
}
