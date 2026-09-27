import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { ParentDataProvider } from '../../components/parent/ParentData';
import { SSessionEnd } from '../../components/states/SSessionEnd';
import { signOut } from '../../data/auth';
import type { Route } from './+types/layout';

/** Guard: a signed-in parent (email/password), else → /login. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { requireParent } = await import('../../firebase/session');
  const user = await requireParent(request.url);
  return { uid: user.uid, email: user.email ?? '' };
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

/** SSessionEnd: after this long without any input the web parent is signed out. */
const IDLE_MS = 30 * 60_000;

export default function ParentLayout({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    let timer = setTimeout(expire, IDLE_MS);
    function expire() {
      void signOut().finally(() => setEnded(true));
    }
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);

  if (ended) {
    return (
      <SSessionEnd
        onPrimary={() => navigate(paths.login, { replace: true })}
        onHome={() => navigate(paths.landing, { replace: true })}
      />
    );
  }
  return (
    // No separate parental gate: the parent area already requires the parent's
    // email + password (review notes B3; CLAUDE.md §3.2).
    <ParentDataProvider uid={loaderData.uid} email={loaderData.email}>
      <Outlet />
    </ParentDataProvider>
  );
}
