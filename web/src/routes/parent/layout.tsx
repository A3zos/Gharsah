import { Outlet } from 'react-router';

import { ParentalGate } from '../../components/parent/ParentalGate';
import type { Route } from './+types/layout';

/** Guard: a signed-in parent (email/password), else → /login. */
export async function clientLoader() {
  const { requireParent } = await import('../../firebase/session');
  const user = await requireParent();
  return { uid: user.uid };
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

// TODO(design): the parent portal shell (nav, «أبنائي», settings) comes with
// frames 27–29 and the coming design revision; it wraps this Outlet.
export default function ParentLayout(_: Route.ComponentProps) {
  return (
    <ParentalGate>
      <Outlet />
    </ParentalGate>
  );
}
