// Creates (or refreshes) the DEMO account on a Supabase project: a parent with an
// annual plan, one child, and the shared demo pairing code 472918 (is_demo — it
// only works while the Edge Function secret DEMO_MODE=true). Remove before
// public launch: `node supabase/scripts/seed_demo.mjs --remove`.
//
// Run by the product owner (never by the app, never committed keys):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… DEMO_PASSWORD=… \
//     node supabase/scripts/seed_demo.mjs
// (run from web/ so @supabase/supabase-js resolves, or `npm i @supabase/supabase-js` next to it)
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell (never commit them).",
  );
  process.exit(1);
}
const EMAIL = process.env.DEMO_EMAIL ?? "demo@gharsah.app";
const CODE = "472918";
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

const existing = await findUser(EMAIL);
if (process.argv.includes("--remove")) {
  if (existing) await db.auth.admin.deleteUser(existing.id); // cascades to every demo row
  await db.from("pairing_codes").delete().eq("code", CODE);
  console.log("demo account removed");
  process.exit(0);
}

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 8) {
  console.error("Set DEMO_PASSWORD (≥ 8 characters) for the demo parent.");
  process.exit(1);
}
let uid = existing?.id;
if (!uid) {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { name: "حساب تجريبي" },
  });
  if (error) throw error;
  uid = data.user.id;
}
await db
  .from("subscriptions")
  .upsert({ parent_id: uid, plan: "annual" }, { onConflict: "parent_id" });
let { data: child } = await db
  .from("children")
  .select("id")
  .eq("parent_id", uid)
  .limit(1)
  .maybeSingle();
if (!child) {
  const r = await db
    .from("children")
    .insert({
      parent_id: uid,
      name: "عبدالله",
      age: 10,
      gender: "boy",
      avatar: "boy-1",
      schedule_days: [0, 1, 2, 3, 4, 5, 6],
      schedule_time: 1020,
      review_days: [5],
    })
    .select("id")
    .single();
  if (r.error) throw r.error;
  child = r.data;
}
await db.from("pairing_codes").delete().eq("code", CODE);
const { error } = await db.from("pairing_codes").insert({
  code: CODE,
  parent_id: uid,
  child_id: child.id,
  expires_at: new Date(Date.now() + 3650 * 86_400_000).toISOString(),
  is_demo: true,
});
if (error) throw error;
console.log(
  `demo ready: parent ${EMAIL}, child code ${CODE} (works only with DEMO_MODE=true)`,
);
