import { LandingDesktop } from '../components/landing/LandingDesktop';
import { LandingMobile } from '../components/landing/LandingMobile';
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
    <>
      <div className="hidden lg:block">
        <LandingDesktop />
      </div>
      <div className="lg:hidden">
        <LandingMobile />
      </div>
    </>
  );
}
