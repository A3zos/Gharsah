-- غَرْسة — child avatar keys: legacy ids map to the new pictures, always the child's gender (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(public.child_avatar_key('g3', 'girl'), 'girl-3', 'g3 (green hijab) → girl-3');
select is(public.child_avatar_key('g5', 'girl'), 'girl-1', 'the retired 5th colour → girl-1');
select is(public.child_avatar_key('b3', 'boy'), 'boy-2', 'b3 → boy-2');
select is(public.child_avatar_key('girl-2', 'boy'), 'boy-1', 'a key of the other gender → the default');
select is(public.child_avatar_key('nonsense', 'girl'), 'girl-1', 'unknown → girl-1');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('80000000-0000-0000-0000-00000000000a', 'avatars@test.local', false, '{"name":"أم سارة"}');
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('81000000-0000-0000-0000-0000000000a1', '80000000-0000-0000-0000-00000000000a', 'سارة', 9, 'girl', 'g4', '{0,1}', 900, '{1}');
select is((select avatar from public.children where id = '81000000-0000-0000-0000-0000000000a1'), 'girl-4',
  'an older build''s legacy id is stored as the new key');
update public.children set avatar = 'girl-3' where id = '81000000-0000-0000-0000-0000000000a1';
select is((select avatar from public.children where id = '81000000-0000-0000-0000-0000000000a1'), 'girl-3',
  'a new key is kept');
update public.children set gender = 'boy' where id = '81000000-0000-0000-0000-0000000000a1';
select is((select avatar from public.children where id = '81000000-0000-0000-0000-0000000000a1'), 'boy-1',
  'changing the gender keeps the avatar of that gender');

select * from finish();
rollback;
