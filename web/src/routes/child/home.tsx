import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/home';

export const meta: Route.MetaFunction = () => [{ title: 'رئيسية الطفل — غَرْسة' }];

// Phase 4 — mobile frame 17.
export default function Page() {
  return <PendingDesign name="رئيسية الطفل" />;
}
