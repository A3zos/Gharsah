// ServerAskService against the fake AI server's «اسأل وجاوب» mode (ai/API_web.md §1.1).
import { AgentApi } from '../lesson/server/api';
import { FakeAgentServer, OPEN_FAREWELL } from '../lesson/server/testing/fakeServer';
import { ASK_RATE_LIMIT_WAIT_MS, ServerAskService, type AskLogEntry } from './serverAskService';

function setup(o: { lang?: 'ar' | 'en' | 'id'; childName?: string } = {}) {
  const server = new FakeAgentServer();
  const sleeps: number[] = [];
  const service = new ServerAskService({
    api: new AgentApi('https://ai.test', server.fetch, o.childName ? [o.childName] : []),
    deviceId: async () => 'dev-ask',
    gender: 'girl',
    lang: o.lang ?? 'ar',
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { server, service, sleeps };
}
const log = () => (globalThis as { __askLog?: AskLogEntry[] }).__askLog ?? [];

beforeEach(() => {
  (globalThis as { __askLog?: AskLogEntry[] }).__askLog = [];
});

test('starts mode "open" lazily — gender, device_id, lang, NO child_name — and asks with /agent/message', async () => {
  const { server, service } = setup({ lang: 'en' });
  expect(server.calls).toHaveLength(0);
  const r = await service.ask('Why do we fast?');
  expect(r).toEqual({ kind: 'answer', text: 'ANSWER(en): Why do we fast?', sources: [] });
  const [start, message] = server.calls;
  expect(start).toMatchObject({
    path: '/agent/start',
    body: { mode: 'open', gender: 'girl', device_id: 'dev-ask', lang: 'en' },
  });
  expect(start!.body).not.toHaveProperty('child_name');
  expect(message).toMatchObject({
    path: '/agent/message',
    body: { session_id: 's1', text: 'Why do we fast?' },
  });
  // never the recitation scorer in this mode
  expect(server.calls.some((c) => c.path === '/agent/score-recitation')).toBe(false);
});

test('one session for the whole visit; warm() starts it when the screen opens', async () => {
  const { server, service } = setup();
  service.warm();
  await vi.waitFor(() => expect(server.calls.filter((c) => c.path === '/agent/start')).toHaveLength(1));
  await service.ask('لماذا نصلي؟');
  await service.ask('من هو النبي يونس؟');
  expect(server.calls.filter((c) => c.path === '/agent/start')).toHaveLength(1);
  expect(server.calls.filter((c) => c.path === '/agent/message').map((c) => c.body?.session_id)).toEqual([
    's1',
    's1',
  ]);
});

test('the goodbye: expects none → kind goodbye with the teacher’s farewell', async () => {
  const { service } = setup();
  await service.ask('لماذا نصلي؟');
  await expect(service.ask('مع السلامة')).resolves.toEqual({ kind: 'goodbye', text: OPEN_FAREWELL });
  expect(log().at(-1)).toMatchObject({ question: 'مع السلامة', status: 'goodbye' });
});

test('404 session expired → a fresh session, silently, and the same question again', async () => {
  const { server, service } = setup();
  await service.ask('أول سؤال');
  server.failures.push(['/agent/message', 404]);
  const r = await service.ask('ثاني سؤال');
  expect(r).toMatchObject({ kind: 'answer', text: 'ANSWER(ar): ثاني سؤال' });
  expect(server.calls.filter((c) => c.path === '/agent/start')).toHaveLength(2);
  expect(server.messages().slice(-1)).toEqual(['ثاني سؤال']);
  expect(log().at(-1)).toMatchObject({ status: 'restarted' });
});

test('429 → wait 3 s, retry once', async () => {
  const { server, service, sleeps } = setup();
  server.failures.push(['/agent/message', 429]);
  await expect(service.ask('سؤال')).resolves.toMatchObject({ kind: 'answer' });
  expect(sleeps).toEqual([ASK_RATE_LIMIT_WAIT_MS]);
  expect(log().at(-1)).toMatchObject({ status: 'rateLimited' });
});

test('any other failure rejects (the screen shows its friendly line) and is logged', async () => {
  const { server, service } = setup();
  server.failures.push(['/agent/start', 500]);
  await expect(service.ask('سؤال')).rejects.toThrow();
  expect(log().at(-1)).toMatchObject({ status: 'failed' });
  // the next question starts again
  await expect(service.ask('سؤال')).resolves.toMatchObject({ kind: 'answer' });
});

test('the child’s name never leaves the device (scrubbed by AgentApi); the log has text, latency, say — no audio', async () => {
  const { server, service } = setup({ childName: 'سارة' });
  await service.ask('اسمي سارة، لماذا نصلي؟');
  expect(JSON.stringify(server.calls)).not.toContain('سارة');
  const e = log().at(-1)!;
  expect(Object.keys(e).sort()).toEqual(['at', 'ms', 'question', 'say', 'status']);
  expect(e.say.length).toBeLessThanOrEqual(120);
  expect(typeof e.ms).toBe('number');
});
