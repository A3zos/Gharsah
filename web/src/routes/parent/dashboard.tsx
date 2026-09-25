import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/dashboard';

export const meta: Route.MetaFunction = () => [{ title: 'لوحة التحكم — غَرْسة' }];

// Phase 3 — frame 27 (web) + mobile 12–16.
export default function Page() {
  return <PendingDesign name="لوحة التحكم" />;
}
