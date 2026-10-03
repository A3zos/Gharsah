// The server voice never makes the lesson wait or go silent: every failure → null
// (the browser's voice), with a cooldown so a down server isn't retried per line.
import { LINE_LANG_HEADER as FUNCTION_LINE_LANG_HEADER } from '../../../../supabase/functions/ai-speak/resolve';
import { line } from '../teacherLines';
import {
  LINE_LANG_HEADER,
  SERVER_VOICE_COOLDOWN_MS,
  SERVER_VOICE_WAIT_MS,
  serverRequestFor,
  ServerVoice,
  type VoicePost,
} from './serverVoice';

const mp3 = () =>
  new Response(new Blob([new Uint8Array([1, 2, 3])]), { headers: { 'Content-Type': 'audio/mpeg' } });
const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function rig(answer: (body: Record<string, unknown>) => Promise<Response>) {
  let now = 0;
  const calls: Record<string, unknown>[] = [];
  const post: VoicePost = (b) => {
    calls.push(b);
    return answer(b);
  };
  const v = new ServerVoice(post, () => now);
  return { v, calls, advance: (ms: number) => (now += ms) };
}

test('sends only the line id + the slots it uses (never the name); caches the audio per line', async () => {
  const { v, calls } = rig(async () => mp3());
  // The agent attaches every slot to every line — only `ordinal` belongs to this one.
  const l = line('praise.next', { name: 'بدر', ordinal: 'الثانية', surah: 'الإخلاص' });
  expect(await v.audioFor(l)).toBeInstanceOf(Blob);
  expect(await v.audioFor(l)).toBeInstanceOf(Blob);
  expect(calls).toEqual([{ id: 'praise.next', slots: { ordinal: 'الثانية' } }]);
});

test("1 — a line that says the child's name is never sent: browser voice, no request", async () => {
  const { v, calls } = rig(async () => mp3());
  for (const l of [
    line('praise.first', { name: 'بدر', ordinal: 'الثانية' }),
    line('end.praise', { name: 'بدر' }),
    line('greet.morning', { name: 'بدر' }),
  ]) {
    expect(serverRequestFor(l)).toBeNull();
    expect(await v.audioFor(l)).toBeNull();
  }
  expect(calls).toEqual([]);
});

test('captions and unknown ids are never sent', async () => {
  const { v, calls } = rig(async () => mp3());
  expect(await v.audioFor(line('ui.hearing'))).toBeNull();
  expect(await v.audioFor(line('made.up'))).toBeNull();
  expect(calls).toEqual([]);
});

test('no audio (JSON note / 429 / 404 / timeout) → null, then browser voice until the cooldown ends', async () => {
  for (const res of [
    jsonRes(502, { error: 'ai-no-audio', note: 'no_key' }),
    jsonRes(502, { error: 'ai-no-audio', status: 429 }), // rate-limited upstream
    jsonRes(404, {}),
    jsonRes(504, { error: 'ai-timeout' }),
  ]) {
    const { v, calls, advance } = rig(async () => res.clone());
    expect(await v.audioFor(line('praise.good'))).toBeNull();
    expect(await v.audioFor(line('full.done'))).toBeNull();
    expect(calls).toHaveLength(1); // down → not retried per line
    advance(SERVER_VOICE_COOLDOWN_MS);
    await v.audioFor(line('full.done'));
    expect(calls).toHaveLength(2);
  }
});

test('network error → null', async () => {
  const { v } = rig(() => Promise.reject(new TypeError('Failed to fetch')));
  expect(await v.audioFor(line('praise.good'))).toBeNull();
});

test("slow (cold start) → null after the wait; later lines don't wait while it is still out", async () => {
  let release!: (r: Response) => void;
  const { v, calls } = rig((b) =>
    b.id === 'praise.good' ? new Promise<Response>((res) => (release = res)) : Promise.resolve(mp3()),
  );
  const first = v.audioFor(line('praise.good'));
  await vi.advanceTimersByTimeAsync(SERVER_VOICE_WAIT_MS);
  expect(await first).toBeNull();
  expect(await v.audioFor(line('full.done'))).toBeNull(); // immediately, no request
  expect(calls).toHaveLength(1);
  release(mp3());
  await vi.advanceTimersByTimeAsync(0);
  expect(await v.audioFor(line('praise.good'))).toBeInstanceOf(Blob); // cached when it came
  expect(await v.audioFor(line('full.done'))).toBeInstanceOf(Blob);
});

test('warm-up: not ready (no ElevenLabs) → browser voice for the cooldown', async () => {
  const { v, calls } = rig(async (b) => (b.warm ? jsonRes(200, { ready: false }) : mp3()));
  v.warm();
  await vi.advanceTimersByTimeAsync(0);
  expect(await v.audioFor(line('praise.good'))).toBeNull();
  expect(calls).toEqual([{ warm: true }]);
});

describe('English / Indonesian lines', () => {
  const tagged = (lang: string) =>
    new Response(new Blob([new Uint8Array([1, 2, 3])]), {
      headers: { 'Content-Type': 'audio/mpeg', 'X-Line-Lang': lang },
    });

  test('the client checks the same header the function sends', () => {
    expect(LINE_LANG_HEADER).toBe(FUNCTION_LINE_LANG_HEADER);
  });

  test('the request carries `lang` and the slot values in that language (never the name)', async () => {
    const { v, calls } = rig(async (b) => tagged(String(b.lang)));
    const l = line('praise.next', { name: 'بدر', ordinal: 'الثانية', surah: 'الإخلاص' });
    expect(await v.audioFor(l, 'en')).toBeInstanceOf(Blob);
    expect(await v.audioFor(line('intro.surah', { surah: 'الإخلاص' }), 'id')).toBeInstanceOf(Blob);
    expect(calls).toEqual([
      { id: 'praise.next', slots: { ordinal: 'second' }, lang: 'en' },
      { id: 'intro.surah', slots: { surah: 'Al-Ikhlas' }, lang: 'id' },
    ]);
    expect(serverRequestFor(line('end.praise', { name: 'Badr' }), 'en')).toBeNull();
  });

  test('audio without a matching X-Line-Lang (an older deployment) is refused → the browser voice', async () => {
    const { v, calls } = rig(async () => mp3()); // no X-Line-Lang at all
    expect(await v.audioFor(line('praise.good'), 'en')).toBeNull();
    // not asked again for English this session; Arabic still uses the server
    expect(await v.audioFor(line('full.done'), 'en')).toBeNull();
    expect(calls).toHaveLength(1);
    expect(await v.audioFor(line('full.done'))).toBeInstanceOf(Blob);
  });

  test('audio marked as another language is refused', async () => {
    const { v } = rig(async () => tagged('ar'));
    expect(await v.audioFor(line('praise.good'), 'id')).toBeNull();
  });

  test('a refusal without the header (the old function rejects English slot values) → browser voice', async () => {
    const { v, calls } = rig(async () => jsonRes(400, { error: 'not-an-approved-line', reason: 'bad-slot' }));
    expect(await v.audioFor(line('intro.surah', { surah: 'الإخلاص' }), 'en')).toBeNull();
    expect(await v.audioFor(line('praise.good'), 'en')).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test('a line whose slot has no translation is not sent in that language', async () => {
    const { v, calls } = rig(async (b) => tagged(String(b.lang)));
    expect(await v.audioFor(line('hadith.today', { topic: 'موضوع لم يُترجم' }), 'en')).toBeNull();
    expect(calls).toEqual([]);
  });
});

test('a line the function refuses (400) does not take the server down', async () => {
  const { v } = rig(async (b) =>
    b.id === 'stage.1' ? jsonRes(400, { error: 'not-an-approved-line', reason: 'bad-slot' }) : mp3(),
  );
  expect(await v.audioFor(line('stage.1'))).toBeNull();
  expect(await v.audioFor(line('praise.good'))).toBeInstanceOf(Blob);
});
