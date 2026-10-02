-- غَرْسة — the weekly board: top 5 + own row, dense ranks, privacy (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- One parent (annual plan → no child limit) with 22 children:
--   A30, T2, T3 — 30 stars each (tie; reached earliest → latest);
--   P29 … P12  — 29 … 12 stars (18 children, one per value);
--   D (بدر)    — 4 stars → dense rank 20.
insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('30000000-0000-0000-0000-00000000000a', 'lb@test.local', false, '{"name":"ولي أمر"}'),
  ('30000000-0000-0000-0000-0000000000d1', null, true, '{}'),
  ('30000000-0000-0000-0000-0000000000d2', null, true, '{}');
insert into public.subscriptions (parent_id, plan) values ('30000000-0000-0000-0000-00000000000a', 'annual')
  on conflict (parent_id) do update set plan = excluded.plan; -- sign-up already started the free pilot

create temp table kids (id uuid, name text, points int, mins int);
insert into kids values
  ('31000000-0000-0000-0000-000000000030', 'ظلA', 30, 300),
  ('31000000-0000-0000-0000-000000000031', 'ظلT', 30, 200),
  ('31000000-0000-0000-0000-000000000032', 'ظلU', 30, 100);
insert into kids
  select ('31000000-0000-0000-0000-0000000001' || lpad(p::text, 2, '0'))::uuid, 'ظل' || p, p, 50
  from generate_series(12, 29) as p;
insert into kids values ('31000000-0000-0000-0000-0000000000dd', 'بدر ظل', 4, 10);

insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  select id, '30000000-0000-0000-0000-00000000000a', name, 10, 'boy', 'b2', '{0,1}', 1020, '{1}' from kids;

-- `points` stars per child, all this week; reached_at = now − mins.
insert into public.star_events (child_id, lesson_id, stage, earned_at)
  select k.id, x.lesson_id, x.stage, now() - make_interval(mins => k.mins)
  from kids k
  cross join lateral (
    select l.lesson_id, st.stage
    from public.lessons l
    cross join unnest(array['listen_full', 'ayah_repeat', 'full_twice', 'hadith']) as st(stage)
    order by l.lesson_id, st.stage
    limit k.points
  ) x;

insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('30000000-0000-0000-0000-0000000000d1', '30000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-0000000000dd'),
  ('30000000-0000-0000-0000-0000000000d2', '30000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000031');

create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- D — ranked 20
select pg_temp.act_as('30000000-0000-0000-0000-0000000000d1', true);
create temp table b as select public.get_leaderboard() as j;
select is(jsonb_array_length((select j from b) -> 'top'), 5, 'top has 5 rows');
select is((select j from b) #>> '{me,rank}', '20', 'D is ranked 20 (dense ranking)');
select is((select j from b) #>> '{me,inTop5}', 'false', 'D is not in the top 5');
select is((select j from b) #>> '{me,points}', '4', 'D has 4 stars');
select is((select j from b) #>> '{me,gapToAbove}', '8', '8 stars to the rank above (12)');
select is((select j from b) #>> '{me,firstName}', 'بدر', 'only the own first name');
select is((select string_agg(e ->> 'rank', ',') from jsonb_array_elements((select j from b) -> 'top') e),
  '1,1,1,2,3', 'ties share a rank: 30,30,30 → 1; then 29 → 2, 28 → 3');
select is((select j from b) ->> 'total', '22', '22 children with stars this week');
select ok((select j from b)::text !~ 'ظل' , 'no other child''s name leaves the database');
select ok((select j from b)::text !~ '31000000-', 'no child id leaves the database');
select ok((select bool_and(e ->> 'avatar' = 'neutral') from jsonb_array_elements((select j from b) -> 'top') e),
  'other rows show a neutral avatar only');

-- T2 — tied at 30 but reached it second → listed second, rank 1, own row highlighted
select pg_temp.act_as('30000000-0000-0000-0000-0000000000d2', true);
create temp table t as select public.get_leaderboard() as j;
select is((select string_agg(e ->> 'me', ',') from jsonb_array_elements((select j from t) -> 'top') e),
  'false,true,false,false,false', 'tie-break: earlier to reach the points is listed first');
select is((select j from t) #>> '{me,gapToAbove}', null, 'first place: nothing above');

-- a parent session (not a paired device) is refused
select pg_temp.act_as('30000000-0000-0000-0000-00000000000a', false);
select throws_ok($$select public.get_leaderboard()$$, '42501', 'only a paired child device may read the board');

select * from finish();
rollback;
