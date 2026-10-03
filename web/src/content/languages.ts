// The language switcher's languages. On the landing (src/i18n) Arabic and English
// really switch; Indonesian — and English everywhere else — shows «قريبًا» and keeps
// the current language.
import { useCallback, useEffect, useRef, useState } from 'react';

import { isUiLanguage, useI18n } from '../i18n/i18n';

export type LanguageCode = 'ar' | 'en' | 'id';

export interface Language {
  code: LanguageCode;
  /** The language's own name — rendered with lang={code}. */
  name: string;
  /** «AR» */
  short: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'ar', name: 'العربية', short: 'AR' },
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'id', name: 'Bahasa Indonesia', short: 'ID' },
];

/**
 * Picking a language: the current one → nothing; one with messages on the landing →
 * switch; otherwise → the «قريبًا» toast (in the current language) for a moment.
 */
export function useLanguagePick(ms = 2600) {
  const { lang, m, setLang } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pick = useCallback(
    (code: LanguageCode) => {
      if (code === lang) return;
      clearTimeout(timer.current);
      if (setLang && isUiLanguage(code)) {
        setToast(null);
        return setLang(code);
      }
      setToast(m.language.soon);
      timer.current = setTimeout(() => setToast(null), ms);
    },
    [lang, m, setLang, ms],
  );
  return { lang, toast, pick };
}
