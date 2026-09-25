// The parent's own profile + subscription (read-only on the web: buying happens
// in the Android app through Google Play Billing — CLAUDE.md §3).
import { collection, deleteDoc, doc, getDocs, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { deleteUser, updateProfile } from 'firebase/auth';

import { firebase } from '../firebase/app';
import { toAuthFailure } from './authFailure';

export type PlanId = 'annual' | 'monthly';
export const PLAN_LABEL: Record<PlanId, string> = { annual: 'سنوية', monthly: 'شهرية' };

export interface Subscription {
  plan: PlanId;
  startedAt: Date;
  expiresAt: Date;
  active: boolean;
}

export const daysLeft = (s: Subscription, now = new Date()) => {
  const d = (s.expiresAt.getTime() - now.getTime()) / 86_400_000;
  return d <= 0 ? 0 : Math.ceil(d);
};

export const remainingFraction = (s: Subscription, now = new Date()) => {
  const total = s.expiresAt.getTime() - s.startedAt.getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (s.expiresAt.getTime() - now.getTime()) / total));
};

export const isSubscribed = (s: Subscription | null, now = new Date()) =>
  !!s && s.active && s.expiresAt > now;

export function watchSubscription(
  uid: string,
  next: (s: Subscription | null) => void,
  error?: (e: unknown) => void,
) {
  return onSnapshot(
    doc(firebase().db, 'parents', uid, 'subscription', 'current'),
    (d) => {
      if (!d.exists()) return next(null);
      const v = d.data();
      const date = (x: unknown) => (x instanceof Timestamp ? x.toDate() : new Date());
      next({
        plan: v.plan === 'monthly' ? 'monthly' : 'annual',
        startedAt: date(v.startedAt),
        expiresAt: date(v.expiresAt),
        active: v.status === 'active',
      });
    },
    error,
  );
}

export interface ParentProfile {
  name: string;
  email: string;
}

export function watchParent(
  uid: string,
  next: (p: ParentProfile | null) => void,
  error?: (e: unknown) => void,
) {
  return onSnapshot(
    doc(firebase().db, 'parents', uid),
    (d) =>
      next(d.exists() ? { name: String(d.data().name ?? ''), email: String(d.data().email ?? '') } : null),
    error,
  );
}

export async function updateParentName(name: string): Promise<void> {
  const { auth, db } = firebase();
  const user = auth.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, 'parents', user.uid), { name: name.trim() });
    await updateProfile(user, { displayName: name.trim() });
  } catch (e) {
    throw toAuthFailure(e);
  }
}

/**
 * «حذف الحساب»: every child (the server then deletes their progress, recordings
 * and codes), the parent document, then the sign-in itself. The subscription
 * record is server/Play-managed (rules deny client deletes). Firebase asks for a
 * recent sign-in before deleting a user — that error is surfaced to the caller.
 */
export async function deleteAccount(): Promise<void> {
  const { auth, db } = firebase();
  const user = auth.currentUser;
  if (!user) return;
  // Firebase only deletes a user who signed in within ~5 minutes; check first so
  // we never delete the data and then fail to delete the account.
  const last = Date.parse(user.metadata.lastSignInTime ?? '');
  if (!(Date.now() - last < 4 * 60_000)) throw toAuthFailure({ code: 'requires-recent-login' });
  try {
    const kids = await getDocs(collection(db, 'parents', user.uid, 'children'));
    await Promise.all(kids.docs.map((k) => deleteDoc(k.ref)));
    await deleteDoc(doc(db, 'parents', user.uid));
    await deleteUser(user);
  } catch (e) {
    throw toAuthFailure(e);
  }
}
