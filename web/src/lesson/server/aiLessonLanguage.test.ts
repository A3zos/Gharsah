// The AI lesson follows the UI language (product owner, 2026-10-04) — and what the child
// recites stays Arabic.
import { AI_LESSON_FOLLOWS_UI, aiLessonLanguage } from '../../i18n/i18n';
import { BrowserSpeechInput, SPEECH_RECOGNITION_LANG } from '../web/serverPorts';
import { AgentApi } from './api';
import { isHelpReply, safeReply, SKIP_AYAH, skipReply } from './serverLesson';
import { FakeAgentServer } from './testing/fakeServer';

test('an answer picked for the child is never «I need help»', () => {
  expect(isHelpReply('Yes, I need help')).toBe(true);
  expect(isHelpReply('Ya, aku butuh bantuan')).toBe(true);
  expect(isHelpReply('نعم أحتاج مساعدة')).toBe(true);
  expect(safeReply(['Yes, I need help', 'No', "I'm okay"])).toBe('No');
  expect(safeReply(['Yes, I need help'])).toBe('تمام');
});

test("a non-Arabic repeat reference → the server's own skip (any language)", () => {
  expect(skipReply(['Let me recite the hadith again', 'Skip', 'I have a question.'])).toBe('Skip');
  expect(skipReply(['Ulangi hadis', 'Lewati', 'Aku punya pertanyaan'])).toBe('Lewati');
  expect(skipReply(['أعد الحديث', 'تخطّي', 'عندي سؤال'])).toBe('تخطّي');
  expect(skipReply([])).toBe(SKIP_AYAH);
});

test('the session language is the UI language', () => {
  expect(AI_LESSON_FOLLOWS_UI).toBe(true);
  expect(aiLessonLanguage('en')).toBe('en');
  expect(aiLessonLanguage('id')).toBe('id');
  expect(aiLessonLanguage('ar')).toBe('ar');
});

test('an English UI → /agent/start sends lang "en"', async () => {
  const server = new FakeAgentServer();
  const api = new AgentApi('https://ai.test', server.fetch);
  await api.start({ mode: 'quran', gender: 'boy', deviceId: 'dev-1', lang: aiLessonLanguage('en') });
  expect(server.calls[0]!.body).toEqual({ mode: 'quran', gender: 'boy', device_id: 'dev-1', lang: 'en' });
});

test('score-recitation: a recitation is always Arabic (forScore); free speech carries the session lang', async () => {
  const bodies: Record<string, unknown>[] = [];
  const api = new AgentApi('https://ai.test', async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ available: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  await api.scoreRecitation('s1', 'QUJD'); // default: a recitation
  await api.scoreRecitation('s1', 'QUJD', { forScore: true, lang: 'en' }); // a Quran recitation in an en session
  await api.scoreRecitation('s1', 'QUJD', { forScore: false, lang: 'en' }); // a translated hadith / free speech
  // lang on every body (the server reads it when forScore is false)
  expect(bodies).toEqual([
    { session_id: 's1', audio_base64: 'QUJD', forScore: true, lang: 'ar' },
    { session_id: 's1', audio_base64: 'QUJD', forScore: true, lang: 'en' },
    { session_id: 's1', audio_base64: 'QUJD', forScore: false, lang: 'en' },
  ]);
});

test('browser speech recognition: the session language for free speech, ar-SA for a recitation', () => {
  class FakeRecognition {
    lang = '';
    interimResults = false;
    maxAlternatives = 1;
    onresult = null;
    onerror = null;
    onend = null;
    start() {}
    abort() {}
  }
  (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
  try {
    const en = BrowserSpeechInput.create('en')!;
    expect(en.recognitionLang()).toBe('en-US');
    expect(en.recognitionLang(true)).toBe('ar-SA');
    expect(BrowserSpeechInput.create('id')!.recognitionLang()).toBe('id-ID');
    expect(BrowserSpeechInput.create('ar')!.recognitionLang()).toBe('ar-SA');
    expect(SPEECH_RECOGNITION_LANG).toEqual({ ar: 'ar-SA', en: 'en-US', id: 'id-ID' });
  } finally {
    delete (globalThis as { SpeechRecognition?: unknown }).SpeechRecognition;
  }
});
