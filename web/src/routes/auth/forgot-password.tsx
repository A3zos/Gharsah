import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/forgot-password';

export const meta: Route.MetaFunction = () => [{ title: 'نسيت كلمة المرور — غَرْسة' }];

// Phase 3 — TODO(design): no frame for this screen yet.
export default function Page() {
  return <PendingDesign name="نسيت كلمة المرور" />;
}
