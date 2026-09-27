// Deletes every e2e test user (…@test.local) from the project in SUPABASE_E2E_URL —
// deleting the auth user cascades to parents, children, progress, submissions
// (recordings are queued for storage-cleanup). Same env guard as e2e/stack.ts.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_E2E_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_E2E_SERVICE_ROLE_KEY;
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
if (!key) throw new Error('SUPABASE_E2E_SERVICE_ROLE_KEY is not set');
if (!local && process.env.E2E_ALLOW_REMOTE !== '1')
  throw new Error('set E2E_ALLOW_REMOTE=1 for a remote project');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let removed = 0;
for (let page = 1; page < 100; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  for (const u of data.users) {
    if (u.email?.endsWith('@test.local')) {
      await db.auth.admin.deleteUser(u.id);
      removed++;
    }
  }
  if (data.users.length < 200) break;
}
console.log(`removed ${removed} test users`);
