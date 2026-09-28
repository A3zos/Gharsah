-- غَرْسة — admin statistics (/admin on the web).
-- * public.admins: who is an admin. RLS on and NO client policies; clients have no
--   privileges on it at all — admins are added by hand in the SQL Editor.
-- * public.is_admin(): the caller is in admins and is not an anonymous (child) session.
-- * public.admin_stats(): the ONLY source of the page's numbers — aggregates only
--   (counts and percentages). No names, emails, recordings or per-child data.
--   Raises 'forbidden' for everyone else.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and not public.is_anonymous_user()
     and exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;

-- Percent with one decimal, 0 when the base is 0.
create or replace function public.pct(part numeric, whole numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case when coalesce(whole, 0) = 0 then 0 else round(part * 100.0 / whole, 1) end
$$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.riyadh_today();
  since7 timestamptz := (today - 6)::timestamp at time zone 'Asia/Riyadh';
  since30 timestamptz := (today - 29)::timestamp at time zone 'Asia/Riyadh';
  started int;
  completed int;
  assigned int;
  reported int;
  active7 int;
  result jsonb;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where stage = 'done') into started, completed from public.progress;
  select count(*) into assigned from public.progress where project_assigned is not null;
  select count(*) into reported from public.submissions;
  select count(distinct child_id) into active7 from public.progress where updated_at >= since7;

  select jsonb_build_object(
    'generatedAt', now(),
    'parents', jsonb_build_object(
      'total', (select count(*) from public.parents),
      'today', (select count(*) from public.parents where (created_at at time zone 'Asia/Riyadh')::date = today),
      'last7', (select count(*) from public.parents where created_at >= since7),
      'last30', (select count(*) from public.parents where created_at >= since30)
    ),
    'children', jsonb_build_object(
      'total', (select count(*) from public.children),
      'byAge', jsonb_build_object(
        '8-9', (select count(*) from public.children where age between 8 and 9),
        '10-11', (select count(*) from public.children where age between 10 and 11),
        '12-13', (select count(*) from public.children where age between 12 and 13)
      ),
      'byGender', jsonb_build_object(
        'boy', (select count(*) from public.children where gender = 'boy'),
        'girl', (select count(*) from public.children where gender = 'girl')
      )
    ),
    'pairedDevices', (select count(distinct child_id) from public.child_sessions where not revoked),
    'subscriptions', (
      select jsonb_build_object(
        'monthly', count(*) filter (where p = 'monthly'),
        'annual', count(*) filter (where p = 'annual'),
        'trial', count(*) filter (where p = 'trial'),
        'none', count(*) filter (where p = 'none'),
        'active', count(*) filter (where p <> 'none')
      )
      from (select public.active_plan(pa.id) as p from public.parents pa) x
    ),
    'lessons', jsonb_build_object(
      'started', started,
      'completed', completed,
      'completionRate', public.pct(completed, started),
      'byLesson', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'lessonId', t.lesson_id,
                 'title', t.title,
                 'started', t.started,
                 'completed', t.completed,
                 'rate', public.pct(t.completed, t.started))
               order by t.sort_order)
        from (
          select l.lesson_id, l.title, l.sort_order,
                 count(p.child_id) as started,
                 count(p.child_id) filter (where p.stage = 'done') as completed
          from public.lessons l
          left join public.progress p on p.lesson_id = l.lesson_id
          group by l.lesson_id, l.title, l.sort_order
          having bool_or(l.available) or count(p.child_id) > 0
        ) t
      ), '[]'::jsonb)
    ),
    'memorization', jsonb_build_object(
      'ayat', (select count(*) from (select distinct p.child_id, r
                                     from public.progress p, unnest(p.done_refs) as r) t),
      'surahs', (select count(*) from public.star_events e join public.lessons l using (lesson_id)
                 where e.stage = 'full_twice' and l.kind = 'surah'),
      'hadith', (select count(*) from (select distinct e.child_id, l.hadith_id
                                       from public.star_events e join public.lessons l using (lesson_id)
                                       where e.stage = 'hadith' and l.hadith_id is not null) t)
    ),
    'projects', jsonb_build_object(
      'assigned', assigned,
      'reported', reported,
      'reportRate', public.pct(reported, assigned)
    ),
    'engagement', jsonb_build_object(
      'activeToday', (select count(distinct child_id) from public.progress
                      where (updated_at at time zone 'Asia/Riyadh')::date = today),
      'active7', active7,
      'lessonsPerActiveChild', case when active7 = 0 then 0 else round(
        (select count(*) from public.progress where updated_at >= since7)::numeric / active7, 1) end
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'newParents', (select count(*) from public.parents pa
                              where (pa.created_at at time zone 'Asia/Riyadh')::date = d.day),
               'lessonsCompleted', (select count(*) from public.progress pr
                                    where (pr.completed_at at time zone 'Asia/Riyadh')::date = d.day))
             order by d.day)
      from (select (today - k) as day from generate_series(29, 0, -1) as k) d
    )
  ) into result;
  return result;
end $$;

revoke execute on function public.is_admin(), public.admin_stats() from public, anon;
grant execute on function public.is_admin(), public.admin_stats() to authenticated;
revoke execute on function public.pct(numeric, numeric) from public, anon, authenticated;
