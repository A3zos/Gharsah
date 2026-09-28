import { useCallback, useEffect, useState } from 'react';

import { AdminView } from '../components/admin/AdminView';
import { loadAdminStats, type AdminLoad } from '../data/admin';
import type { Route } from './+types/admin';

export const meta: Route.MetaFunction = () => [
  { title: 'إحصاءات — غَرْسة' },
  { name: 'robots', content: 'noindex, nofollow' },
];

/** Signed-out (or a child device) → the parent login, then back here. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { requireParent } = await import('../supabase/session');
  await requireParent(request.url);
  return null;
}

export function HydrateFallback() {
  return <div className="min-h-dvh bg-background" aria-busy="true" />;
}

/** Admin statistics. Whether the user is an admin is decided by the database (admin_stats → forbidden). */
export default function AdminRoute() {
  const [state, setState] = useState<AdminLoad>({ kind: 'loading' });
  const refresh = useCallback(() => {
    setState((s) => (s.kind === 'ok' ? s : { kind: 'loading' }));
    void loadAdminStats().then(setState);
  }, []);
  useEffect(() => {
    let live = true;
    void loadAdminStats().then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return <AdminView state={state} onRefresh={refresh} />;
}
