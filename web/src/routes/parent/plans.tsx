import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/plans';

export const meta: Route.MetaFunction = () => [{ title: 'الباقات — غَرْسة' }];

// Phase 3 — frame 28 (view only + «إدارة الاشتراك في Google Play»).
export default function Page() {
  return <PendingDesign name="الباقات" />;
}
