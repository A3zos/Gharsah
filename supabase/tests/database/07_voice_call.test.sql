-- غَرْسة — an unscored quiz (voice call without consent) is recorded for the parent (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('70000000-0000-0000-0000-00000000000a', 'voice@test.local', false, '{"name":"أبو يوسف"}'),
  ('70000000-0000-0000-0000-0000000000d1', null, true, '{}');
create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('71000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-00000000000a', 'يوسف', 9, 'boy', 'b1', '{0,1}', 900, '{1}');
insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('70000000-0000-0000-0000-0000000000d1', '70000000-0000-0000-0000-00000000000a', '71000000-0000-0000-0000-0000000000a1');

select pg_temp.act_as('70000000-0000-0000-0000-0000000000d1', true);
select lives_ok($$insert into public.progress (child_id, lesson_id) values ('71000000-0000-0000-0000-0000000000a1', 'pilot-day-1')$$,
  'the device starts the day');
select is((select quiz_unscored from public.progress where child_id = '71000000-0000-0000-0000-0000000000a1'), false,
  'a quiz is scored by default');
select lives_ok($$update public.progress set quiz_unscored = true where child_id = '71000000-0000-0000-0000-0000000000a1'$$,
  'the device marks the quiz «لم يُقيَّم»');
select pg_temp.act_as('70000000-0000-0000-0000-00000000000a', false);
select is((select quiz_unscored from public.progress where child_id = '71000000-0000-0000-0000-0000000000a1'), true,
  'the parent sees it');

select * from finish();
rollback;
