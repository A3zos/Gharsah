// A tiny i18n layer for the LANDING page only (PO, 2026-10-03): Arabic + English;
// Indonesian stays «قريبًا». The app pages have no provider (LandingI18n.tsx), so they
// read the default (Arabic, no setter) and the switcher there keeps showing «قريبًا».
// Never put Quran or hadith text here — ayat stay Arabic (Uthmani, rtl) in every language.
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import { toArabicDigits } from '../lib/arabicDigits';
import ar from './ar.json';
import enJson from './en.json';

export type Messages = typeof ar;
const en: Messages = enJson;

/** The languages with messages; others are «قريبًا». */
export type UiLanguage = 'ar' | 'en';
export const MESSAGES: Record<UiLanguage, Messages> = { ar, en };

export const isUiLanguage = (code: string | null | undefined): code is UiLanguage =>
  code === 'ar' || code === 'en';

export const dirOf = (lang: UiLanguage) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Numbers in the UI language: Arabic-Indic in Arabic, Latin in English. */
export const formatNumber = (lang: UiLanguage, n: string | number) =>
  lang === 'ar' ? toArabicDigits(n) : String(n);

/** «{min}» → vars.min (numbers formatted for the language). */
export function fill(lang: UiLanguage, text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? formatNumber(lang, vars[k]!) : `{${k}}`));
}

/** The hero pill's age range («للأطفال من ٨ إلى ١٣ سنة» / «For children aged 8–13»). */
export const LANDING_AGES = { min: 8, max: 13 } as const;

export const STORAGE_KEY = 'gharsah.landingLang';

export interface I18n {
  lang: UiLanguage;
  m: Messages;
  dir: 'rtl' | 'ltr';
  /** Undefined outside the landing (no provider) — there only Arabic exists. */
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

/** Forget this visit's choice (leaving the landing); the stored one stays. */
export const resetPickedLanguage = () => {
  picked = null;
};

/** The landing language: Arabic while prerendering/hydrating, then ?lang= / stored / picked. */
export function useLandingLanguage() {
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
