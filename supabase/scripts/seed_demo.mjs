// Creates (or refreshes) the DEMO account on a Supabase project: a parent with an
// annual plan, one child, and the shared demo pairing code 472918 (is_demo — it
// only works while the Edge Function secret DEMO_MODE=true). Remove before
// public launch: `node supabase/scripts/seed_demo.mjs --remove`.
//
// `--board` also fills the weekly leaderboard for a presentation: 5 DEMO families
// (board-1…5@demo.gharsah.app — never a real account) from SA / ID / US, each with one
// child and stars this week. `--remove` deletes them too.
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

// The leaderboard's demo families: «child father» + the family's flag.
const BOARD = [
  {
    parent: "سلمان",
    country: "SA",
    child: "فهد",
    gender: "boy",
    avatar: "boy-2",
    stars: 14,
  },
  {
    parent: "Ahmad Fauzi",
    country: "ID",
    child: "Rizky",
    gender: "boy",
    avatar: "id-boy-1",
    stars: 12,
  },
  {
    parent: "فهد",
    country: "SA",
    child: "سارة",
    gender: "girl",
    avatar: "girl-2",
    stars: 11,
  },
  {
    parent: "Yusuf",
    country: "US",
    child: "Adam",
    gender: "boy",
    avatar: "en-boy-2",
    stars: 9,
  },
  {
    parent: "Budi",
    country: "ID",
    child: "Aisyah",
    gender: "girl",
    avatar: "id-girl-1",
    stars: 7,
  },
];
const boardEmail = (i) => `board-${i + 1}@demo.gharsah.app`;

const existing = await findUser(EMAIL);
if (process.argv.includes("--remove")) {
  if (existing) await db.auth.admin.deleteUser(existing.id); // cascades to every demo row
  await db.from("pairing_codes").delete().eq("code", CODE);
  for (let i = 0; i < BOARD.length; i++) {
    const u = await findUser(boardEmail(i));
    if (u) await db.auth.admin.deleteUser(u.id);
  }
  console.log("demo account (and the leaderboard demo families) removed");
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
// the board shows «child + father»: the demo parent gets a first name (not «حساب تجريبي»)
await db
  .from("parents")
  .update({ name: "عبدالعزيز", country: "SA" })
  .eq("id", uid);
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

if (process.argv.includes("--board")) {
  const { randomBytes } = await import("node:crypto");
  // (lesson, stage) pairs: each pair is one star (the primary key)
  const { data: lessons, error: le } = await db
    .from("lessons")
    .select("lesson_id")
    .order("lesson_id")
    .limit(10);
  if (le) throw le;
  const STAGES = ["listen_full", "ayah_repeat", "full_twice", "hadith"];
  const pairs = lessons.flatMap((l) =>
    STAGES.map((stage) => ({ lesson_id: l.lesson_id, stage })),
  );
  for (let i = 0; i < BOARD.length; i++) {
    const f = BOARD[i];
    let u = await findUser(boardEmail(i));
    if (!u) {
      const r = await db.auth.admin.createUser({
        email: boardEmail(i),
        password: randomBytes(18).toString("base64url"), // nobody signs in to these
        email_confirm: true,
        user_metadata: { name: f.parent, country: f.country },
      });
      if (r.error) throw r.error;
      u = r.data.user;
    }
    await db
      .from("parents")
      .update({ name: f.parent, country: f.country })
      .eq("id", u.id);
    let { data: kid } = await db
      .from("children")
      .select("id")
      .eq("parent_id", u.id)
      .limit(1)
      .maybeSingle();
    if (!kid) {
      const r = await db
        .from("children")
        .insert({
          parent_id: u.id,
          name: f.child,
          age: 10,
          gender: f.gender,
          avatar: f.avatar,
          schedule_days: [0, 1, 2, 3, 4, 5, 6],
          schedule_time: 1020,
          review_days: [5],
        })
        .select("id")
        .single();
      if (r.error) throw r.error;
      kid = r.data;
    }
    // this week's stars (re-run safe: the old ones are replaced)
    await db.from("star_events").delete().eq("child_id", kid.id);
    const rows = pairs.slice(0, f.stars).map((p, n) => ({
      child_id: kid.id,
      ...p,
      earned_at: new Date(Date.now() - (i * 60 + n) * 60_000).toISOString(),
    }));
    const r = await db.from("star_events").insert(rows);
    if (r.error) throw r.error;
  }
  console.log(
    `leaderboard demo: ${BOARD.map((f) => `${f.child} ${f.parent.split(" ")[0]} (${f.country})`).join(" · ")}`,
  );
}
