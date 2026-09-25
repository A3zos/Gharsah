import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/signup';

export const meta: Route.MetaFunction = () => [{ title: 'إنشاء حساب — غَرْسة' }];

// Phase 3 — mobile frame 04.
export default function Page() {
  return <PendingDesign name="إنشاء حساب" />;
}
