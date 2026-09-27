-- غَرْسة — core schema (Firebase → Supabase, docs/supabase-migration.md).
-- Days are integers 0 = السبت … 6 = الجمعة (the app's week order).
-- Server-owned values (stars, stats, pairing, sessions) are written only by
-- triggers / SECURITY DEFINER functions / Edge Functions — never by clients (RLS: 20260927100100_rls.sql).

-- ── helpers used by CHECK constraints (must be IMMUTABLE) ────────────────────

create or replace function public.days_ok(d int[])
returns boolean language sql immutable set search_path = '' as $$
  select d is not null
     and d <@ array[0,1,2,3,4,5,6]
     and cardinality(d) = (select count(distinct x) from unnest(d) as x)
$$;

-- schedule_custom = {"<day 0-6>": <minutes 0-1439>, …}
create or replace function public.custom_times_ok(c jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(c) = 'object'
     and not exists (
       select 1 from jsonb_each(c) as e(k, v)
       where e.k !~ '^[0-6]$'
          or jsonb_typeof(e.v) <> 'number'
          or (e.v)::numeric <> floor((e.v)::numeric)
          or (e.v)::numeric not between 0 and 1439)
$$;

-- ── parents ──────────────────────────────────────────────────────────────────

create table public.parents (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  email text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  created_at timestamptz not null default now()
);

-- A parent row for every non-anonymous sign-up (name from the sign-up metadata).
-- Anonymous users are child devices and never get a parents row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.parents (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'ولي الأمر'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── children (NO "level" field — removed everywhere) ─────────────────────────

create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  age int not null check (age between 8 and 13),
  gender text not null check (gender in ('boy', 'girl')),
  avatar text not null check (avatar ~ '^[a-z0-9_-]{1,24}$'),
  schedule_days int[] not null check (public.days_ok(schedule_days) and cardinality(schedule_days) between 1 and 7),
  schedule_time int not null check (schedule_time between 0 and 1439),
  schedule_custom jsonb not null default '{}'::jsonb check (public.custom_times_ok(schedule_custom)),
  session_duration int not null default 45 check (session_duration in (30, 45, 60)),
  reminder boolean not null default true,
  -- Weekly review days: 1–3 of the lesson days.
  review_days int[] not null check (
    public.days_ok(review_days)
    and cardinality(review_days) between 1 and 3
    and review_days <@ schedule_days
  ),
  created_at timestamptz not null default now()
);
create index children_parent_idx on public.children (parent_id);

-- ── subscriptions (mock Play today; provider 'play' = server-verified later) ─

create table public.subscriptions (
  parent_id uuid primary key references public.parents (id) on delete cascade,
  plan text not null default 'none' check (plan in ('monthly', 'annual', 'trial', 'none')),
  status text not null default 'active' check (status in ('active', 'expired', 'canceled')),
  provider text not null default 'mock' check (provider in ('mock', 'play')),
  started_at timestamptz not null default now(),
  renews_at timestamptz
);

-- What each plan includes (read by the plans pages; content is locked «قريبًا» beyond launch content).
create table public.plan_catalog (
  plan text primary key check (plan in ('monthly', 'annual', 'trial')),
  max_children int,           -- null = unlimited
  period_days int not null,
  quran_scope text not null,  -- e.g. 'juz_amma', '6_ajza'
  hadith_count int not null,
  weekly_review boolean not null
);
insert into public.plan_catalog values
  ('monthly', 1,    31,  'juz_amma', 3,  true),
  ('annual',  null, 366, '6_ajza',   30, true),
  ('trial',   1,    7,   'juz_amma', 3,  true);

-- The plan in force now ('none' when missing, not active or past renews_at).
create or replace function public.active_plan(p uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select s.plan from public.subscriptions s
    where s.parent_id = p
      and s.status = 'active'
      and s.plan <> 'none'
      and (s.renews_at is null or s.renews_at > now())
  ), 'none')
$$;

-- Clients only choose the plan; the server fills the rest. A renewal extends
-- from the current expiry while it is still in the future.
-- SECURITY INVOKER on purpose: current_user must be the caller, not the owner.
create or replace function public.subscriptions_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  days int;
  base timestamptz;
begin
  if new.provider = 'play'
     and (current_user in ('postgres', 'service_role', 'supabase_admin')
          or coalesce(auth.jwt() ->> 'role', '') = 'service_role') then
    return new; -- server-verified purchases (future Google Play Billing)
  end if;
  new.provider := 'mock';
  if new.plan = 'none' then
    new.status := 'canceled';
    new.renews_at := now();
    return new;
  end if;
  select period_days into days from public.plan_catalog where plan = new.plan;
  base := now();
  if tg_op = 'UPDATE' and old.status = 'active' and old.renews_at > now() and old.plan = new.plan then
    base := old.renews_at;
  end if;
  new.status := 'active';
  new.started_at := case when tg_op = 'UPDATE' and old.plan = new.plan and old.status = 'active' then old.started_at else now() end;
  new.renews_at := base + make_interval(days => days);
  return new;
end $$;

create trigger subscriptions_guard
  before insert or update on public.subscriptions
  for each row execute function public.subscriptions_guard();

-- Monthly plan = one child (was UI-only in Firebase). Annual = unlimited.
create or replace function public.children_plan_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  lim int;
  n int;
begin
  -- Serialize concurrent inserts for the same parent.
  perform 1 from public.parents where id = new.parent_id for update;
  select max_children into lim from public.plan_catalog where plan = public.active_plan(new.parent_id);
  if lim is null then
    return new;
  end if;
  select count(*) into n from public.children where parent_id = new.parent_id;
  if n >= lim then
    raise exception 'plan-child-limit' using errcode = 'P0001',
      hint = 'الباقة الشهرية لابن واحد — رقِّ إلى السنوية لإضافة ابن آخر.';
  end if;
  return new;
end $$;

create trigger children_plan_limit
  before insert on public.children
  for each row execute function public.children_plan_limit();

-- ── pairing (Edge Functions only — no client policies) ───────────────────────

create table public.pairing_codes (
  code text primary key check (code ~ '^[0-9]{6}$'),
  parent_id uuid not null references public.parents (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  revoked boolean not null default false,
  is_demo boolean not null default false
);
create index pairing_codes_child_idx on public.pairing_codes (child_id);

create table public.child_sessions (
  device_uid uuid primary key references auth.users (id) on delete cascade, -- anonymous auth uid
  parent_id uuid not null references public.parents (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  paired_at timestamptz not null default now(),
  revoked boolean not null default false
);
create index child_sessions_child_idx on public.child_sessions (child_id);

-- Wrong-code attempts per device (5 per 10 min), Edge Functions only.
create table public.claim_attempts (
  device_uid uuid not null,
  attempted_at timestamptz not null default now()
);
create index claim_attempts_device_idx on public.claim_attempts (device_uid, attempted_at);

-- ── lessons (seeded from content/ by supabase/scripts/build_seed.mjs) ────────

create table public.lessons (
  lesson_id text primary key check (lesson_id ~ '^[a-z0-9-]{1,64}$'),
  kind text not null check (kind in ('surah', 'hadith', 'review')),
  ref text not null,            -- surah number, hadith id, or 'weekly'
  title text not null,
  hadith_id text,               -- the day's hadith (surah lessons)
  project_id text,              -- the day's project (surah lessons)
  available boolean not null default false, -- false = locked «قريبًا»
  sort_order int not null
);

-- ── progress (the 3-stage memorization flow) ─────────────────────────────────

create table public.progress (
  child_id uuid not null references public.children (id) on delete cascade,
  lesson_id text not null references public.lessons (lesson_id) on delete cascade,
  stage text not null default 'listen_full'
    check (stage in ('listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'done')),
  ayah_index int not null default 0 check (ayah_index between 0 and 300),
  ayah_reps int not null default 0 check (ayah_reps between 0 and 5),
  full_reps int not null default 0 check (full_reps between 0 and 2),
  -- LessonAgent resume point + what the child did (same meaning as the Firestore checkpoint).
  step_index int not null default 0 check (step_index between 0 and 99),
  done_refs text[] not null default '{}'
    check (cardinality(done_refs) <= 300 and array_to_string(done_refs, ',') ~ '^([0-9]{1,3}:[0-9]{1,3}(,|$))*$'),
  project_assigned text check (project_assigned ~ '^[a-z0-9-]{1,64}$'),
  reported_project text check (reported_project ~ '^[a-z0-9-]{1,64}$'),
  stars int not null default 0 check (stars between 0 and 4),  -- server-owned
  started_at timestamptz not null default now(),               -- server-owned
  completed_at timestamptz,                                    -- server-owned
  updated_at timestamptz not null default now(),               -- server-owned
  primary key (child_id, lesson_id)
);

create or replace function public.stage_rank(s text)
returns int language sql immutable set search_path = '' as $$
  select array_position(array['listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'done'], s)
$$;

-- One star per completed stage (max 4 per lesson); earned_at drives the weekly board.
create table public.star_events (
  child_id uuid not null references public.children (id) on delete cascade,
  lesson_id text not null references public.lessons (lesson_id) on delete cascade,
  stage text not null check (stage in ('listen_full', 'ayah_repeat', 'full_twice', 'hadith')),
  earned_at timestamptz not null default now(),
  primary key (child_id, lesson_id, stage)
);
create index star_events_week_idx on public.star_events (earned_at);

-- Days (Riyadh) on which a lesson was finished — for the streak.
create table public.lesson_days (
  child_id uuid not null references public.children (id) on delete cascade,
  day date not null,
  primary key (child_id, day)
);

create or replace function public.riyadh_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Riyadh')::date
$$;

-- Server-owned columns, forward-only stages, stars and lesson days.
create or replace function public.progress_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  from_rank int;
  st text;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.started_at := now();
    new.completed_at := null;
    from_rank := 1;
  else
    new.started_at := old.started_at;
    new.completed_at := old.completed_at;
    -- A finished lesson stays finished; stages only move forward.
    if old.stage = 'done' then
      new.stage := 'done';
    end if;
    if public.stage_rank(new.stage) < public.stage_rank(old.stage) then
      raise exception 'progress-stage-backwards' using errcode = 'P0001';
    end if;
    from_rank := public.stage_rank(old.stage);
  end if;
  -- Every stage left behind earns its star (once).
  foreach st in array (array['listen_full', 'ayah_repeat', 'full_twice', 'hadith'])[from_rank:public.stage_rank(new.stage) - 1] loop
    insert into public.star_events (child_id, lesson_id, stage)
    values (new.child_id, new.lesson_id, st)
    on conflict do nothing;
  end loop;
  new.stars := (select count(*) from public.star_events e where e.child_id = new.child_id and e.lesson_id = new.lesson_id);
  if new.stage = 'done' and new.completed_at is null then
    new.completed_at := now();
    insert into public.lesson_days (child_id, day) values (new.child_id, public.riyadh_today())
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger progress_guard
  before insert or update on public.progress
  for each row execute function public.progress_guard();

-- ── submissions (the project report recording — the only stored child audio) ─

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  lesson_id text not null references public.lessons (lesson_id) on delete cascade,
  stage text check (stage in ('listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'project')),
  ayah_index int check (ayah_index between 0 and 300),
  project_id text check (project_id ~ '^[a-z0-9-]{1,64}$'),
  storage_path text not null unique,
  duration_ms int not null check (duration_ms between 1000 and 180000),
  created_at timestamptz not null default now()
);
create index submissions_child_idx on public.submissions (child_id, created_at desc);

-- ── leaderboard (refreshed by pg_cron; see 20260927100200_server.sql) ─────────

create table public.leaderboard (
  week_key date not null,
  rank int not null,
  child_id uuid not null references public.children (id) on delete cascade,
  first_name text not null,
  stars int not null,
  primary key (week_key, child_id)
);

-- ── storage objects to delete (a child/submission row went away) ─────────────

create table public.storage_cleanup_queue (
  id bigint generated always as identity primary key,
  bucket text not null default 'recordings',
  path text not null,
  queued_at timestamptz not null default now()
);

create or replace function public.enqueue_recording_cleanup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_cleanup_queue (path) values (old.storage_path);
  return old;
end $$;

-- Cascades from a deleted child fire this per submission too (replaces onChildDeleted).
create trigger submissions_cleanup
  after delete on public.submissions
  for each row execute function public.enqueue_recording_cleanup();

-- ── helpers for RLS ──────────────────────────────────────────────────────────

create or replace function public.is_anonymous_user()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- The signed-in (non-anonymous) parent owns this child.
create or replace function public.is_parent_of(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not public.is_anonymous_user()
     and exists (select 1 from public.children ch where ch.id = c and ch.parent_id = auth.uid())
$$;

-- The child this (anonymous) device is paired with — null when unpaired or revoked.
create or replace function public.current_child_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.child_id from public.child_sessions s
  where s.device_uid = auth.uid() and not s.revoked
$$;

create or replace function public.current_child_parent_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.parent_id from public.child_sessions s
  where s.device_uid = auth.uid() and not s.revoked
$$;
