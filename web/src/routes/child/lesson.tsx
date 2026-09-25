import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/lesson';

export const meta: Route.MetaFunction = () => [{ title: 'الحصة — غَرْسة' }];

// Phase 4 — mobile frames 18–23; desktop/tablet 30–31 (phone-width, centered).
export default function Page() {
  return <PendingDesign name="الحصة" />;
}
