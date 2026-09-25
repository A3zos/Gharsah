import { PendingDesign } from '../components/PendingDesign';

import type { Route } from './+types/landing';

export const meta: Route.MetaFunction = () => [{ title: 'غَرْسة — نغرس حُبّ القرآن… ويكبر معهم' }];

// Phase 2 — frames 25 (desktop) / 26 (mobile). Not in design/ yet.
export default function Page() {
  return <PendingDesign name="الصفحة الرئيسية" />;
}
