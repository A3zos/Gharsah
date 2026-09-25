import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/child-code';

export const meta: Route.MetaFunction = () => [{ title: 'رمز الربط — غَرْسة' }];

// Phase 3 — mobile frame 11 (server-issued pairing code).
export default function Page() {
  return <PendingDesign name="رمز الربط" />;
}
