// Port of app/test/lesson/lesson_content_test.dart — the shared content/ files.
import hadithJson from '@content/hadith/hadith.json';

import { Hadith, HADITH_PLACEHOLDER_TAKHRIJ, HADITH_PLACEHOLDER_TEXT, HadithRepository } from './hadith';
import { validateLessonScript } from './script';
import { line, TEACHER_CAPTIONS, TEACHER_LINES, TeacherLineBank } from './teacherLines';
import { loadScript, realMeta, SCRIPTS } from './testing/fakes';

const bank = new TeacherLineBank();
const meta = realMeta();

test('every lesson script parses, validates and uses known lines', () => {
  // Every file in content/lessons/ must be registered in SCRIPTS.
  const files = Object.keys(import.meta.glob('../../../content/lessons/*.json')).map((f) =>
    f.replace(/^.*\/(.*)\.json$/, '$1'),
  );
  expect(files.sort()).toEqual(Object.keys(SCRIPTS).sort());
  for (const id of files) {
    const script = loadScript(id);
    validateLessonScript(script, meta);
    for (const s of script.steps) {
      const ids =
        s.type === 'intro'
          ? s.lines
          : s.type === 'surah_done' || s.type === 'project_assign'
            ? [...s.lines, s.question]
            : s.type === 'project_report'
              ? [s.question]
              : s.type === 'lesson_end'
                ? [...s.lines, ...(s.question ? [s.question] : [])]
                : [];
      for (const id2 of ids) expect(id2 === 'greet' || bank.has(id2), `${id}: ${id2}`).toBe(true);
    }
  }
});

test('day-2 script is clearly marked interim', () => {
  expect(loadScript('m01-w03-day2').interim).toBe(true);
  expect(loadScript('m01-w03-ikhlas').interim).toBe(false);
});

test('no line states Makki/Madani or contains Quran/hadith text', () => {
  for (const t of [...Object.values(TEACHER_LINES), ...Object.values(TEACHER_CAPTIONS)]) {
    expect(t.includes('مكّية') || t.includes('مكية') || t.includes('مدنية'), t).toBe(false);
    expect(t.includes('﴿') || t.includes('«'), t).toBe(false);
  }
});

test('line bank fills slots and refuses unknown ids / missing slots', () => {
  expect(bank.resolve(line('praise.first', { name: 'سارة', ordinal: 'الثانية' }))).toBe(
    'أحسنت يا سارة… ننتقل للآية الثانية.',
  );
  expect(() => bank.resolve(line('nope'))).toThrow(TypeError);
  expect(() => bank.resolve(line('praise.first'))).toThrow(TypeError);
  expect(TeacherLineBank.ayatInWords(4)).toBe('أربع آيات');
  expect(TeacherLineBank.ayatInWords(286)).toBe('٢٨٦ آية');
  expect(TeacherLineBank.ordinal(3)).toBe('الثالثة');
});

describe('hadith approval gate', () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    id: 'h1',
    title: 'حديث برّ الوالدين',
    approved: true,
    text: 'T',
    takhrij: 'K',
    grading: 'G',
    source: 'S',
    reviewedBy: 'R',
    audio: 'audio/hadith/h1.mp3',
    ...over,
  });

  test('the shipped entry is the unapproved placeholder', () => {
    const h = HadithRepository.fromJson(hadithJson).byId('PLACEHOLDER-birr-alwalidayn');
    expect(h.isApproved).toBe(false);
    expect(h.canPlay).toBe(false);
    expect(h.displayText).toBe(HADITH_PLACEHOLDER_TEXT);
    expect(h.displayTakhrij).toBe(HADITH_PLACEHOLDER_TAKHRIJ);
  });

  test('a fully approved entry displays and plays', () => {
    const h = Hadith.fromJson(entry());
    expect(h.isApproved).toBe(true);
    expect(h.canPlay).toBe(true);
    expect(h.displayText).toBe('T');
    expect(h.displayTakhrij).toBe('K · G');
  });

  for (const missing of ['text', 'takhrij', 'grading', 'source', 'reviewedBy', 'audio']) {
    test(`approved but missing ${missing} → placeholder, silent`, () => {
      const h = Hadith.fromJson(entry({ [missing]: null }));
      expect(h.isApproved).toBe(false);
      expect(h.canPlay).toBe(false);
      expect(h.displayText).toBe(HADITH_PLACEHOLDER_TEXT);
    });
  }

  test('not approved → placeholder even if text is present', () => {
    const h = Hadith.fromJson(entry({ approved: false }));
    expect(h.displayText).toBe(HADITH_PLACEHOLDER_TEXT);
    expect(h.canPlay).toBe(false);
  });
});
