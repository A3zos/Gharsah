import { PendingDesign } from '../components/PendingDesign';

import type { Route } from './+types/not-found';

export const meta: Route.MetaFunction = () => [{ title: 'الصفحة غير موجودة — غَرْسة' }];

// TODO(design): no designed not-found screen yet.
export default function Page() {
  return <PendingDesign name="الصفحة غير موجودة" />;
}
