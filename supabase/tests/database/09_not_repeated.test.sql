-- غَرْسة — an ayah the child stayed silent on is recorded «لم يُردَّد» for the parent (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('90000000-0000-0000-0000-00000000000a', 'silent@test.local', false, '{"name":"أم سارة"}'),
  ('90000000-0000-0000-0000-0000000000d1', null, true, '{}');
create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('91000000-0000-0000-0000-0000000000a1', '90000000-0000-0000-0000-00000000000a', 'سارة', 9, 'girl', 'g1', '{0,1}', 900, '{1}');
insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('90000000-0000-0000-0000-0000000000d1', '90000000-0000-0000-0000-00000000000a', '91000000-0000-0000-0000-0000000000a1');

select pg_temp.act_as('90000000-0000-0000-0000-0000000000d1', true);
select lives_ok($$insert into public.progress (child_id, lesson_id) values ('91000000-0000-0000-0000-0000000000a1', 'pilot-day-1')$$,
  'the device starts the day');
select is((select not_repeated_refs from public.progress where child_id = '91000000-0000-0000-0000-0000000000a1'), '{}'::text[],
  'nothing is «لم يُردَّد» by default');
select lives_ok($$update public.progress set not_repeated_refs = '{112:1}' where child_id = '91000000-0000-0000-0000-0000000000a1'$$,
  'the device marks ayah 112:1 «لم يُردَّد»');
select lives_ok($$insert into public.progress (child_id, lesson_id, not_repeated_refs) values ('91000000-0000-0000-0000-0000000000a1', 'pilot-day-2', '{114:2}')$$,
  'a new day can start with one');
select pg_temp.act_as('90000000-0000-0000-0000-00000000000a', false);
select is((select not_repeated_refs from public.progress where child_id = '91000000-0000-0000-0000-0000000000a1' and lesson_id = 'pilot-day-1'), '{112:1}'::text[],
  'the parent sees it');

select * from finish();
rollback;
