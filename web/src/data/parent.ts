// The parent's own profile + subscription (Supabase: `parents`, `subscriptions`).
// Buying on the web = the trial/mock path only while VITE_TRIAL_SUBSCRIBE=1
// (real purchases: Google Play Billing in the Android app — CLAUDE.md §3).
import { supabase } from '../supabase/client';
import { watch } from '../supabase/live';
import { toAuthFailure } from './authFailure';

export type PlanId = 'annual' | 'monthly';
export const PLAN_LABEL: Record<PlanId | 'trial', string> = {
  annual: 'سنوية',
  monthly: 'شهرية',
  trial: 'تجريبية',
};

export interface Subscription {
  plan: PlanId | 'trial';
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

/** The web «اشترك» buttons write a trial (mock) subscription — switch off before launch. */
export const trialSubscribeEnabled = (): boolean =>
  import.meta.env.VITE_TRIAL_SUBSCRIBE === '1' || import.meta.env.VITE_TRIAL_SUBSCRIBE === 'true';

async function loadSubscription(uid: string): Promise<Subscription | null> {
  const { data, error } = await supabase()
    .from('subscriptions')
    .select('plan, status, started_at, renews_at')
    .eq('parent_id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.plan === 'none') return null;
  return {
    plan: data.plan as Subscription['plan'],
    startedAt: new Date(data.started_at as string),
    expiresAt: data.renews_at ? new Date(data.renews_at as string) : new Date(8.64e15),
    active: data.status === 'active',
  };
}

export function watchSubscription(
  uid: string,
  next: (s: Subscription | null) => void,
  error?: (e: unknown) => void,
) {
  return watch(
    [{ table: 'subscriptions', filter: `parent_id=eq.${uid}` }],
    () => loadSubscription(uid),
    next,
    error,
  );
}

/**
 * Starts (or renews) a plan through the mock provider. The database fills in the
 * dates (subscriptions_guard); the monthly one-child limit is enforced by a trigger.
 */
export async function startTrial(plan: PlanId): Promise<void> {
  const { data } = await supabase().auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw toAuthFailure({ code: 'permission-denied' });
  const { error } = await supabase()
    .from('subscriptions')
    .upsert({ parent_id: uid, plan }, { onConflict: 'parent_id' });
  if (error) throw toAuthFailure(error);
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
  return watch(
    [{ table: 'parents', filter: `id=eq.${uid}` }],
    async () => {
      const { data, error: e } = await supabase()
        .from('parents')
        .select('name, email')
        .eq('id', uid)
        .maybeSingle();
      if (e) throw e;
      return data ? { name: String(data.name ?? ''), email: String(data.email ?? '') } : null;
    },
    next,
    error,
  );
}

export async function updateParentName(name: string): Promise<void> {
  const { data } = await supabase().auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  const { error } = await supabase().from('parents').update({ name: name.trim() }).eq('id', uid);
  if (error) throw toAuthFailure(error);
  await supabase().auth.updateUser({ data: { name: name.trim() } });
}

/**
 * «حذف الحساب»: the delete-account Edge Function removes the auth user; the
 * database cascades to parents → children → progress/submissions (recordings
 * are queued for storage cleanup).
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase().functions.invoke('delete-account', { body: {} });
  if (error) throw toAuthFailure({ code: 'unavailable' });
  await supabase().auth.signOut();
}
