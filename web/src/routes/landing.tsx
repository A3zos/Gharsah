import { LandingDesktop } from '../components/landing/LandingDesktop';
import { LandingMobile } from '../components/landing/LandingMobile';
import { useI18n } from '../i18n/i18n';
import { LandingI18nProvider } from '../i18n/LandingI18n';
import type { Route } from './+types/landing';

export const meta: Route.MetaFunction = () => [
  { title: 'غَرْسة — نغرس حُبّ القرآن… ويكبر معهم' },
  {
    name: 'description',
    content:
      'معلّم صوتي يجلس مع ابنك كل يوم: يحفّظه آية آية، ويعلّمه حديثًا، ويكلّفه بعمل صالح يحكيه بصوته في اليوم التالي.',
  },
];

/**
 * design/v2 WebLanding (≥1024px) / WebLandingMobile. Prerendered, so the two
 * layouts switch in CSS (no JS media query → no layout flash).
 */
export default function Landing() {
  return (
    <LandingI18nProvider>
      <LandingPage />
    </LandingI18nProvider>
  );
}

/** lang/dir on the page itself too, so it mirrors in the same render as the text. */
function LandingPage() {
  const { lang, dir } = useI18n();
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
