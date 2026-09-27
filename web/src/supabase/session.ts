// Who is using this browser: a signed-in parent, a paired child device, or
// nobody. Used by the route guards (clientLoaders), so it throws react-router redirects.
import type { User } from '@supabase/supabase-js';
import { redirect } from 'react-router';

import { paths } from '../app/paths';
import { currentUser, isAnonymousUser, supabase } from './client';

export { currentUser };

/** Where the guard was going, so login can come back to it (`?next=`). */
const nextOf = (url?: string) => {
  if (!url) return undefined;
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

/** A parent account (email/password) — never the anonymous child device. */
export async function requireParent(url?: string): Promise<User> {
  const user = await currentUser();
  if (!user || isAnonymousUser(user)) throw redirect(paths.loginTo('parent', nextOf(url)));
  return user;
}

export interface ChildSession {
  deviceUid: string;
  parentUid: string;
  childId: string;
}

/**
 * The child device: anonymous auth + its server-written `child_sessions` row
 * (only claim-pairing-code creates it). Revoked or missing → the child code tab.
 * The browser caches nothing else (CLAUDE.md §2: the server is the source of truth).
 */
export async function requireChildSession(url?: string): Promise<ChildSession> {
  const user = await currentUser();
  const toCode = paths.loginTo('child', nextOf(url));
  if (!user || !isAnonymousUser(user)) throw redirect(toCode);
  const { data } = await supabase()
    .from('child_sessions')
    .select('parent_id, child_id, revoked')
    .eq('device_uid', user.id)
    .maybeSingle();
  if (!data || data.revoked) throw redirect(toCode);
  return { deviceUid: user.id, parentUid: data.parent_id as string, childId: data.child_id as string };
}
