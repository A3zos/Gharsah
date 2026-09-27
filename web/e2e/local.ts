// Helpers for the LOCAL Supabase stack suites (parent/child/lesson) — never the
// remote project. `npx supabase start` prints the local URL and keys; export them:
//   SUPABASE_LOCAL_URL=http://127.0.0.1:54321
//   SUPABASE_LOCAL_ANON_KEY=…            (the local anon key)
//   SUPABASE_LOCAL_SERVICE_ROLE_KEY=…    (local only — used here to seed, never in the app)
import type { Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_LOCAL_URL ?? 'http://127.0.0.1:54321';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — run \`npx supabase status\` and export the local keys`);
  if (!/127\.0\.0\.1|localhost/.test(URL_)) throw new Error('local e2e must target the local stack only');
  return v;
}

let adminClient: SupabaseClient | undefined;
/** Service-role client for seeding the LOCAL database. */
export function admin(): SupabaseClient {
  adminClient ??= createClient(URL_, need('SUPABASE_LOCAL_SERVICE_ROLE_KEY'), {
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
  const email = `p${Date.now()}${Math.floor(Math.random() * 1e6)}@test.local`;
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
  if (plan) {
    const { error: e } = await db.from('subscriptions').insert({ parent_id: uid, plan });
    if (e) throw e;
  }
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
        avatar: c.avatar ?? 'b1',
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
