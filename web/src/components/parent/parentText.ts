// Language helpers of the parent area (src/i18n/<lang>/parent.json). Arabic always takes
// the exact path it took before translation (the verified content, the Hijri helpers);
// English / Indonesian use the locale files and Intl.
import { useEffect } from 'react';

import { projectRepo, quranMeta } from '../../content/library';
import { AuthFailure, authFailureMessage } from '../../data/authFailure';
import { formatNumber, MESSAGES, useI18n, type Messages, type UiLanguage } from '../../i18n/i18n';
import { hijriDayMonth } from '../../lib/dates';

type ParentMessages = Messages['parent'];

/** «{name}» → vars.name. Numbers follow the language's digits; strings go in as they are. */
export function fmt(lang: UiLanguage, text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined) return `{${k}}`;
    return typeof v === 'number' ? formatNumber(lang, v) : v;
  });
}

/** «٣٣٪» / «33%» */
export const pctText = (lang: UiLanguage, n: number) => fmt(lang, MESSAGES[lang].parent.common.pct, { n });

/** A surah's name: the verified Arabic name, or the standard transliteration in en / id. */
export function surahName(lang: UiLanguage, n: number): string {
  if (lang === 'ar') return quranMeta.surahName(n);
  return (MESSAGES[lang].parent.surahs as Record<string, string>)[String(n)] ?? quranMeta.surahName(n);
}

/** «برّ الوالدين» (the hadith's own topic) / "kindness to parents". */
export function hadithTopic(lang: UiLanguage, id: string, arTopic: string): string {
  if (lang === 'ar') return arTopic;
  return (MESSAGES[lang].parent.hadithTopics as Record<string, string>)[id] ?? arTopic;
}

export const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A lesson value («برّ الوالدين» from the lesson JSON) in the UI language. */
export function valueText(lang: UiLanguage, arValue: string): string {
  if (lang === 'ar') return arValue;
  const ar = MESSAGES.ar.parent.values as Record<string, string>;
  const key = Object.keys(ar).find((k) => ar[k] === arValue);
  return key ? (MESSAGES[lang].parent.values as Record<string, string>)[key]! : arValue;
}

/** The project's title / intro (content/projects in Arabic; the locale file in en / id). */
export function projectCopy(lang: UiLanguage, id: string): { title: string; intro: string } | null {
  let ar: { title: string; intro: string };
  try {
    ar = projectRepo.byId(id);
  } catch {
    return null;
  }
  if (lang === 'ar') return { title: ar.title, intro: ar.intro };
  const t = (MESSAGES[lang].parent.projects as Record<string, { title: string; intro: string }>)[id];
  return t ?? { title: ar.title, intro: ar.intro };
}

const gregorian = (lang: UiLanguage) =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' });

/** «١٤ رجب» (Hijri, as before) in Arabic; "14 October" / "14 Oktober" in en / id. */
export const dayMonth = (lang: UiLanguage, d: Date): string =>
  lang === 'ar' ? hijriDayMonth(d) : gregorian(lang).format(d);

/**
 * A failure's message in the UI language (Arabic: exactly the message it carries): the
 * pairing failures by their code (parent.json → errors), the rest through auth.json.
 */
export function failureText(lang: UiLanguage, e: unknown): string {
  if (lang !== 'ar' && e instanceof AuthFailure && e.code) {
    const own = (MESSAGES[lang].parent.errors as Record<string, string>)[e.code];
    if (own) return own;
  }
  return authFailureMessage(lang, e);
}

/** The page's <title> in the UI language («لوحة التحكم — غَرْسة»), as the route's meta sets it. */
export function useParentTitle(key: keyof ParentMessages['meta']) {
  const { m } = useI18n();
  const title = `${m.parent.meta[key]} — ${m.parent.meta.brand}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
}
