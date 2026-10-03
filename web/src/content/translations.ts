// Translations shown UNDER the Arabic in English / Indonesian — never written by us or by
// any AI: ayat verbatim from QuranEnc, hadith verbatim from HadeethEnc (content/…/translations,
// fetched by web/tools/fetch-*-translations.mjs). Arabic shows none; a missing one shows nothing.
import hadithJson from '@content/hadith/translations.json';
import quranEn from '@content/quran/translations/en.json';
import quranId from '@content/quran/translations/id.json';

import type { UiLanguage } from '../i18n/i18n';

interface QuranFile {
  source: string;
  sourceUrl: string;
  ayat: Record<string, { translation: string; footnotes: string | null }>;
}
const QURAN: Record<'en' | 'id', QuranFile> = { en: quranEn as QuranFile, id: quranId as QuranFile };

export interface ShownTranslation {
  text: string;
  source: string;
  sourceUrl: string;
}

/**
 * The ayah's translation in the UI language (QuranEnc, verbatim; only the footnote
 * markers like «[2011]» are left out of the display), or null.
 */
export function ayahTranslation(lang: UiLanguage, surah: number, ayah: number): ShownTranslation | null {
  if (lang === 'ar') return null;
  const file = QURAN[lang];
  const a = file.ayat[`${surah}:${ayah}`];
  if (!a?.translation) return null;
  return {
    text: a.translation.replace(/\[\d+\]/g, '').trim(),
    source: file.source,
    sourceUrl: file.sourceUrl,
  };
}

interface HadithEntry {
  hadeethencId: string | number | null;
  en: { hadeeth: string | null; sourceUrl: string } | null;
  id: { hadeeth: string | null; sourceUrl: string } | null;
}
const HADITH = hadithJson as { source: string; hadith: Record<string, HadithEntry> };

/**
 * The hadith's translation (HadeethEnc, verbatim) — only for an APPROVED hadith whose
 * Arabic text is shown, and only once a reviewer linked it (hadeethencId) and it was fetched.
 */
export function hadithTranslation(
  lang: UiLanguage,
  hadithId: string,
  approved: boolean,
): ShownTranslation | null {
  if (lang === 'ar' || !approved) return null;
  const t = HADITH.hadith[hadithId]?.[lang];
  if (!t?.hadeeth) return null;
  return { text: t.hadeeth, source: HADITH.source, sourceUrl: t.sourceUrl };
}
