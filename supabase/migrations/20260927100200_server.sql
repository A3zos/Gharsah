-- غَرْسة — server logic in Postgres (replaces the Firestore triggers + scheduled Functions):
-- stats are computed on read (nothing denormalized to keep in sync), the weekly
-- leaderboard is refreshed by pg_cron, and cleanup runs daily.

-- Yearly plan size (functions/src/config/yearly_plan.json: 295 ayat).
create or replace function public.plan_total_ayat()
returns int language sql immutable set search_path = '' as $$ select 295 $$;

-- Saturday 00:00 Riyadh starts the competition week («يتجدد أسبوعيًا»).
create or replace function public.week_start(d date default public.riyadh_today())
returns date language sql immutable set search_path = '' as $$
  select d - ((extract(dow from d)::int + 1) % 7)
$$;

-- Consecutive *scheduled* days with a finished lesson, walking back from today;
-- today not done yet doesn't break it; unscheduled days are skipped.
create or replace function public.child_streak(c uuid)
returns int language plpgsql stable security definer set search_path = '' as $$
declare
  days int[];
  d date := public.riyadh_today();
  today date := d;
  n int := 0;
  i int;
begin
  select schedule_days into days from public.children where id = c;
  if days is null or cardinality(days) = 0 then
    return 0;
  end if;
  for i in 1..400 loop
    if ((extract(dow from d)::int + 1) % 7) = any (days) then
      if exists (select 1 from public.lesson_days l where l.child_id = c and l.day = d) then
        n := n + 1;
      elsif d <> today then
        exit;
      end if;
    end if;
    d := d - 1;
  end loop;
  return n;
end $$;

-- Everything the dashboard / child home show (was `stats` on the child doc).
-- Callable by the child's parent or its paired device only.
create or replace function public.child_stats(c uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  refs text[];
  ayat int;
  pct int;
  result jsonb;
begin
  -- coalesce: current_child_id() is NULL for non-devices, and NOT (false OR NULL) is NULL.
  if not coalesce(public.is_parent_of(c) or c = public.current_child_id(), false) then
    raise exception 'not-allowed' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct r), '{}') into refs
  from public.progress p, unnest(p.done_refs) as r where p.child_id = c;
  ayat := cardinality(refs);
  pct := least(100, round(ayat * 100.0 / public.plan_total_ayat()));
  select jsonb_build_object(
    'ayat', ayat,
    'surahs', (select count(*) from public.star_events e join public.lessons l using (lesson_id)
               where e.child_id = c and e.stage = 'full_twice' and l.kind = 'surah'),
    'surahsDone', coalesce((select jsonb_agg(jsonb_build_object('surah', l.ref::int, 'at', e.earned_at) order by e.earned_at)
               from public.star_events e join public.lessons l using (lesson_id)
               where e.child_id = c and e.stage = 'full_twice' and l.kind = 'surah'), '[]'::jsonb),
    'hadith', (select count(distinct l.hadith_id) from public.star_events e join public.lessons l using (lesson_id)
               where e.child_id = c and e.stage = 'hadith' and l.hadith_id is not null),
    'hadithDone', coalesce((select jsonb_agg(jsonb_build_object('id', x.hadith_id, 'at', x.at) order by x.at)
               from (select l.hadith_id, min(e.earned_at) as at from public.star_events e join public.lessons l using (lesson_id)
                     where e.child_id = c and e.stage = 'hadith' and l.hadith_id is not null group by l.hadith_id) x), '[]'::jsonb),
    'projects', (select count(*) from public.submissions s where s.child_id = c),
    'ayatBySurah', coalesce((select jsonb_object_agg(k, n) from (
               select split_part(r, ':', 1) as k, count(*) as n from unnest(refs) as r group by 1) t), '{}'::jsonb),
    -- The lowest surah with memorized ayat that isn't complete yet.
    'surahInProgress', (select jsonb_build_object('surah', t.k::int, 'done', t.n)
               from (select split_part(r, ':', 1) as k, count(*) as n from unnest(refs) as r group by 1) t
               where not exists (select 1 from public.star_events e join public.lessons l using (lesson_id)
                                 where e.child_id = c and e.stage = 'full_twice' and l.kind = 'surah' and l.ref = t.k)
               order by t.k::int limit 1),
    -- The most recently practised surah and how many of its ayat that lesson covered.
    'latestAyat', (select jsonb_build_object('surah', split_part(p.done_refs[cardinality(p.done_refs)], ':', 1)::int,
                     'count', (select count(*) from unnest(p.done_refs) as r
                               where split_part(r, ':', 1) = split_part(p.done_refs[cardinality(p.done_refs)], ':', 1)),
                     'at', p.updated_at)
               from public.progress p where p.child_id = c and cardinality(p.done_refs) > 0
               order by p.updated_at desc limit 1),
    'pendingProject', (select p.project_assigned from public.progress p
               where p.child_id = c and p.project_assigned is not null
                 and not exists (select 1 from public.submissions s where s.child_id = c and s.project_id = p.project_assigned)
                 and not exists (select 1 from public.progress q where q.child_id = c and q.reported_project = p.project_assigned)
               order by p.updated_at desc limit 1),
    'streak', public.child_streak(c),
    'planPct', pct,
    'stage', case when pct <= 33 then 'seed' when pct <= 66 then 'sprout' else 'tree' end,
    'stars', (select count(*) from public.star_events e where e.child_id = c),
    'weekStars', (select count(*) from public.star_events e where e.child_id = c
               and e.earned_at >= (public.week_start()::timestamp at time zone 'Asia/Riyadh')),
    'lessonDays', coalesce((select jsonb_agg(d.day order by d.day) from (
               select day from public.lesson_days where child_id = c order by day desc limit 120) d), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- ── leaderboard ──────────────────────────────────────────────────────────────

create or replace function public.refresh_leaderboard()
returns void language plpgsql security definer set search_path = '' as $$
declare
  wk date := public.week_start();
begin
  delete from public.leaderboard where week_key < wk - 7;
  delete from public.leaderboard where week_key = wk;
  insert into public.leaderboard (week_key, rank, child_id, first_name, stars)
  select wk,
         row_number() over (order by t.stars desc, t.child_id),
         t.child_id,
         split_part(btrim(ch.name), ' ', 1),
         t.stars
  from (select e.child_id, count(*)::int as stars
        from public.star_events e
        where e.earned_at >= (wk::timestamp at time zone 'Asia/Riyadh')
        group by e.child_id) t
  join public.children ch on ch.id = t.child_id;
end $$;

-- The child's view: top 5 + its own standing. Other children stay anonymous
-- (rank + stars only) — CLAUDE.md §12 / Designed for Families; `first_name` is
-- returned only for the child's own row (docs/supabase-migration.md §3.1).
create or replace function public.get_leaderboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.current_child_id();
  wk date := public.week_start();
  total int;
  mine record;
  above int;
begin
  if me is null then
    raise exception 'not-allowed' using errcode = '42501';
  end if;
  select count(*) into total from public.leaderboard where week_key = wk;
  select * into mine from public.leaderboard where week_key = wk and child_id = me;
  if mine.rank is not null and mine.rank > 1 then
    select stars into above from public.leaderboard where week_key = wk and rank = mine.rank - 1;
  end if;
  return jsonb_build_object(
    'weekKey', wk,
    'total', total,
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
               'rank', l.rank, 'stars', l.stars, 'me', l.child_id = me,
               'firstName', case when l.child_id = me then l.first_name end) order by l.rank)
             from public.leaderboard l where l.week_key = wk and l.rank <= 5), '[]'::jsonb),
    'own', case when mine.rank is null then null else jsonb_build_object(
             'rank', mine.rank, 'stars', mine.stars, 'total', total,
             'topPercent', least(100, greatest(10, ceil(mine.rank * 100.0 / total / 10) * 10)),
             'gapToAbove', case when above is null then null else above - mine.stars end) end
  );
end $$;

-- ── cleanup (daily) ──────────────────────────────────────────────────────────

-- Recordings kept 90 days; dead pairing codes and old attempts removed; storage
-- objects without a submission row (failed uploads) queued for deletion.
create or replace function public.daily_cleanup()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.submissions where created_at < now() - interval '90 days'; -- trigger queues the files
  delete from public.pairing_codes
    where not is_demo and (expires_at < now() - interval '1 day' or revoked or claimed_at is not null);
  delete from public.claim_attempts where attempted_at < now() - interval '1 day';
  insert into public.storage_cleanup_queue (path)
  select o.name from storage.objects o
  where o.bucket_id = 'recordings'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.submissions s where s.storage_path = o.name)
    and not exists (select 1 from public.storage_cleanup_queue q where q.path = o.name);
end $$;

-- Server-only functions: not callable by clients.
revoke execute on function public.refresh_leaderboard(), public.daily_cleanup() from public, anon, authenticated;
revoke execute on function public.child_stats(uuid), public.get_leaderboard() from public, anon;
grant execute on function public.child_stats(uuid), public.get_leaderboard() to authenticated;
