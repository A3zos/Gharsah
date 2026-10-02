import { describe, expect, it } from 'vitest';

import { AgentApi, AgentUnavailable, RateLimited, SessionExpired, type FetchLike } from './api';
import { FakeAgentServer } from './testing/fakeServer';

const BASE = 'https://ai.test/';

function respond(status: number, body: unknown, type = 'application/json'): FetchLike {
  return async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': type },
    });
}

describe('AgentApi', () => {
  it('start sends mode, gender and device_id — never a name or our ids', async () => {
    const server = new FakeAgentServer();
    const api = new AgentApi(BASE, server.fetch);
    const t = await api.start({ mode: 'hadith', gender: 'girl', deviceId: 'dev-1' });
    expect(t.kind).toBe('hadith');
    expect(server.calls[0]).toMatchObject({ path: '/agent/start', method: 'POST' });
    expect(server.calls[0]!.body).toEqual({ mode: 'hadith', gender: 'girl', device_id: 'dev-1' });
  });

  it('message 404 → SessionExpired; 429 → RateLimited; 5xx / network / bad JSON → AgentUnavailable', async () => {
    await expect(
      new AgentApi(BASE, respond(404, { detail: 'session expired, please start again' })).message(
        's',
        'x',
        'quran',
      ),
    ).rejects.toBeInstanceOf(SessionExpired);
    await expect(new AgentApi(BASE, respond(404, {})).jump('s', 'greet', 'quran')).rejects.toBeInstanceOf(
      SessionExpired,
    );
    await expect(
      new AgentApi(BASE, respond(429, { detail: 'طلبات كثيرة' })).start({
        mode: 'quran',
        gender: 'boy',
        deviceId: 'd',
      }),
    ).rejects.toBeInstanceOf(RateLimited);
    await expect(
      new AgentApi(BASE, respond(502, 'bad gateway', 'text/html')).message('s', 'x', 'quran'),
    ).rejects.toBeInstanceOf(AgentUnavailable);
    await expect(
      new AgentApi(BASE, async () => Promise.reject(new TypeError('Failed to fetch'))).message(
        's',
        'x',
        'quran',
      ),
    ).rejects.toBeInstanceOf(AgentUnavailable);
    await expect(
      new AgentApi(BASE, respond(200, '<html>', 'text/html')).message('s', 'x', 'quran'),
    ).rejects.toBeInstanceOf(AgentUnavailable);
    await expect(
      new AgentApi(BASE, respond(200, { nope: 1 })).message('s', 'x', 'quran'),
    ).rejects.toBeInstanceOf(AgentUnavailable);
  });

  it('speak: audio → a Blob; JSON failure or error → null (browser voice)', async () => {
    const audio: FetchLike = async () =>
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } });
    expect(await new AgentApi(BASE, audio).speak('مرحبا', 'boy')).toBeInstanceOf(Blob);
    expect(
      await new AgentApi(BASE, respond(200, { audio: null, note: 'no_key' })).speak('x', 'boy'),
    ).toBeNull();
    expect(await new AgentApi(BASE, respond(500, {})).speak('x', 'boy')).toBeNull();
    expect(await new AgentApi(BASE, respond(200, { elevenlabs: false })).speakAvailable()).toBe(false);
    expect(await new AgentApi(BASE, respond(200, { elevenlabs: true })).speakAvailable()).toBe(true);
  });

  it('status is false (not a throw) when the server is down', async () => {
    expect(await new AgentApi(BASE, async () => Promise.reject(new Error('down'))).status()).toBe(false);
    expect(await new AgentApi(BASE, respond(200, { llm: true })).status()).toBe(true);
  });

  it('reads with device_id in the query', async () => {
    const server = new FakeAgentServer();
    const api = new AgentApi(BASE, server.fetch);
    await api.completedHadith('dev-9');
    await api.actionItems('dev-9');
    await api.markActionDone('dev-9', 6);
    expect(server.calls.map((c) => [c.path, c.query.device_id ?? c.body?.device_id])).toEqual([
      ['/agent/progress', 'dev-9'],
      ['/agent/actions', 'dev-9'],
      ['/agent/actions/done', 'dev-9'],
    ]);
  });

  it('never calls removed or admin endpoints', async () => {
    const api = new AgentApi(BASE, respond(200, {})) as unknown as {
      request(path: string, o: { timeoutMs: number }): Promise<Response>;
    };
    for (const p of [
      '/chat',
      '/recite',
      '/api/students',
      '/agent/admin/errors',
      '/agent/pilot-report',
      '/agent/device-token',
    ]) {
      await expect(api.request(p, { timeoutMs: 1000 })).rejects.toThrow(/Not an allowed AI endpoint/);
    }
  });

  it('a trailing slash in the base URL is fine', async () => {
    const server = new FakeAgentServer();
    await new AgentApi('https://ai.test///', server.fetch).status();
    expect(server.calls[0]!.path).toBe('/agent/status');
  });
});
