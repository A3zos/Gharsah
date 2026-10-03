// The English / Indonesian teacher lines: every Arabic id has both, with the same
// slots; the Arabic bank resolves exactly as before; slot values are mapped to the
// language; a value with no translation keeps the whole line Arabic.
import { QURANIC } from '../../../supabase/functions/ai-speak/resolve';
import {
  hadithCopyIn,
  hadithLabelIn,
  line,
  lineLanguage,
  localizeSlot,
  projectCopyIn,
  resolveIn,
  surahNameIn,
  TEACHER_CAPTIONS,
  TEACHER_LINES,
  TeacherLineBank,
} from './teacherLines';
import {
  HADITH_COPY_I18N,
  OTHER_LANGS,
  PROJECT_COPY_I18N,
  SURAH_NAMES_LATIN,
  TEACHER_CAPTIONS_I18N,
  TEACHER_LINES_I18N,
} from './teacherLinesI18n';
import hadithJson from '@content/hadith/hadith.json';
import projectsJson from '@content/projects/projects.json';

const slotsOf = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const ARABIC_LETTER = /[؀-ۿ]/;

test.each(OTHER_LANGS)('%s: every Arabic line and caption id exists, with exactly its slots', (lang) => {
  expect(Object.keys(TEACHER_LINES_I18N[lang]).sort()).toEqual(Object.keys(TEACHER_LINES).sort());
  expect(Object.keys(TEACHER_CAPTIONS_I18N[lang]).sort()).toEqual(Object.keys(TEACHER_CAPTIONS).sort());
  for (const [id, ar] of Object.entries({ ...TEACHER_LINES, ...TEACHER_CAPTIONS })) {
    const t = TEACHER_LINES_I18N[lang][id] ?? TEACHER_CAPTIONS_I18N[lang][id]!;
    expect(slotsOf(t), `${lang} ${id}`).toEqual(slotsOf(ar));
    expect(ARABIC_LETTER.test(t), `${lang} ${id} has no Arabic`).toBe(false);
    expect(QURANIC.test(t)).toBe(false);
  }
});

test('Arabic resolves exactly as before (the default bank and resolveIn)', () => {
  const l = line('praise.first', { name: 'بدر', ordinal: 'الثانية' });
  expect(new TeacherLineBank().resolve(l)).toBe('أحسنت يا بدر… ننتقل للآية الثانية.');
  expect(new TeacherLineBank('ar').resolve(l)).toBe('أحسنت يا بدر… ننتقل للآية الثانية.');
  expect(resolveIn('ar', l)).toEqual({ text: 'أحسنت يا بدر… ننتقل للآية الثانية.', lang: 'ar' });
});

test('en / id: slot values are mapped (surah names, counts, ordinals, digits, content copy)', () => {
  const en = new TeacherLineBank('en');
  const id = new TeacherLineBank('id');
  expect(en.resolve(line('intro.surah', { surah: 'الإخلاص' }))).toBe("Let's start with Surah Al-Ikhlas.");
  expect(id.resolve(line('intro.surah', { surah: 'الفاتحة' }))).toBe('Kita mulai dengan Surah Al-Fatihah.');
  expect(en.resolve(line('intro.count', { countWords: TeacherLineBank.ayatInWords(4) }))).toBe(
    "It's short — only four ayat!",
  );
  expect(en.resolve(line('surah.proud', { countWords: TeacherLineBank.ayatInWords(4) }))).toBe(
    "You said four ayat in your own voice… I'm proud of you.",
  );
  expect(id.resolve(line('praise.next', { ordinal: TeacherLineBank.ordinal(2) }))).toBe(
    'Hebat! Kita lanjut ke ayat kedua.',
  );
  expect(en.resolve(line('praise.next', { ordinal: TeacherLineBank.ordinal(12) }))).toBe(
    'Excellent! On to the 12th ayah.',
  );
  expect(en.resolve(line('ayah.repeat_now', { times: TeacherLineBank.timesInWords(5) }))).toBe(
    'Now repeat it out loud… five times.',
  );
  expect(id.resolve(line('count.more', { remaining: '٤' }))).toBe('Bagus… tinggal 4 kali lagi.');
  expect(en.resolve(line('hadith.today', { topic: 'برّ الوالدين' }))).toBe(
    "Today's hadith is about kindness to parents.",
  );
  expect(id.resolve(line('project.hint', { hint: 'افعله بينك وبينهما' }))).toBe(
    'Lakukan cukup antara kamu dan mereka',
  );
  // the child's name passes through (on-device voice only)
  expect(en.resolve(line('end.praise', { name: 'Badr' }))).toBe(
    "Well done, Badr! You finished today's lesson.",
  );
  // captions too
  expect(id.resolve(line('ui.hearing'))).toBe('Aku mendengarkan…');
});

test('a slot value with no translation keeps the whole line Arabic (never half-translated)', () => {
  const l = line('hadith.today', { topic: 'موضوع لم يُترجم' });
  expect(resolveIn('en', l)).toEqual({ text: 'حديث اليوم عن موضوع لم يُترجم.', lang: 'ar' });
  expect(lineLanguage('en', l)).toBe('ar');
  expect(lineLanguage('en', line('praise.good'))).toBe('en');
  expect(lineLanguage('ar', line('praise.good'))).toBe('ar');
});

test('a missing slot still throws in every language', () => {
  expect(() => new TeacherLineBank('en').resolve(line('intro.surah'))).toThrow(TypeError);
});

test('our content has en / id copy (every hadith topic and project, every surah name)', () => {
  expect(SURAH_NAMES_LATIN).toHaveLength(114);
  expect(SURAH_NAMES_LATIN.slice(111)).toEqual(['Al-Ikhlas', 'Al-Falaq', 'An-Nas']);
  for (const lang of OTHER_LANGS) {
    for (const h of hadithJson.hadith) expect(HADITH_COPY_I18N[lang][h.id], `${lang} ${h.id}`).toBeDefined();
    for (const p of projectsJson.projects) {
      const c = PROJECT_COPY_I18N[lang][p.id];
      expect(c, `${lang} ${p.id}`).toBeDefined();
      expect(c!.hints).toHaveLength(p.hints.length);
    }
  }
});

test('display helpers: surah names, hadith topics and project copy in the UI language', () => {
  expect(surahNameIn('en', 'الناس')).toBe('An-Nas');
  expect(surahNameIn('ar', 'الناس')).toBe('الناس');
  expect(localizeSlot('id', 'surah', 'الفلق')).toBe('Al-Falaq');
  expect(hadithCopyIn('id', { title: 'حديث عن الغضب', topic: 'الغضب' }).topic).toBe('amarah');
  expect(hadithLabelIn('en', 'حديث برّ الوالدين')).toBe('Hadith on kindness to parents');
  expect(hadithLabelIn('en', 'غير معروف')).toBe('غير معروف');
  const p = projectsJson.projects[0]!;
  expect(projectCopyIn('en', p).hints[0]).toBe('Choose one good deed for your parents today');
  expect(projectCopyIn('ar', p)).toBe(p);
});
