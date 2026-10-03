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

/** The basmala, from the verified Tanzil text (1:1) — never typed by hand. */
export const BASMALA = text.text(quranRef(1, 1));

/**
 * A surah's page opens with the basmala line — except At-Tawbah (9, none) and
 * Al-Fatiha (1, where the basmala is its first ayah). By the verified surah names.
 */
export function showsBasmala(surahName: string): boolean {
  return surahName !== meta.surahName(1) && surahName !== meta.surahName(9);
}
