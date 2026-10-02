-- غَرْسة — the pilot plan: catalogue rows + one day at a time (pgTAP). Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('50000000-0000-0000-0000-00000000000a', 'pilot-a@test.local', false, '{"name":"أبو سعد"}'),
  ('50000000-0000-0000-0000-00000000000b', 'pilot-b@test.local', false, '{"name":"أم ريم"}'),
  ('50000000-0000-0000-0000-0000000000d1', null, true, '{}');

create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into public.subscriptions (parent_id, plan) values ('50000000-0000-0000-0000-00000000000a', 'trial')
  on conflict (parent_id) do update set plan = excluded.plan; -- sign-up already started the free pilot
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('51000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-00000000000a', 'سعد', 9, 'boy', 'b1', '{0,1,2}', 1020, '{2}');
insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('50000000-0000-0000-0000-0000000000d1', '50000000-0000-0000-0000-00000000000a', '51000000-0000-0000-0000-0000000000a1');

select is((select plan || '/' || status from public.subscriptions where parent_id = '50000000-0000-0000-0000-00000000000b'),
  'trial/active', 'signing up starts the free pilot (no payment step)');
select is((select count(*)::int from public.subscriptions where parent_id = '50000000-0000-0000-0000-0000000000d1'), 0,
  'a child device (anonymous) gets no subscription');

select is((select string_agg(lesson_id || '=' || ref || '/' || hadith_id, ' ' order by sort_order)
           from public.lessons where lesson_id like 'pilot-day-%'),
  'pilot-day-1=112/PLACEHOLDER-birr-alwalidayn pilot-day-2=114/PLACEHOLDER-al-kadhib pilot-day-3=113/PLACEHOLDER-al-ghadab',
  'the pilot plan: الإخلاص+برّ، الناس+الكذب، الفلق+الغضب');

select pg_temp.act_as('50000000-0000-0000-0000-0000000000d1', true);
select throws_ok($$insert into public.progress (child_id, lesson_id) values ('51000000-0000-0000-0000-0000000000a1', 'pilot-day-2')$$,
  'P0001', 'pilot-day-locked', 'day 2 cannot start before day 1');
select lives_ok($$insert into public.progress (child_id, lesson_id) values ('51000000-0000-0000-0000-0000000000a1', 'pilot-day-1')$$,
  'day 1 is open');
select throws_ok($$insert into public.progress (child_id, lesson_id) values ('51000000-0000-0000-0000-0000000000a1', 'pilot-day-2')$$,
  'P0001', 'pilot-day-locked', 'day 2 stays locked while day 1 is unfinished');
select lives_ok($$update public.progress set stage = 'done'
  where child_id = '51000000-0000-0000-0000-0000000000a1' and lesson_id = 'pilot-day-1'$$, 'day 1 finished');
select is((select stars from public.progress where lesson_id = 'pilot-day-1'
  and child_id = '51000000-0000-0000-0000-0000000000a1'), 4, 'a finished day earns all four stars');
select throws_ok($$insert into public.progress (child_id, lesson_id) values ('51000000-0000-0000-0000-0000000000a1', 'pilot-day-2')$$,
  'P0001', 'pilot-day-locked', 'day 2 does not open on the same Riyadh day');

-- the next Riyadh day (move day 1's completion back without the guards)
reset role;
set local session_replication_role = replica;
update public.progress set completed_at = now() - interval '1 day'
  where child_id = '51000000-0000-0000-0000-0000000000a1' and lesson_id = 'pilot-day-1';
set local session_replication_role = origin;
select pg_temp.act_as('50000000-0000-0000-0000-0000000000d1', true);
select lives_ok($$insert into public.progress (child_id, lesson_id) values ('51000000-0000-0000-0000-0000000000a1', 'pilot-day-2')$$,
  'day 2 opens the next day');
select throws_ok($$insert into public.progress (child_id, lesson_id) values ('51000000-0000-0000-0000-0000000000a1', 'pilot-day-3')$$,
  'P0001', 'pilot-day-locked', 'day 3 waits for day 2');
select is((public.child_stats('51000000-0000-0000-0000-0000000000a1') ->> 'surahs')::int, 1,
  'the dashboard counts the finished pilot surah');

-- the pilot package: up to 3 children per family
select is((select max_children from public.plan_catalog where plan = 'trial'), 3, 'the pilot covers 3 children');
select pg_temp.act_as('50000000-0000-0000-0000-00000000000a', false);
select lives_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('50000000-0000-0000-0000-00000000000a', 'نورة', 8, 'girl', 'g1', '{0}', 900, '{0}')$$,
  'a 2nd child on the pilot');
select lives_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('50000000-0000-0000-0000-00000000000a', 'فهد', 12, 'boy', 'b2', '{1}', 900, '{1}')$$,
  'a 3rd child on the pilot');
select throws_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('50000000-0000-0000-0000-00000000000a', 'ريم', 9, 'girl', 'g2', '{2}', 900, '{2}')$$,
  'P0001', 'plan-child-limit', 'a 4th child is refused');

select * from finish();
rollback;
