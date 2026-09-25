// Verified Quran text for pages outside the lesson (landing). Always from the
// Tanzil asset in content/ — never typed by hand, never generated.
import textJson from '@content/quran/quran_text.json';
import metaJson from '@content/quran/quran_meta.json';

import { QuranMeta, QuranText, quranRef } from '../lesson/quran';
import { toArabicDigits } from '../lib/arabicDigits';

const text = QuranText.fromJson(textJson);
const meta = QuranMeta.fromJson(metaJson);

export function verifiedAyah(surah: number, ayah: number): { text: string; reference: string } {
  return {
    text: text.text(quranRef(surah, ayah)),
    reference: `سورة ${meta.surahName(surah)} · الآية ${toArabicDigits(ayah)}`,
  };
}
