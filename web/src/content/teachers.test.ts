import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { FRAMES, preloadTeacher } from '../components/child/teacherCharacter';
import { MESSAGES } from '../i18n/i18n';
import { AgentApi } from '../lesson/server/api';
import { arabicTeacher, getTeacher, TEACHERS, teacherName } from './teachers';

const LANGS = ['ar', 'en', 'id'] as const;
const GENDERS = ['boy', 'girl'] as const;

test("the teacher follows the UI language + the child's gender", () => {
  expect(getTeacher('ar', 'boy').folder).toBe('teacher-boy');
  expect(getTeacher('ar', 'girl').folder).toBe('teacher-girl');
  expect(getTeacher('en', 'boy').folder).toBe('teacher-en-boy');
  expect(getTeacher('en', 'girl').folder).toBe('teacher-en-girl');
  expect(getTeacher('id', 'boy').folder).toBe('teacher-id-boy');
  expect(getTeacher('id', 'girl').folder).toBe('teacher-id-girl');
  expect(teacherName(MESSAGES.ar, getTeacher('ar', 'boy'))).toBe('المعلم عبدالله');
  expect(teacherName(MESSAGES.ar, getTeacher('ar', 'girl'))).toBe('المعلمة سارة');
  expect(teacherName(MESSAGES.en, getTeacher('en', 'boy'))).toBe('Teacher Adam');
  expect(teacherName(MESSAGES.en, getTeacher('en', 'girl'))).toBe('Teacher Maryam');
  expect(teacherName(MESSAGES.id, getTeacher('id', 'boy'))).toBe('Ustaz Ahmad');
  expect(teacherName(MESSAGES.id, getTeacher('id', 'girl'))).toBe('Ustazah Aisyah');
  expect(arabicTeacher('girl')).toEqual(getTeacher('ar', 'girl'));
});

test.each(LANGS.flatMap((l) => GENDERS.map((g) => [l, g] as const)))(
  '%s / %s: all 7 frames exist; its name exists in every UI language',
  (lang, gender) => {
    const t = TEACHERS[lang][gender];
    for (const f of FRAMES)
      expect(
        existsSync(join(process.cwd(), 'public/characters', t.folder, `${f}.webp`)),
        `${t.folder}/${f}`,
      ).toBe(true);
    for (const ui of LANGS) expect(MESSAGES[ui].teachers[t.nameKey], `${ui} ${t.nameKey}`).toBeTruthy();
  },
);

test('preload: a teacher whose frames 404 → the Arabic teacher of the same gender', async () => {
  const RealImage = globalThis.Image;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = '';
    set src(v: string) {
      // the en teacher's frames are missing; the Arabic ones load
      setTimeout(() => (v.includes('/teacher-en-girl/') ? this.onerror?.() : this.onload?.()), 0);
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
  try {
    expect((await preloadTeacher(getTeacher('en', 'girl'))).folder).toBe('teacher-girl');
    expect((await preloadTeacher(getTeacher('id', 'boy'))).folder).toBe('teacher-id-boy');
  } finally {
    globalThis.Image = RealImage;
  }
});

test("/speak gets the teacher's voice_id only when one is configured", async () => {
  const bodies: unknown[] = [];
  const api = new AgentApi('https://ai.test', async (_u, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(new Blob(['mp3']), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  });
  await api.speak('Hello, champ!', 'boy', 'en', 'voice-en-m');
  await api.speak('Halo, jagoan!', 'girl', 'id');
  expect(bodies).toEqual([
    { text: 'Hello, champ!', gender: 'boy', lang: 'en', voice_id: 'voice-en-m' },
    { text: 'Halo, jagoan!', gender: 'girl', lang: 'id' },
  ]);
});
