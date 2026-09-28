-- غَرْسة — the child's weekly board: top 5 + the child's own row.
-- Replaces get_leaderboard() (same name, the child app already calls it).
-- * Computed live from this week's stars (week starts Saturday 00:00 Riyadh).
-- * Dense ranking by weekly points: ties share a rank; within a tie the child
--   who reached those points EARLIER is listed first.
-- * Privacy: other children leave the database only as {rank, points, avatar:'neutral'}
--   — never an id, name, age or real avatar. Only the caller's own first name/avatar.
-- Returns {weekKey, total, top: [{rank, points, avatar, me}] (≤ 5),
--          me: {rank, points, gapToAbove, inTop5, firstName, avatar}}.

create or replace function public.get_leaderboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.current_child_id();
  wk date := public.week_start();
  since timestamptz := wk::timestamp at time zone 'Asia/Riyadh';
  result jsonb;
begin
  if me is null then
    raise exception 'not-allowed' using errcode = '42501';
  end if;
  with pts as (
    select e.child_id, count(*)::int as points, max(e.earned_at) as reached_at
    from public.star_events e
    where e.earned_at >= since
    group by e.child_id
  ),
  ranked as (
    select child_id, points,
           dense_rank() over (order by points desc) as rank,
           row_number() over (order by points desc, reached_at asc, child_id) as pos
    from pts
  ),
  mine as (
    select coalesce((select r.points from ranked r where r.child_id = me), 0) as points,
           coalesce((select r.rank from ranked r where r.child_id = me),
                    -- no stars yet this week: after everyone who has some
                    (select coalesce(max(r.rank), 0) + 1 from ranked r)) as rank,
           exists (select 1 from ranked r where r.child_id = me and r.pos <= 5) as in_top5
  ),
  kid as (
    select split_part(btrim(c.name), ' ', 1) as first_name, c.avatar from public.children c where c.id = me
  )
  select jsonb_build_object(
    'weekKey', wk,
    'total', (select count(*) from ranked),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.rank,
               'points', r.points,
               'me', r.child_id = me,
               'avatar', case when r.child_id = me then (select avatar from kid) else 'neutral' end)
             order by r.pos)
      from ranked r where r.pos <= 5), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
               'rank', m.rank,
               'points', m.points,
               'inTop5', m.in_top5,
               -- points to the next higher rank (null in first place)
               'gapToAbove', (select min(r.points) - m.points from ranked r where r.points > m.points),
               'firstName', (select first_name from kid),
               'avatar', (select avatar from kid))
      from mine m)
  ) into result;
  return result;
end $$;

revoke execute on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;
