// The language switcher — UI ONLY for now (PO, 2026-10-03): Arabic stays the only
// language; choosing another one shows «قريبًا» and keeps Arabic. No i18n wiring,
// no stored preference, no direction change.
import { useCallback, useEffect, useRef, useState } from 'react';

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

/** The only language the app speaks today. */
export const CURRENT_LANGUAGE: LanguageCode = 'ar';

export const LANGUAGE_SOON = 'قريبًا — نعمل على دعم هذه اللغة';

/** Picking a language: Arabic → nothing to do; others → the «قريبًا» toast for a moment. */
export function useLanguagePick(ms = 2600) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pick = useCallback(
    (code: LanguageCode) => {
      if (code === CURRENT_LANGUAGE) return;
      clearTimeout(timer.current);
      setToast(LANGUAGE_SOON);
      timer.current = setTimeout(() => setToast(null), ms);
    },
    [ms],
  );
  return { toast, pick };
}
