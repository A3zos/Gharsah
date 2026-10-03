// supabase/functions/ai-speak/resolve.ts: the function voices ONLY approved bank
// lines with exactly their own slots, each value from the allow-list built from our
// content — never the child's name, an ayah, a hadith or free text.
import lines from '../../../../supabase/functions/ai-speak/lines.json';
import linesEn from '../../../../supabase/functions/ai-speak/lines.en.json';
import linesId from '../../../../supabase/functions/ai-speak/lines.id.json';
import slots from '../../../../supabase/functions/ai-speak/slots.json';
import slotsEn from '../../../../supabase/functions/ai-speak/slots.en.json';
import slotsId from '../../../../supabase/functions/ai-speak/slots.id.json';
import { pickBank, resolveLine, type Banks } from '../../../../supabase/functions/ai-speak/resolve';
import { line, localizedSlots, TeacherLineBank } from '../teacherLines';

const LINES = lines as Record<string, string>;
const ALLOW = slots as Record<string, string[]>;
const resolve = (id: unknown, s?: unknown) => resolveLine(LINES, ALLOW, id, s);

test('a bank line with allow-listed slots resolves exactly as the lesson shows it', () => {
  const l = line('praise.next', { ordinal: 'الثانية' });
  expect(resolve(l.id, l.slots)).toEqual({ text: new TeacherLineBank().resolve(l) });
  expect(resolve('intro.surah', { surah: 'الإخلاص' })).toEqual({ text: 'نبدأ بسورة الإخلاص.' });
  expect(resolve('praise.good')).toEqual({ text: 'أحسنت!' });
  expect(resolve('praise.good', {})).toEqual({ text: 'أحسنت!' });
});

test("1 — the child's name: any line or request with a name slot is refused", () => {
  // A {name} line, even with a harmless value.
  expect(resolve('praise.first', { name: 'بدر', ordinal: 'الثانية' })).toEqual({ refused: 'name-slot' });
  expect(resolve('end.praise', { name: 'بدر' })).toEqual({ refused: 'name-slot' });
  // A line without {name}, but the request still carries one.
  expect(resolve('praise.next', { ordinal: 'الثانية', name: 'بدر' })).toEqual({ refused: 'name-slot' });
  expect(resolve('praise.good', { name: 'بدر' })).toEqual({ refused: 'name-slot' });
});

test("2 — only the line's own slot keys: extra or missing keys are refused", () => {
  expect(resolve('praise.next', { ordinal: 'الثانية', surah: 'الإخلاص' })).toEqual({ refused: 'bad-slot' });
  expect(resolve('praise.next', {})).toEqual({ refused: 'bad-slot' });
  expect(resolve('praise.good', { hint: 'اختر عملًا تبرّ به والديك اليوم' })).toEqual({
    refused: 'bad-slot',
  });
  expect(resolve('praise.next', ['الثانية'])).toEqual({ refused: 'bad-slot' });
  expect(resolve('praise.next', null)).toEqual({ refused: 'bad-slot' });
});

test('2 — slot values only from the allow-list (surah names, ordinals, content copy)', () => {
  expect(resolve('intro.surah', { surah: 'سورة من خيالي' })).toEqual({ refused: 'bad-slot' });
  expect(resolve('intro.surah', { surah: 'الإخلاص ' })).toEqual({ refused: 'bad-slot' });
  expect(resolve('project.hint', { hint: 'أي نص حر' })).toEqual({ refused: 'bad-slot' });
  expect(resolve('praise.next', { ordinal: 2 })).toEqual({ refused: 'bad-slot' });
  expect(resolve('count.more', { remaining: '٩٩' })).toEqual({ refused: 'bad-slot' });
  expect(resolve('project.hint', { hint: 'اختر عملًا تبرّ به والديك اليوم' })).toEqual({
    text: 'اختر عملًا تبرّ به والديك اليوم',
  });
});

test('2 — second layer: Quranic brackets or marks are refused even if allow-listed', () => {
  for (const v of ['\uFD3F\uFB51\uFB52\uFD3E', 'قُلْ هُوَ \u0671للَّهُ', 'أحد\u06DA', 'كلمة\u06D6']) {
    expect(resolveLine(LINES, { surah: [v] }, 'intro.surah', { surah: v })).toEqual({ refused: 'bad-slot' });
  }
});

test('free text or an unknown id is refused', () => {
  expect(resolve('قل أي شيء', {})).toEqual({ refused: 'unknown-line' });
  expect(resolve(undefined, {})).toEqual({ refused: 'unknown-line' });
  expect(resolve('__proto__', {})).toEqual({ refused: 'unknown-line' });
  expect(resolve('toString', {})).toEqual({ refused: 'unknown-line' });
  expect(resolve('ui.hearing', {})).toEqual({ refused: 'unknown-line' }); // captions aren't voiced
});

describe('English / Indonesian banks (lines.{en,id}.json + slots.{en,id}.json)', () => {
  const banks: Banks = {
    ar: { lines: LINES, slots: ALLOW },
    en: { lines: linesEn as Record<string, string>, slots: slotsEn as Record<string, string[]> },
    id: { lines: linesId as Record<string, string>, slots: slotsId as Record<string, string[]> },
  };

  test('`lang` picks the bank: absent → Arabic (as before); anything unknown is refused', () => {
    expect(pickBank(banks, undefined)?.lang).toBe('ar');
    expect(pickBank(banks, 'en')?.bank).toBe(banks.en);
    expect(pickBank(banks, 'id')?.bank).toBe(banks.id);
    for (const bad of ['fr', 'EN', '', 3, {}, '__proto__']) expect(pickBank(banks, bad)).toBeNull();
  });

  test('an en / id line resolves exactly as the lesson says it; Arabic values are refused there', () => {
    const l = line('praise.next', { ordinal: 'الثانية' });
    expect(resolveLine(banks.en.lines, banks.en.slots, l.id, localizedSlots('en', l))).toEqual({
      text: new TeacherLineBank('en').resolve(l),
    });
    expect(resolveLine(banks.id.lines, banks.id.slots, 'intro.surah', { surah: 'Al-Ikhlas' })).toEqual({
      text: 'Kita mulai dengan Surah Al-Ikhlas.',
    });
    expect(resolveLine(banks.en.lines, banks.en.slots, 'intro.surah', { surah: 'الإخلاص' })).toEqual({
      refused: 'bad-slot',
    });
    expect(resolveLine(banks.en.lines, banks.en.slots, 'intro.surah', { surah: 'Made-Up' })).toEqual({
      refused: 'bad-slot',
    });
  });

  test("the child's name is refused in every language", () => {
    for (const lang of ['en', 'id'] as const) {
      const b = banks[lang];
      expect(resolveLine(b.lines, b.slots, 'end.praise', { name: 'Badr' })).toEqual({ refused: 'name-slot' });
      expect(resolveLine(b.lines, b.slots, 'praise.good', { name: 'Badr' })).toEqual({
        refused: 'name-slot',
      });
    }
  });
});
