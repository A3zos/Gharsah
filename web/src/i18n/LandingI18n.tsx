// The landing's language provider (see i18n.ts). Only the landing mounts it.
import { useEffect, useMemo } from 'react';

import {
  dirOf,
  I18nContext,
  MESSAGES,
  resetPickedLanguage,
  setDocumentLanguage,
  useLandingLanguage,
  type I18n,
} from './i18n';

/**
 * Wraps the landing. Starts in Arabic (the prerendered HTML), then applies ?lang= /
 * the stored choice after hydration. Sets <html lang dir> while mounted and puts
 * Arabic back on the way out, since the app pages are Arabic only.
 */
export function LandingI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useLandingLanguage();

  useEffect(
    () => () => {
      resetPickedLanguage();
      setDocumentLanguage('ar');
    },
    [],
  );
  useEffect(() => setDocumentLanguage(lang), [lang]);

  const value = useMemo<I18n>(
    () => ({ lang, m: MESSAGES[lang], dir: dirOf(lang), setLang }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
