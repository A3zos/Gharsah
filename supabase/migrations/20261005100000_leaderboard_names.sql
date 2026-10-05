-- غَرْسة — the weekly board shows every child: [flag] child's first name + father's first name.
-- PRODUCT RULE (2026-10-05, product owner): names show for ALL children by default.
-- * parents.country: 'SA' | 'US' | 'ID' — NOT NULL, default 'SA'. Every account so far
--   registered from the Arabic UI → backfilled 'SA'. Sign-up sends it (metadata.country).
-- * parents.name (the parent's full name, from sign-up): a row that only got the
--   fallback (the email's local part / «ولي الأمر») is refilled from the auth metadata
--   (full_name / name) when it has one. public.parent_first_name() never returns a
--   fallback as a name, so the board then shows the child's first name alone.
-- * children.board_show_name: the parent's OPT-OUT (default true, every row true). Off →
--   that child shows as «بطل» / «بطلة» (no names), the flag stays.
-- * get_leaderboard(): every row = {rank, points, me, avatar, firstName, fatherName,
--   displayName, hero, country}. Never a last name, email, age or id.
--   displayName = child's first word + ' ' + parent's first word; no parent name → the
--   child's first word; no child name / opted out → «بطل» / «بطلة» (hero = the gender,
--   so the app says it in the UI language).

-- ── parents.country ─────────────────────────────────────────────────────────
alter table public.parents add column if not exists country text;
update public.parents set country = 'SA' where country is null;
alter table public.parents alter column country set default 'SA';
alter table public.parents alter column country set not null;
alter table public.parents drop constraint if exists parents_country_check;
alter table public.parents add constraint parents_country_check check (country in ('SA', 'US', 'ID'));
grant update (country) on public.parents to authenticated;

-- ── parents.name: the fallback name refilled from the auth metadata ─────────────
-- A name that is only the sign-up fallback (or a placeholder) is not a person's name.
create or replace function public.parent_first_name(p_name text, p_email text)
returns text language sql immutable set search_path = '' as $$
  select case
    when n = '' then null
    when n = split_part(coalesce(p_email, ''), '@', 1) then null
    when n in ('ولي الأمر', 'ولي أمر', 'حساب تجريبي') then null
    else split_part(n, ' ', 1)
  end
  from (select btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')) as n) x
$$;

update public.parents p
   set name = left(btrim(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                                  btrim(u.raw_user_meta_data ->> 'name'))), 60)
  from auth.users u
 where u.id = p.id
   and public.parent_first_name(p.name, p.email) is null
   and coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                nullif(btrim(u.raw_user_meta_data ->> 'name'), '')) is not null;

-- Sign-up: the name (name / full_name) and the country (SA / US / ID, else SA).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'country', '')));
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  insert into public.parents (id, name, email, country)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
                  nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
                  split_part(new.email, '@', 1), 'ولي الأمر'), 60),
    new.email,
    case when c in ('SA', 'US', 'ID') then c else 'SA' end
  )
  on conflict (id) do nothing;
  insert into public.subscriptions (parent_id, plan) values (new.id, 'trial')
  on conflict (parent_id) do nothing;
  return new;
end $$;

-- ── children.board_show_name (opt-out) ─────────────────────────────────────────
alter table public.children add column if not exists board_show_name boolean not null default true;
update public.children set board_show_name = true where board_show_name is distinct from true;
grant update (board_show_name) on public.children to authenticated;

-- ── the board ──────────────────────────────────────────────────────────────────
-- One child's public face on the board (first names only — never a last name).
create or replace function public.board_face(c public.children, p public.parents)
returns jsonb language sql stable set search_path = '' as $$
  with f as (
    select
      case when c.board_show_name then nullif(split_part(btrim(regexp_replace(coalesce(c.name, ''), '\s+', ' ', 'g')), ' ', 1), '') end as first,
      case when c.board_show_name then public.parent_first_name(p.name, p.email) end as father,
      case when c.gender = 'girl' then 'بطلة' else 'بطل' end as hero_word
  )
  select jsonb_build_object(
    'firstName', f.first,
    'fatherName', case when f.first is null then null else f.father end,
    'displayName', case
      when f.first is null then f.hero_word
      when f.father is null then f.first
      else f.first || ' ' || f.father end,
    'hero', case when f.first is null then (case when c.gender = 'girl' then 'girl' else 'boy' end) end,
    'country', coalesce(p.country, 'SA'))
  from f
$$;
revoke execute on function public.board_face(public.children, public.parents) from public, anon, authenticated;

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
    select split_part(btrim(c.name), ' ', 1) as first_name, c.avatar, public.board_face(c, p) as face
    from public.children c join public.parents p on p.id = c.parent_id
    where c.id = me
  )
  select jsonb_build_object(
    'weekKey', wk,
    'total', (select count(*) from ranked),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.rank,
               'points', r.points,
               'me', r.child_id = me,
               'avatar', coalesce(c.avatar, 'neutral'))
               || coalesce(public.board_face(c, p), '{}'::jsonb)
             order by r.pos)
      from ranked r
      left join public.children c on c.id = r.child_id
      left join public.parents p on p.id = c.parent_id
      where r.pos <= 5), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
               'rank', m.rank,
               'points', m.points,
               'inTop5', m.in_top5,
               -- points to the next higher rank (null in first place)
               'gapToAbove', (select min(r.points) - m.points from ranked r where r.points > m.points),
               'avatar', (select avatar from kid))
               || coalesce((select face from kid), '{}'::jsonb)
               -- the child's own first name, as before (even when hidden from others)
               || jsonb_build_object('ownFirstName', (select first_name from kid))
      from mine m)
  ) into result;
  return result;
end $$;

revoke execute on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;
