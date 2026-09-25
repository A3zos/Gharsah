import { Outlet } from 'react-router';

import type { Route } from './+types/layout';

/** Guard: this browser is a child device linked by the server, else → child code tab. */
export async function clientLoader() {
  const { requireChildSession } = await import('../../firebase/session');
  return requireChildSession();
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

export default function ChildLayout(_: Route.ComponentProps) {
  return <Outlet />;
}
