import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/login';

export const meta: Route.MetaFunction = () => [{ title: 'تسجيل الدخول — غَرْسة' }];

// Phase 3/4 — mobile frame 03 (tabs: ولي الأمر / الطفل via ?tab=child).
export default function Page() {
  return <PendingDesign name="تسجيل الدخول" />;
}
