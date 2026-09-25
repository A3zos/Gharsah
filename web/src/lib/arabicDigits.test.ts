import { normalizeDigit, toArabicDigits, toLatinDigits } from './arabicDigits';

// Same cases as app/test/arabic_digits_test.dart.
test('Latin and Persian digits become Arabic-Indic', () => {
  expect(toArabicDigits('472918')).toBe('٤٧٢٩١٨');
  expect(toArabicDigits('۴۷۲')).toBe('٤٧٢');
  expect(toArabicDigits('سورة طه · 114')).toBe('سورة طه · ١١٤');
});

test('Arabic-Indic digits become Latin', () => {
  expect(toLatinDigits('٤٧٢٩١٨')).toBe('472918');
});

test('int formatting', () => {
  expect(toArabicDigits(119)).toBe('١١٩');
});

test('normalizeDigit accepts any digit form, rejects others', () => {
  expect(normalizeDigit('7')).toBe('٧');
  expect(normalizeDigit('٧')).toBe('٧');
  expect(normalizeDigit('۷')).toBe('٧');
  expect(normalizeDigit('a')).toBeNull();
  expect(normalizeDigit('12')).toBeNull();
});
