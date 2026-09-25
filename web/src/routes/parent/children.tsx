import { PendingDesign } from '../../components/PendingDesign';

import type { Route } from './+types/children';

export const meta: Route.MetaFunction = () => [{ title: 'أبنائي — غَرْسة' }];

// Phase 3 — children list (design revision: «أبنائي»).
export default function Page() {
  return <PendingDesign name="أبنائي" />;
}
