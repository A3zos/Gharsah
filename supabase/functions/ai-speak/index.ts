// ai-speak: the teacher's voice from the AI server's /speak (ElevenLabs), for a
// PAIRED CHILD DEVICE only. The AI server has no auth, so the browser never calls
// it — only this function does, with the base URL from the AI_BASE_URL secret.
// Only /speak and /speak/status are used — never /agent/* (ai/API_web.md §3).
//
// What may be voiced: ONLY a line of the approved teacher-line bank (lines.json =
// web/src/lesson/teacherLines.ts TEACHER_LINES), resolved HERE from its id + slot
// values (resolve.ts): exactly the line's own slots, each value from the allow-list
// (slots.json — surah names, ayah counts, ordinals, hadith titles/topics, project
// copy; built from our content, web tests fail if either file drifts). Never an ayah,
// a hadith or free text. The child's name never leaves the device: a `name` slot is
// refused (those lines use the browser's voice). No child audio or id is sent.
//
// Languages: `lang` in the request — "ar" (default, lines.json + slots.json), "en"
// (lines.en.json + slots.en.json) or "id" (lines.id.json + slots.id.json); the same
// line ids, each bank mirrored from web/src/lesson (drift tests). Any other value is
// refused. The line is voiced in that language (`lang` to /speak), and every answer
// after the language is known carries `X-Line-Lang: <lang>` — the client plays en / id
// audio ONLY when that header matches (an older deployment has no header).
//
// Answers: 200 audio/mpeg, or JSON { error } — the client then uses the browser's
// voice. { warm: true } wakes the server (Render cold start) and returns { ready }.
import { admin, caller, cors, json } from '../_shared/http.ts';
import lines from './lines.json' with { type: 'json' };
import linesEn from './lines.en.json' with { type: 'json' };
import linesId from './lines.id.json' with { type: 'json' };
import slots from './slots.json' with { type: 'json' };
import slotsEn from './slots.en.json' with { type: 'json' };
import slotsId from './slots.id.json' with { type: 'json' };
import { LINE_LANG_HEADER, pickBank, resolveLine, type Banks } from './resolve.ts';

const BANKS: Banks = {
  ar: { lines: lines as Record<string, string>, slots: slots as Record<string, string[]> },
  en: { lines: linesEn as Record<string, string>, slots: slotsEn as Record<string, string[]> },
  id: { lines: linesId as Record<string, string>, slots: slotsId as Record<string, string[]> },
};
const AI_BASE_URL = (Deno.env.get('AI_BASE_URL') ?? '').replace(/\/+$/, '');
// The en / id teachers' voices (Teacher Adam / Maryam, Ustaz Ahmad / Ustazah Aisyah —
// web/src/content/teachers.ts): optional secrets VOICE_ID_{EN,ID}_{M,F}; unset → the
// server's default voice for that gender. Arabic keeps the server's current voices.
const VOICE_IDS: Record<string, Record<'boy' | 'girl', string | undefined>> = {
  en: { boy: Deno.env.get('VOICE_ID_EN_M') || undefined, girl: Deno.env.get('VOICE_ID_EN_F') || undefined },
  id: { boy: Deno.env.get('VOICE_ID_ID_M') || undefined, girl: Deno.env.get('VOICE_ID_ID_F') || undefined },
};
const SPEAK_TIMEOUT_MS = 20_000;
const WARM_TIMEOUT_MS = 45_000;
// /speak's voice follows the paired child's STORED gender (never a client value):
// boys hear المعلم عبدالله ('boy'), girls المعلمة سارة ('girl') — the same teacher
// the lesson screen shows.

/** The paired device's child gender → the teacher voice; null when not a paired device. */
async function pairedVoice(uid: string): Promise<'boy' | 'girl' | null> {
  const db = admin();
  const { data, error } = await db
    .from('child_sessions')
    .select('child_id')
    .eq('device_uid', uid)
    .maybeSingle();
  if (error || !data) return null;
  const { data: child } = await db.from('children').select('gender').eq('id', data.child_id).maybeSingle();
  return child?.gender === 'girl' ? 'girl' : 'boy';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method-not-allowed' });
  const user = await caller(req);
  if (!user) return json(req, 401, { error: 'unauthenticated' });
  const voice = user.is_anonymous ? await pairedVoice(user.id) : null;
  if (!voice) return json(req, 403, { error: 'not-paired' });
  if (!AI_BASE_URL) return json(req, 503, { error: 'ai-not-configured' });

  const body = await req.json().catch(() => ({}));

  if (body?.warm === true) {
    // GET /speak/status → { elevenlabs, voice, how, model, female_voice }
    try {
      const r = await fetch(`${AI_BASE_URL}/speak/status`, { signal: AbortSignal.timeout(WARM_TIMEOUT_MS) });
      const s = r.ok ? await r.json().catch(() => null) : null;
      return json(req, 200, { ready: s?.elevenlabs === true });
    } catch {
      return json(req, 200, { ready: false });
    }
  }

  const picked = pickBank(BANKS, body?.lang);
  if (!picked) return json(req, 400, { error: 'unsupported-lang' });
  const { lang, bank } = picked;
  // Every answer from here names its language (exposed to the browser for the client's check).
  const tagged = (res: Response) => {
    res.headers.set(LINE_LANG_HEADER, lang);
    res.headers.set('Access-Control-Expose-Headers', LINE_LANG_HEADER);
    return res;
  };

  const resolved = resolveLine(bank.lines, bank.slots, body?.id, body?.slots);
  if ('refused' in resolved) {
    return tagged(json(req, 400, { error: 'not-an-approved-line', reason: resolved.refused }));
  }
  const { text } = resolved;

  let r: Response;
  try {
    r = await fetch(`${AI_BASE_URL}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `lang` is in /speak's SpeakIn schema (default "ar")
      body: JSON.stringify({ text, gender: voice, lang, ...voiceIdFor(lang, voice) }),
      signal: AbortSignal.timeout(SPEAK_TIMEOUT_MS),
    });
  } catch (e) {
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return tagged(json(req, timeout ? 504 : 502, { error: timeout ? 'ai-timeout' : 'ai-unreachable' }));
  }
  const type = r.headers.get('content-type') ?? '';
  if (!r.ok || !type.includes('audio')) {
    // { audio: null, note: 'empty' | 'no_key' | 'tts_error', detail? }, or 404/429/5xx while it restarts.
    const note = type.includes('json') ? ((await r.json().catch(() => null))?.note ?? null) : null;
    return tagged(json(req, 502, { error: 'ai-no-audio', status: r.status, note }));
  }
  return tagged(
    new Response(r.body, {
      status: 200,
      headers: { ...cors(req), 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' },
    }),
  );
});

/** `voice_id` for an en / id teacher when its secret is set (nothing for Arabic). */
function voiceIdFor(lang: string, gender: 'boy' | 'girl'): { voice_id?: string } {
  const id = VOICE_IDS[lang]?.[gender];
  return id ? { voice_id: id } : {};
}
