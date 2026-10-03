// The app's i18n layer: Arabic (default, rtl), English and Indonesian (ltr).
//   Locale files: ar.json / en.json / id.json — the core (landing, login, shared words);
//   ar/<area>.json, en/<area>.json, id/<area>.json — one file per app area. Arabic is the
//   source of truth; a key missing in en / id falls back to Arabic (logged in dev).
// Pages read the language through <I18nProvider> (I18nProvider.tsx); a page without one
// reads the default context: Arabic, rtl — never half-translated.
// Never put Quran or hadith text here — ayat / hadith stay Arabic (Uthmani, rtl) in every
// language; their translations come only from QuranEnc / HadeethEnc (content/).
// Words: GLOSSARY.md.
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import { toArabicDigits } from '../lib/arabicDigits';
import arCore from './ar.json';
import arAdmin from './ar/admin.json';
import arAuth from './ar/auth.json';
import arChild from './ar/child.json';
import arLesson from './ar/lesson.json';
import arParent from './ar/parent.json';
import enCore from './en.json';
import enAdmin from './en/admin.json';
import enAuth from './en/auth.json';
import enChild from './en/child.json';
import enLesson from './en/lesson.json';
import enParent from './en/parent.json';
import idCore from './id.json';
import idAdmin from './id/admin.json';
import idAuth from './id/auth.json';
import idChild from './id/child.json';
import idLesson from './id/lesson.json';
import idParent from './id/parent.json';

const ar = { ...arCore, auth: arAuth, parent: arParent, child: arChild, lesson: arLesson, admin: arAdmin };
export type Messages = typeof ar;

export type UiLanguage = 'ar' | 'en' | 'id';
export const UI_LANGUAGES: readonly UiLanguage[] = ['ar', 'en', 'id'];

type Loose = { [k: string]: unknown };

/** `over` on top of `base` (Arabic): every key exists; a missing one is logged in dev. */
export function withFallback<T>(base: T, over: unknown, lang: string, path = ''): T {
  if (Array.isArray(base)) {
    const o = Array.isArray(over) ? over : [];
    return base.map((b, i) => withFallback(b, o[i], lang, `${path}[${i}]`)) as T;
  }
  if (base !== null && typeof base === 'object') {
    const o = (over !== null && typeof over === 'object' ? over : {}) as Loose;
    const out: Loose = {};
    for (const [k, v] of Object.entries(base as Loose))
      out[k] = withFallback(v, o[k], lang, path ? `${path}.${k}` : k);
    return out as T;
  }
  if (typeof over === typeof base) return over as T;
  if (import.meta.env.DEV) console.warn(`[i18n] missing ${lang} key: ${path} — Arabic shown`);
  return base;
}

export const MESSAGES: Record<UiLanguage, Messages> = {
  ar,
  en: withFallback(
    ar,
    { ...enCore, auth: enAuth, parent: enParent, child: enChild, lesson: enLesson, admin: enAdmin },
    'en',
  ),
  id: withFallback(
    ar,
    { ...idCore, auth: idAuth, parent: idParent, child: idChild, lesson: idLesson, admin: idAdmin },
    'id',
  ),
};

export const isUiLanguage = (code: string | null | undefined): code is UiLanguage =>
  code === 'ar' || code === 'en' || code === 'id';

export const dirOf = (lang: UiLanguage) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Numbers in the UI language: Arabic-Indic in Arabic, Latin in English / Indonesian. */
export const formatNumber = (lang: UiLanguage, n: string | number) =>
  lang === 'ar' ? toArabicDigits(n) : String(n);

/** «{min}» → vars.min (numbers formatted for the language). */
export function fill(lang: UiLanguage, text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? formatNumber(lang, vars[k]!) : `{${k}}`));
}

/**
 * A count phrase from the same four forms in every language: `one` / `two` / `few` /
 * `many`, each may hold «{n}». Arabic keeps its rules exactly (1 → one, 2 → two,
 * 0 and 3–10 → few, 11+ → many); English / Indonesian use Intl.PluralRules
 * («one» → one, anything else → many).
 */
export interface CountForms {
  one: string;
  two: string;
  few: string;
  many: string;
}
export function countPhrase(lang: UiLanguage, n: number, f: CountForms): string {
  let form: string;
  if (lang === 'ar')
    form = n === 1 ? f.one : n === 2 ? f.two : n === 0 || (n >= 3 && n <= 10) ? f.few : f.many;
  else form = new Intl.PluralRules(lang).select(n) === 'one' ? f.one : f.many;
  return fill(lang, form, { n });
}

/**
 * Does the AI lesson (/agent/start, /speak) follow the UI language? OFF — product-owner
 * decision pending: in an en / id session the AI server's teacher SPEAKS its own hadith
 * translation (not HadeethEnc; its docs say it still needs Sharia review). Until then the
 * AI lesson runs in Arabic (the screens around it are translated). Flip to true to enable.
 */
export const AI_LESSON_FOLLOWS_UI = false;

/** The AI lesson's session language for a UI language (see AI_LESSON_FOLLOWS_UI). */
export const aiLessonLanguage = (ui: UiLanguage): UiLanguage => (AI_LESSON_FOLLOWS_UI ? ui : 'ar');

/** @deprecated the AI lesson's default session language — use aiLessonLanguage(lang). */
export const APP_UI_LANGUAGE = 'ar' as const;

/** The hero pill's age range («للأطفال من ٨ إلى ١٣ سنة» / «For children aged 8–13»). */
export const LANDING_AGES = { min: 8, max: 13 } as const;

export const STORAGE_KEY = 'gharsah.landingLang';

export interface I18n {
  lang: UiLanguage;
  m: Messages;
  dir: 'rtl' | 'ltr';
  /** Undefined without a provider — there only Arabic exists. */
  setLang?: (lang: UiLanguage) => void;
}

export const I18nContext = createContext<I18n>({ lang: 'ar', m: ar, dir: 'rtl' });

export const useI18n = () => useContext(I18nContext);

/** ?lang= wins, then the stored choice, then Arabic. */
function initialLanguage(): UiLanguage {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (isUiLanguage(q)) return q;
  } catch {
    // no URL — fall through
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (isUiLanguage(s)) return s;
  } catch {
    // storage blocked
  }
  return 'ar';
}

/**
 * A page opened with a valid ?lang= keeps it: stored like a switcher choice, so the
 * next page (the login from the landing's «Log in», …) opens in the same language.
 */
export function rememberUrlLanguage(): void {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (isUiLanguage(q)) localStorage.setItem(STORAGE_KEY, q);
  } catch {
    // no URL / storage blocked — this page still uses ?lang=
  }
}

export function setDocumentLanguage(lang: UiLanguage) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = dirOf(lang);
}

// The choice made this visit (covers blocked storage); null → ?lang= / stored / Arabic.
let picked: UiLanguage | null = null;
const listeners = new Set<() => void>();
const subscribe = (on: () => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};
const snapshot = () => picked ?? initialLanguage();
// the prerendered HTML (and the first hydration pass) is Arabic
const serverSnapshot = (): UiLanguage => 'ar';

/** Forget this visit's choice (leaving a translated page); the stored one stays. */
export const resetPickedLanguage = () => {
  picked = null;
};

/** The UI language: Arabic while prerendering/hydrating, then ?lang= / stored / picked. */
export function useUiLanguage() {
  const lang = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setLang = useCallback((next: UiLanguage) => {
    picked = next;
    listeners.forEach((on) => on());
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked — the choice lasts this visit
    }
    try {
      // keep a shared ?lang= link in step with the choice
      const url = new URL(window.location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', next);
        window.history.replaceState(window.history.state, '', url);
      }
    } catch {
      // no history API
    }
  }, []);
  return [lang, setLang] as const;
}
