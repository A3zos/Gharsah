-- غَرْسة — admin statistics security (pgTAP). Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('20000000-0000-0000-0000-00000000000a', 'admin@test.local', false, '{"name":"مشرف"}'),
  ('20000000-0000-0000-0000-00000000000b', 'parent@test.local', false, '{"name":"ولي أمر"}'),
  ('20000000-0000-0000-0000-0000000000d1', null, true, '{}');
insert into public.admins (user_id) values ('20000000-0000-0000-0000-00000000000a');
insert into public.subscriptions (parent_id, plan) values ('20000000-0000-0000-0000-00000000000b', 'annual')
  on conflict (parent_id) do update set plan = excluded.plan; -- sign-up already started the free pilot
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('21000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-00000000000b', 'سعد', 9, 'boy', 'b1', '{0,1}', 1020, '{1}');
insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('20000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-00000000000b', '21000000-0000-0000-0000-0000000000c1');
insert into public.progress (child_id, lesson_id, stage, done_refs) values
  ('21000000-0000-0000-0000-0000000000c1', 'm01-w03-ikhlas', 'listen_full', '{112:1,112:2}');
update public.progress set stage = 'done' where child_id = '21000000-0000-0000-0000-0000000000c1';

create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- a parent who is not an admin
select pg_temp.act_as('20000000-0000-0000-0000-00000000000b', false);
select is(public.is_admin(), false, 'a parent is not an admin');
select throws_ok($$select public.admin_stats()$$, '42501', 'a non-admin parent gets forbidden');
select throws_ok($$select count(*) from public.admins$$, '42501', 'a parent cannot read admins');
select throws_ok($$insert into public.admins (user_id) values ('20000000-0000-0000-0000-00000000000b')$$,
  '42501', 'a parent cannot make themselves admin');

-- the anonymous child device
select pg_temp.act_as('20000000-0000-0000-0000-0000000000d1', true);
select throws_ok($$select public.admin_stats()$$, '42501', 'an anonymous child device gets forbidden');

-- the admin
select pg_temp.act_as('20000000-0000-0000-0000-00000000000a', false);
select is(public.is_admin(), true, 'the admin is an admin');
select throws_ok($$select count(*) from public.admins$$, '42501', 'even an admin cannot read admins from the client');
select is((public.admin_stats() -> 'parents' ->> 'total')::int, 2, 'the admin gets numbers: parents');
select is((public.admin_stats() -> 'lessons' ->> 'completed')::int, 1, 'lessons completed');
select is(jsonb_array_length(public.admin_stats() -> 'daily'), 30, 'a 30-day daily series');
select ok(public.admin_stats()::text !~ '(test\.local|سعد|مشرف|ولي أمر)', 'aggregates only: no names or emails');

select * from finish();
rollback;
