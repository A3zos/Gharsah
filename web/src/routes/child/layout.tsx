import { useMemo } from 'react';
import { Outlet } from 'react-router';

import { ChildDataProvider } from '../../components/child/ChildData';
import type { Route } from './+types/layout';

/** Guard: this browser is a child device linked by the server, else → child code tab. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { requireChildSession } = await import('../../firebase/session');
  return requireChildSession(request.url);
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

export default function ChildLayout({ loaderData }: Route.ComponentProps) {
  const { deviceUid, parentUid, childId } = loaderData;
  const session = useMemo(() => ({ deviceUid, parentUid, childId }), [deviceUid, parentUid, childId]);
  return (
    <ChildDataProvider session={session}>
      <Outlet />
    </ChildDataProvider>
  );
}
