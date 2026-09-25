// Who is using this browser: a signed-in parent, a linked child device, or nobody.
// Used by the route guards (clientLoaders), so it throws react-router redirects.
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { redirect } from 'react-router';

import { paths } from '../app/paths';
import { firebase } from './app';

export async function currentUser(): Promise<User | null> {
  const { auth } = firebase();
  await auth.authStateReady();
  return auth.currentUser;
}

/** A parent account (email/password) — never the anonymous child device. */
export async function requireParent(): Promise<User> {
  const user = await currentUser();
  if (!user || user.isAnonymous) throw redirect(paths.login);
  return user;
}

export interface ChildSession {
  deviceUid: string;
  parentUid: string;
  childId: string;
}

/**
 * The child device: anonymous auth + the server-written `childSessions/{uid}`
 * (only `claimPairingCode` creates it). Revoked or missing → the child code tab.
 * The browser caches nothing else (CLAUDE.md §2: the server is the source of truth).
 */
export async function requireChildSession(): Promise<ChildSession> {
  const user = await currentUser();
  if (!user?.isAnonymous) throw redirect(paths.childCode);
  const snap = await getDoc(doc(firebase().db, 'childSessions', user.uid)).catch(() => null);
  const data = snap?.exists() ? snap.data() : undefined;
  if (typeof data?.parentUid !== 'string' || typeof data.childId !== 'string') {
    throw redirect(paths.childCode);
  }
  return { deviceUid: user.uid, parentUid: data.parentUid, childId: data.childId };
}
