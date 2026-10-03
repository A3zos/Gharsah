import { LandingDesktop } from '../components/landing/LandingDesktop';
import { LandingMobile } from '../components/landing/LandingMobile';
import { useDocumentMeta } from '../components/ui/Page';
import { MESSAGES, useI18n } from '../i18n/i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Route } from './+types/landing';

// Prerendered in Arabic; another language sets its own title/description after hydration.
export const meta: Route.MetaFunction = () => [
  { title: MESSAGES.ar.meta.title },
  { name: 'description', content: MESSAGES.ar.meta.description },
];

/**
 * design/v2 WebLanding (≥1024px) / WebLandingMobile. Prerendered, so the two
 * layouts switch in CSS (no JS media query → no layout flash).
 */
export default function Landing() {
  return (
    <I18nProvider>
      <LandingPage />
    </I18nProvider>
  );
}

/** lang/dir on the page itself too, so it mirrors in the same render as the text. */
function LandingPage() {
  const { lang, dir, m } = useI18n();
  useDocumentMeta(m.meta.title, m.meta.description);
  return (
    <div lang={lang} dir={dir}>
      <div className="hidden lg:block">
        <LandingDesktop />
      </div>
      <div className="lg:hidden">
        <LandingMobile />
      </div>
    </div>
  );
}
