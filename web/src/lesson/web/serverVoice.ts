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
import { supabase } from '../../supabase/client';
import { isBankLine, NAME_SLOT, slotKeysOf } from '../aiSpeakSlots';
import type { TeacherLine } from '../teacherLines';

/** A line waits at most this long for the server; later → the browser's voice. */
export const SERVER_VOICE_WAIT_MS = 4000;
/** After a server failure, the browser's voice only for this long, then try again. */
export const SERVER_VOICE_COOLDOWN_MS = 60_000;
const MAX_CACHED_LINES = 80;

/** POSTs a JSON body to ai-speak (injectable for tests). */
export type VoicePost = (body: Record<string, unknown>) => Promise<Response>;

export class ServerVoice {
  private readonly cache = new Map<string, Promise<Blob | null>>();
  private downUntil = 0;
  /** A warm-up or a late request is still out (cold start) — don't make lines wait. */
  private busy = 0;

  constructor(
    private readonly post: VoicePost,
    private readonly now: () => number = Date.now,
  ) {}

  /** Wakes the server at lesson load; if it can't voice (e.g. no key), skip it for a while. */
  warm(): void {
    this.busy++;
    void this.post({ warm: true })
      .then((r) => (r.ok ? (r.json() as Promise<{ ready?: boolean }>) : null))
      .then((j) => {
        if (j?.ready !== true) this.markDown();
      })
      .catch(() => this.markDown())
      .finally(() => this.busy--);
  }

  /** The line's MP3, or null → use the browser's voice for it. */
  async audioFor(line: TeacherLine, waitMs = SERVER_VOICE_WAIT_MS): Promise<Blob | null> {
    const sent = serverRequestFor(line);
    if (!sent) return null; // the child's name (or not a bank line) — stays on the device
    const key = JSON.stringify([sent.id, sent.slots]);
    const cached = this.cache.get(key);
    if (!cached && (this.busy > 0 || this.now() < this.downUntil)) return null;
    const p = cached ?? this.fetchLine(key, sent);
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

  private fetchLine(key: string, sent: { id: string; slots: Record<string, string> }): Promise<Blob | null> {
    const p = this.post(sent)
      .then(async (r) => {
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

/**
 * What goes to ai-speak for a line: its id + only the slots its template uses
 * (the agent attaches every slot, including the name, to every line). Null when
 * the line uses the child's name or isn't in the bank — the browser voices it.
 */
export function serverRequestFor(line: TeacherLine): { id: string; slots: Record<string, string> } | null {
  const keys = slotKeysOf(line.id);
  if (!isBankLine(line.id)) return null;
  if (keys.includes(NAME_SLOT)) return null;
  const slots: Record<string, string> = {};
  for (const k of keys) {
    const v = line.slots?.[k];
    if (v === undefined) return null;
    slots[k] = v;
  }
  return { id: line.id, slots };
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
    signal: AbortSignal.timeout(30_000),
  });
};

/** VITE_AI_VOICE=1 turns the server voice on; otherwise the browser's voice only. */
export const serverVoiceEnabled = () => import.meta.env.VITE_AI_VOICE === '1';
