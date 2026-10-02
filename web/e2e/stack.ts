// Helpers for the full-stack suites (parent/child/lesson) against a real Supabase
// project: the local stack by default, or the remote one only when explicitly
// opted in. Keys come from the shell, never from files in git:
//   SUPABASE_E2E_URL=http://127.0.0.1:54321     (default)
//   SUPABASE_E2E_ANON_KEY=…
//   SUPABASE_E2E_SERVICE_ROLE_KEY=…              (seeding only — never used by the app)
//   E2E_ALLOW_REMOTE=1                           (required for any non-local URL)
// Every test user is <random>@test.local; `npm run e2e:cleanup` deletes them.
import type { Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_E2E_URL ?? 'http://127.0.0.1:54321';
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(URL_);

export const TEST_EMAIL_DOMAIN = '@test.local';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — export the project's keys in this shell (never in a file)`);
  if (!LOCAL && process.env.E2E_ALLOW_REMOTE !== '1') {
    throw new Error(`${URL_} is not the local stack — set E2E_ALLOW_REMOTE=1 to run against it on purpose`);
  }
  return v;
}

let adminClient: SupabaseClient | undefined;
/** Service-role client for seeding the LOCAL database. */
export function admin(): SupabaseClient {
  adminClient ??= createClient(URL_, need('SUPABASE_E2E_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

const DAYS_ALL = [0, 1, 2, 3, 4, 5, 6];

export interface SeedChild {
  name: string;
  age?: number;
  gender?: 'boy' | 'girl';
  avatar?: string;
  scheduleDays?: number[];
  reviewDays?: number[];
}

/** A fresh parent (confirmed email) with an optional plan and children; returns their ids. */
export async function seedParent(
  opts: { plan?: 'annual' | 'monthly' | null; children?: SeedChild[] } = {},
): Promise<{ uid: string; email: string; password: string; childIds: string[] }> {
  const db = admin();
  const email = `p${Date.now()}${Math.floor(Math.random() * 1e6)}${TEST_EMAIL_DOMAIN}`;
  const password = 'test-pass-123';
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'أبو عبدالله' },
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const uid = data.user.id;
  const plan = opts.plan === undefined ? 'annual' : opts.plan;
  // Sign-up already started the free pilot ('trial'): set the wanted plan, or remove it for «no plan».
  const { error: e } = plan
    ? await db.from('subscriptions').upsert({ parent_id: uid, plan }, { onConflict: 'parent_id' })
    : await db.from('subscriptions').delete().eq('parent_id', uid);
  if (e) throw e;
  const childIds: string[] = [];
  for (const c of opts.children ?? []) {
    const days = c.scheduleDays ?? [0, 1, 2, 4, 5];
    const { data: row, error: e } = await db
      .from('children')
      .insert({
        parent_id: uid,
        name: c.name,
        age: c.age ?? 10,
        gender: c.gender ?? 'boy',
        avatar: c.avatar ?? 'boy-1',
        schedule_days: days,
        schedule_time: 1020,
        review_days: c.reviewDays ?? [days.at(-1)!],
      })
      .select('id')
      .single();
    if (e) throw e;
    childIds.push(String(row.id));
  }
  return { uid, email, password, childIds };
}

/** Signs a parent in through the login form. */
export async function loginParent(page: Page, email: string, password: string) {
  await page.goto('/login?tab=parent');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-pass').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/parent/);
}

/** A fresh parent + child, a server-side pairing code, then the child tab claims it → /child/home. */
export async function pairChild(page: Page, opts: { reviewDays?: number[] } = {}) {
  const p = await seedParent({
    children: [{ name: 'عبدالله محمد', scheduleDays: DAYS_ALL, reviewDays: opts.reviewDays ?? [5] }],
  });
  const childId = p.childIds[0]!;
  const code = String(Math.floor(100000 + Math.random() * 899999));
  const { error } = await admin()
    .from('pairing_codes')
    .insert({
      code,
      parent_id: p.uid,
      child_id: childId,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
  if (error) throw error;
  await page.goto('/login?role=child');
  await page.getByLabel('الخانة الأولى من رمز الربط').pressSequentially(code);
  // Six digits verify on their own (auto-submit) → child home.
  await page.waitForURL(/\/child\/home/);
  return { uid: p.uid, childId };
}

/** One row (service role) — for assertions on what the app wrote. */
export async function getRow(
  table: string,
  match: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  let q = admin().from(table).select('*');
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}
