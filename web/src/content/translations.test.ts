import quranEn from '@content/quran/translations/en.json';
import quranId from '@content/quran/translations/id.json';

import { normalizeArabic } from '../lesson/server/serverLesson';
import { hadithMatchesTopic } from '../lesson/server/progressMap';
import { ayahTranslation, hadithTranslation } from './translations';

test('ayah translations: QuranEnc text verbatim (footnote markers left out), with the source; none in Arabic', () => {
  const raw = (quranEn as { ayat: Record<string, { translation: string }> }).ayat['112:2']!.translation;
  const en = ayahTranslation('en', 112, 2)!;
  expect(en.text).toBe(raw.replace(/\[\d+\]/g, '').trim());
  expect(en.text).not.toMatch(/\[\d+\]/);
  expect(en.source).toMatch(/^QuranEnc — /);
  expect(en.sourceUrl).toBe('https://quranenc.com/en/browse/english_saheeh');

  const id = ayahTranslation('id', 1, 1)!;
  expect(id.text).toBe(
    (quranId as { ayat: Record<string, { translation: string }> }).ayat['1:1']!.translation,
  );
  expect(id.source).toMatch(/Ministry of Religious Affairs/);

  expect(ayahTranslation('ar', 112, 2)).toBeNull();
  expect(ayahTranslation('en', 2, 255)).toBeNull(); // not fetched → nothing, never a guess
});

test('the stored translations cover every ayah of the lesson surahs', () => {
  for (const file of [quranEn, quranId] as { ayat: Record<string, unknown> }[]) {
    for (const [surah, n] of [
      [1, 7],
      [112, 4],
      [113, 5],
      [114, 6],
    ] as const)
      for (let a = 1; a <= n; a++) expect(file.ayat[`${surah}:${a}`], `${surah}:${a}`).toBeDefined();
  }
});

test('hadith translations: only for an approved, linked hadith (none yet)', () => {
  expect(hadithTranslation('en', 'PLACEHOLDER-al-ghadab', false)).toBeNull();
  expect(hadithTranslation('en', 'PLACEHOLDER-al-ghadab', true)).toBeNull(); // no hadeethencId yet
  expect(hadithTranslation('ar', 'PLACEHOLDER-al-ghadab', true)).toBeNull();
});

test("the AI server's en / id hadith titles count as today's hadith", () => {
  expect(hadithMatchesTopic("Don't Get Angry", 'الغضب', normalizeArabic)).toBe(true);
  expect(hadithMatchesTopic('Jangan Marah', 'الغضب', normalizeArabic)).toBe(true);
  expect(hadithMatchesTopic('Kindness to Parents', 'برّ الوالدين', normalizeArabic)).toBe(true);
  expect(hadithMatchesTopic('Berbohong', 'الكذب', normalizeArabic)).toBe(true);
  expect(hadithMatchesTopic('Lying', 'الغضب', normalizeArabic)).toBe(false);
  expect(hadithMatchesTopic('لا تغضب', 'الغضب', normalizeArabic)).toBe(true);
});
