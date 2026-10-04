// AI server update 2026-10-04: the recitation wait line text (GET /agent/status), POST /agent/warm,
// and the hadith project's voice check (POST /agent/actions/verify) — against the fake server.
import { AgentProjectVerifier, SERVER_HADITH_BY_PROJECT } from '../web/projectVerifier';
import { AgentApi, parseVerify, SCORE_TIMEOUT_MS } from './api';
import { FakeAgentServer } from './testing/fakeServer';
import {
  loadRecitationWaitSay,
  RECITATION_WAIT_FALLBACK,
  recitationWaitLine,
  resetRecitationWaitSay,
} from './waitLine';

beforeEach(() => {
  resetRecitationWaitSay();
  sessionStorage.clear();
});

describe('the recitation wait line', () => {
  it('GET /agent/status → recitation_wait_say, fetched once per app load and cached (memory + sessionStorage)', async () => {
    const server = new FakeAgentServer();
    server.waitSay = { ar: 'لحظات أقيّم ترديدك يا بطل', en: 'Hold on, evaluating…', id: 'Tunggu ya…' };
    const api = new AgentApi('https://ai.test', server.fetch);
    await loadRecitationWaitSay(api);
    await loadRecitationWaitSay(api);
    expect(server.calls.filter((c) => c.path === '/agent/status')).toHaveLength(1);
    expect(recitationWaitLine('ar')).toBe('لحظات أقيّم ترديدك يا بطل');
    expect(recitationWaitLine('en')).toBe('Hold on, evaluating…');
    expect(JSON.parse(sessionStorage.getItem('gharsah.ai.recitationWaitSay')!)).toMatchObject({
      id: 'Tunggu ya…',
    });
    // a reload in the same tab: from sessionStorage, no request
    resetRecitationWaitSay();
    await loadRecitationWaitSay(api);
    expect(server.calls.filter((c) => c.path === '/agent/status')).toHaveLength(1);
    expect(recitationWaitLine('id')).toBe('Tunggu ya…');
  });

  it('absent or failing → our fallbacks per language', async () => {
    const server = new FakeAgentServer();
    server.waitSay = null;
    await loadRecitationWaitSay(new AgentApi('https://ai.test', server.fetch));
    expect(recitationWaitLine('ar')).toBe('لحظات أقيّم لك ترديدك');
    resetRecitationWaitSay();
    server.failures.push(['/agent/status', 500]);
    await loadRecitationWaitSay(new AgentApi('https://ai.test', server.fetch));
    expect(recitationWaitLine('en')).toBe(RECITATION_WAIT_FALLBACK.en);
    expect(recitationWaitLine('id')).toBe('Sebentar, aku menilai bacaanmu');
  });

  it('the score-recitation client timeout is at least 35 s', () => {
    expect(SCORE_TIMEOUT_MS).toBeGreaterThanOrEqual(35_000);
  });

  it('POST /agent/warm (no body) wakes the recitation model', async () => {
    const server = new FakeAgentServer();
    await new AgentApi('https://ai.test', server.fetch).warmRecitation();
    expect(server.calls).toEqual([
      expect.objectContaining({ path: '/agent/warm', method: 'POST', body: null }),
    ]);
  });
});

describe('the hadith project voice check', () => {
  it('POST /agent/actions/verify: device_id, hadith_id, audio_base64, lang — no X-Device-Token', async () => {
    const server = new FakeAgentServer();
    const headers: (HeadersInit | undefined)[] = [];
    const api = new AgentApi('https://ai.test', async (url, init) => {
      headers.push(init?.headers);
      return server.fetch(url, init);
    });
    const r = await api.verifyAction({ deviceId: 'dev-1', hadithId: 9, audioBase64: 'QUJD', lang: 'en' });
    expect(server.calls[0]).toMatchObject({
      path: '/agent/actions/verify',
      body: { device_id: 'dev-1', hadith_id: 9, audio_base64: 'QUJD', lang: 'en' },
    });
    expect(JSON.stringify(headers)).not.toMatch(/X-Device-Token/i);
    expect(r).toEqual({ available: true, verified: true, message: 'تم', transcript: 'ساعدت أمي' });
  });

  it('parseVerify: verified / not verified (message exactly as received) / unavailable', () => {
    expect(
      parseVerify({ available: true, verified: false, message: 'المشروع لا يناسب فكرة الحديث' }),
    ).toEqual({
      available: true,
      verified: false,
      message: 'المشروع لا يناسب فكرة الحديث',
      transcript: null,
    });
    expect(parseVerify({ available: false })).toEqual({ available: false });
    expect(parseVerify('nope')).toEqual({ available: false });
  });

  const audio = { durationMs: 4000, blob: new Blob(['wav']) };
  const verifier = (server: FakeAgentServer, lang: 'ar' | 'en' | 'id' = 'ar') =>
    new AgentProjectVerifier({
      api: new AgentApi('https://ai.test', server.fetch),
      deviceId: async () => 'dev-1',
      lang,
      toBase64: async () => 'QUJD',
      busyMessage: {
        ar: 'الخدمة مشغولة الحين، جرّب بعد شوي يا بطل',
        en: 'The service is busy right now — try again in a little while, champ',
        id: 'x',
      }[lang],
    });

  it('our project → the server hadith id (برّ الوالدين = 9); verified / notVerified / unavailable', async () => {
    expect(SERVER_HADITH_BY_PROJECT['birr-3-acts']).toBe(9);
    const server = new FakeAgentServer();
    server.verifyAnswers.push(
      { available: true, verified: true, message: 'تم' },
      { available: true, verified: false, message: 'المشروع لا يناسب فكرة الحديث' },
      { available: false },
    );
    const v = verifier(server);
    await expect(v.verify({ projectId: 'birr-3-acts', audio })).resolves.toEqual({
      kind: 'verified',
      message: 'تم',
    });
    await expect(v.verify({ projectId: 'birr-3-acts', audio })).resolves.toEqual({
      kind: 'notVerified',
      message: 'المشروع لا يناسب فكرة الحديث',
    });
    await expect(v.verify({ projectId: 'birr-3-acts', audio })).resolves.toEqual({ kind: 'unavailable' });
    // never /agent/actions/done after a check
    expect(server.calls.some((c) => c.path === '/agent/actions/done')).toBe(false);
  });

  it('a failure → unavailable (logged, never thrown); an unknown project / no audio → skip', async () => {
    const server = new FakeAgentServer();
    server.failures.push(['/agent/actions/verify', 500]);
    const v = verifier(server, 'en');
    await expect(v.verify({ projectId: 'birr-3-acts', audio })).resolves.toEqual({ kind: 'unavailable' });
    await expect(v.verify({ projectId: 'unknown', audio })).resolves.toEqual({ kind: 'skip' });
    await expect(v.verify({ projectId: 'birr-3-acts', audio: { durationMs: 1 } })).resolves.toEqual({
      kind: 'skip',
    });
    expect(v.busyMessage).toBe('The service is busy right now — try again in a little while, champ');
    expect(verifier(server, 'ar').busyMessage).toBe('الخدمة مشغولة الحين، جرّب بعد شوي يا بطل');
  });
});
