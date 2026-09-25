import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/children-new';

export const meta: Route.MetaFunction = () => [{ title: 'إضافة ابن — غَرْسة' }];

// Phase 3 — frame 29 (web) + mobile 07–10.
export default function Page() {
  return <PendingDesign name="إضافة ابن" />;
}
