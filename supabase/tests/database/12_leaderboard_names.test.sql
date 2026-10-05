-- غَرْسة — the board shows every child: first name + father's first name + country (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Three families: SA «عبدالعزيز بن محمد» (عمر + سارة), ID «Ahmad Rizki» (Rizky),
-- US with the sign-up fallback name (the email's local part) and no country (Adam).
insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-0000000000a1', 'sa-board@test.local', false, '{"name":"عبدالعزيز بن محمد","country":"SA"}'),
  ('a0000000-0000-0000-0000-0000000000a2', 'id-board@test.local', false, '{"name":"Ahmad Rizki","country":"id"}'),
  ('a0000000-0000-0000-0000-0000000000a3', 'us-board@test.local', false, '{}'),
  ('a0000000-0000-0000-0000-0000000000a4', 'xx-board@test.local', false, '{"name":"X Y","country":"FR"}'),
  ('a0000000-0000-0000-0000-0000000000d1', null, true, '{}');
update public.subscriptions set plan = 'annual' where parent_id = 'a0000000-0000-0000-0000-0000000000a1';

select is((select country from public.parents where id = 'a0000000-0000-0000-0000-0000000000a1'), 'SA', 'sign-up stores the country');
select is((select country from public.parents where id = 'a0000000-0000-0000-0000-0000000000a2'), 'ID', 'the country code is upper-cased');
select is((select country from public.parents where id = 'a0000000-0000-0000-0000-0000000000a3'), 'SA', 'no country → SA (default)');
select is((select country from public.parents where id = 'a0000000-0000-0000-0000-0000000000a4'), 'SA', 'an unknown country → SA');
select throws_ok($$update public.parents set country = 'FR' where id = 'a0000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'only SA / US / ID');
select is((select name from public.parents where id = 'a0000000-0000-0000-0000-0000000000a3'), 'us-board',
  'no name at sign-up → the email fallback (as before)');
update public.parents set country = 'US' where id = 'a0000000-0000-0000-0000-0000000000a3';

select is(public.parent_first_name('عبدالعزيز بن محمد', 'x@y.z'), 'عبدالعزيز', 'the parent''s FIRST name only');
select is(public.parent_first_name('us-board', 'us-board@test.local'), null, 'the email fallback is not a name');
select is(public.parent_first_name('ولي الأمر', null), null, '«ولي الأمر» is not a name');

insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('a1000000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000a1', 'عمر عبدالعزيز الفلاني', 10, 'boy', 'boy-1', '{0,1}', 1020, '{1}'),
  ('a1000000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-0000000000a1', 'سارة', 9, 'girl', 'girl-1', '{0,1}', 1020, '{1}'),
  ('a1000000-0000-0000-0000-0000000000c3', 'a0000000-0000-0000-0000-0000000000a2', 'Rizky Pratama', 11, 'boy', 'id-boy-1', '{0,1}', 1020, '{1}'),
  ('a1000000-0000-0000-0000-0000000000c4', 'a0000000-0000-0000-0000-0000000000a3', 'Adam', 12, 'boy', 'en-boy-1', '{0,1}', 1020, '{1}');
select is((select bool_and(board_show_name) from public.children where id::text like 'a1000000-%'), true,
  'names show by default (opt-out)');

-- stars this week: Rizky 4, Adam 3, عمر 2, سارة 1
insert into public.star_events (child_id, lesson_id, stage, earned_at)
  select k.id, x.lesson_id, x.stage, now() - interval '5 minutes'
  from (values ('a1000000-0000-0000-0000-0000000000c3'::uuid, 4), ('a1000000-0000-0000-0000-0000000000c4'::uuid, 3),
               ('a1000000-0000-0000-0000-0000000000c1'::uuid, 2), ('a1000000-0000-0000-0000-0000000000c2'::uuid, 1)) k(id, n)
  cross join lateral (
    select l.lesson_id, st.stage from public.lessons l
    cross join unnest(array['listen_full', 'ayah_repeat', 'full_twice', 'hadith']) as st(stage)
    order by l.lesson_id, st.stage limit k.n
  ) x;
-- a parent turns names off for سارة
update public.children set board_show_name = false where id = 'a1000000-0000-0000-0000-0000000000c2';

insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('a0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-0000000000c1');
select set_config('request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-0000-0000-0000000000d1', 'role', 'authenticated', 'is_anonymous', true)::text, true);
set local role authenticated;
create temp table b as select public.get_leaderboard() as j;
reset role;

-- only the four children of this test (other test data may exist)
create temp table rows as
  select e from jsonb_array_elements((select j from b) -> 'top') e;

select is((select e ->> 'displayName' from rows where e ->> 'firstName' = 'Rizky'), 'Rizky Ahmad',
  'child first word + father first word');
select is((select e ->> 'country' from rows where e ->> 'firstName' = 'Rizky'), 'ID', 'the family''s country');
select is((select e ->> 'displayName' from rows where e ->> 'firstName' = 'Adam'), 'Adam',
  'no parent name → the child''s first name only');
select is((select e ->> 'country' from rows where e ->> 'firstName' = 'Adam'), 'US', 'US flag');
select is((select e ->> 'displayName' from rows where (e ->> 'me')::boolean), 'عمر عبدالعزيز',
  'the own row: «عمر عبدالعزيز» — never the last name');
select is((select e ->> 'displayName' from rows where e ->> 'hero' = 'girl'), 'بطلة',
  'names turned off → «بطلة», no first or father name');
select is((select count(*)::int from rows where e ->> 'hero' = 'girl' and (e ? 'firstName') and e ->> 'firstName' is not null), 0,
  'a hidden child has no first name in the payload');
select ok((select j from b)::text !~ 'الفلاني|Pratama|bin محمد|بن محمد|@|a1000000-|a0000000-',
  'never a last name, email or id');
select is((select j from b) #>> '{me,ownFirstName}', 'عمر', 'the child''s own first name, as before');

select * from finish();
rollback;
