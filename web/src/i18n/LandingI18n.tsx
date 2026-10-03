// The language provider (see i18n.ts) of the translated pages: the landing and the
// login's two tabs. Pages without it are Arabic.
import { useEffect, useMemo } from 'react';

import {
  dirOf,
  I18nContext,
  MESSAGES,
  rememberUrlLanguage,
  resetPickedLanguage,
  setDocumentLanguage,
  useLandingLanguage,
  type I18n,
} from './i18n';

/**
 * Wraps a translated page. Starts in Arabic (the landing's prerendered HTML), then
 * applies ?lang= (and stores it) / the stored choice after hydration. Sets
 * <html lang dir> while mounted and puts Arabic back on the way out, since the other
 * app pages are Arabic only.
 */
export function LandingI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useLandingLanguage();

  useEffect(() => {
    rememberUrlLanguage();
    return () => {
      resetPickedLanguage();
      setDocumentLanguage('ar');
    };
  }, []);
  useEffect(() => setDocumentLanguage(lang), [lang]);

  const value = useMemo<I18n>(
    () => ({ lang, m: MESSAGES[lang], dir: dirOf(lang), setLang }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
