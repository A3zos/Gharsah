import { useMemo } from 'react';
import { Outlet } from 'react-router';

import { ChildDataProvider } from '../../components/child/ChildData';
import type { Route } from './+types/layout';

/** Guard: this browser is a child device linked by the server, else → child code tab. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  // DEV-only sample child (/child/home?preview=1) — never in production builds.
  if (import.meta.env.DEV) {
    const { childPreviewOn, previewSession } = await import('../../dev/childPreview');
    if (childPreviewOn(request.url)) return previewSession;
  }
  const { requireChildSession } = await import('../../supabase/session');
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
