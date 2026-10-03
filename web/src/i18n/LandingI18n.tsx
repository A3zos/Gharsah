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

/** The parts of the landing not translated yet: Arabic, rtl, whatever the page language. */
export function ArabicOnly({ children }: { children: React.ReactNode }) {
  return (
    <div lang="ar" dir="rtl" className="contents">
      {children}
    </div>
  );
}

/** A message with **bold** parts (the source names in «مصادرنا»). */
export function Rich({ text, bold = 'font-bold text-text-dark' }: { text: string; bold?: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 ? (
          <b key={i} className={bold}>
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}
