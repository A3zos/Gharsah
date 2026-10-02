-- غَرْسة — the new child avatars (public/avatars/child-{boy,girl}-{1..4}.webp).
-- * children.avatar is now a key: 'boy-1'…'boy-4' / 'girl-1'…'girl-4', always of the
--   child's own gender.
-- * Existing children: the old drawn avatars map to the closest new one —
--   girls by hijab colour (g1 pink → girl-1, g2 sky → girl-2, g3 green → girl-3,
--   g4 gold → girl-4, the retired g5 cream → girl-1); boys by skin tone / default
--   (b1 → boy-1, b2 → boy-4, b3 → boy-2, b4 → boy-3). Anything else → boy-1 / girl-1.
-- * A trigger applies the same mapping on every write, so an older web build that
--   still sends 'g1'/'b1' (or a key of the other gender) keeps working.
-- * get_leaderboard(): other children's rows now carry their chosen avatar key
--   (one of 8 shared pictures — still never an id, name or age).

create or replace function public.child_avatar_key(old text, g text)
returns text language sql immutable set search_path = '' as $$
  select case
    when old ~ '^(boy|girl)-[1-4]$' and split_part(old, '-', 1) = g then old
    when g = 'girl' then 'girl-' || case old when 'g2' then '2' when 'g3' then '3' when 'g4' then '4' else '1' end
    else 'boy-' || case old when 'b2' then '4' when 'b3' then '2' when 'b4' then '3' else '1' end
  end
$$;

create or replace function public.children_avatar_key()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.avatar := public.child_avatar_key(new.avatar, new.gender::text);
  return new;
end $$;

drop trigger if exists children_avatar_key on public.children;
create trigger children_avatar_key before insert or update of avatar, gender on public.children
  for each row execute function public.children_avatar_key();

update public.children set avatar = public.child_avatar_key(avatar, gender::text)
  where avatar is distinct from public.child_avatar_key(avatar, gender::text);

-- The board: same as 20260930100000_leaderboard_top5, but every row shows its child's avatar.
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
               -- the avatar key only (one of 8 shared pictures) — never who it is
               'avatar', coalesce(c.avatar, 'neutral'))
             order by r.pos)
      from ranked r left join public.children c on c.id = r.child_id
      where r.pos <= 5), '[]'::jsonb),
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
