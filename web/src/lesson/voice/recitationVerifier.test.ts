import { describe, expect, it } from 'vitest';

import {
  canGiveWordFeedback,
  createRecitationVerifier,
  ENCOURAGE_RETRY,
  isWordJudgment,
  PresenceOnlyVerifier,
  REPEAT_MIN_SPEECH_MS,
  ServerVerifier,
} from './recitationVerifier';

describe('PresenceOnlyVerifier', () => {
  it('counts a repeat only after ≥ 0.6 s of real speech, and never knows the words', async () => {
    const v = new PresenceOnlyVerifier();
    expect(REPEAT_MIN_SPEECH_MS).toBe(600);
    expect(await v.verify({ voicedMs: 599 })).toEqual({ ok: false, confidence: 0, by: 'presence' });
    expect(await v.verify({ voicedMs: 600 })).toEqual({ ok: true, confidence: 0, by: 'presence' });
    expect(canGiveWordFeedback(await v.verify({ voicedMs: 5000 }))).toBe(false);
  });
});

describe('ServerVerifier (stub)', () => {
  const audio = new Blob(['x']);
  const reply =
    (body: unknown, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('is disabled when VITE_VERIFY_URL is empty', () => {
    expect(ServerVerifier.fromEnv({ VITE_VERIFY_URL: '' })).toBeNull();
    expect(ServerVerifier.fromEnv({})).toBeNull();
    expect(ServerVerifier.fromEnv({ VITE_VERIFY_URL: 'https://verify.test/v1' })).toBeInstanceOf(
      ServerVerifier,
    );
  });

  it('a confident server result may give word feedback; a low-confidence one may not', async () => {
    const sure = await new ServerVerifier(
      'https://v.test',
      reply({ ok: false, missed_words: ['أحد'], confidence: 0.93 }),
    ).verify({ voicedMs: 1500, audio }, 112, 1);
    expect(sure).toEqual({ ok: false, missedWords: ['أحد'], confidence: 0.93, by: 'server' });
    expect(canGiveWordFeedback(sure)).toBe(true);
    const unsure = await new ServerVerifier('https://v.test', reply({ ok: false, confidence: 0.4 })).verify(
      { voicedMs: 1500, audio },
      112,
      1,
    );
    expect(canGiveWordFeedback(unsure)).toBe(false);
  });

  it('no audio, an error or an unreadable reply → presence only (never invents words)', async () => {
    const down = new ServerVerifier('https://v.test', async () => {
      throw new Error('offline');
    });
    expect(await down.verify({ voicedMs: 900, audio }, 112, 1)).toEqual({
      ok: true,
      confidence: 0,
      by: 'presence',
    });
    const bad = new ServerVerifier('https://v.test', reply({ nope: true }));
    expect((await bad.verify({ voicedMs: 900, audio }, 112, 1)).by).toBe('presence');
    const fail = new ServerVerifier('https://v.test', reply({}, 500));
    expect((await fail.verify({ voicedMs: 900, audio }, 112, 1)).by).toBe('presence');
    let called = false;
    const noAudio = new ServerVerifier('https://v.test', async () => {
      called = true;
      return new Response('{}');
    });
    expect((await noAudio.verify({ voicedMs: 900 }, 112, 1)).by).toBe('presence');
    expect(called).toBe(false);
  });
});

describe('isWordJudgment', () => {
  it.each([
    'نسيت كلمة يا بطل! استمع مرة ثانية.',
    'فاتتك كلمة في آخر الآية',
    'أخطأت في كلمة أحد',
    'لا بأس، سنحاول مرة أخرى ببطء. (المحاولة 1 من 5)',
    'لا بأس، خذ وقتك ونحاول السورة كاملة مرة أخرى.',
    'ما قلت الكلمة الأخيرة',
  ])('flags «%s»', (line) => expect(isWordJudgment(line)).toBe(true));

  it.each([
    'ممتاز يا نجم! استمر على كذا. (المحاولة 1 من 5) استمع للآية 2، ثم ردّدها بصوتك.',
    'ما شاء الله! أتممت الآية بخمس محاولات.',
    'لا بأس، ننتقل للآية التالية. استمع جيدًا للآية 3',
    'نسمعها مرة ثانية من القارئ ونكمل',
    ENCOURAGE_RETRY,
  ])('lets «%s» through', (line) => expect(isWordJudgment(line)).toBe(false));
});

describe('createRecitationVerifier', () => {
  it('the verification model only with a URL; presence otherwise', () => {
    const url = { VITE_VERIFY_URL: 'https://verify.test/v1' };
    expect(createRecitationVerifier({ env: url })).toBeInstanceOf(ServerVerifier);
    expect(createRecitationVerifier({ env: { VITE_VERIFY_URL: '' } })).toBeInstanceOf(PresenceOnlyVerifier);
  });
});
