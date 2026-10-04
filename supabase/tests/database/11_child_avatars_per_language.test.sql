-- غَرْسة — child avatars per language: the en / id sets are kept (own gender only) (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is(public.child_avatar_key('en-boy-2', 'boy'), 'en-boy-2', 'an English boy avatar is kept');
select is(public.child_avatar_key('id-girl-4', 'girl'), 'id-girl-4', 'an Indonesian girl avatar is kept');
select is(public.child_avatar_key('en-girl-1', 'boy'), 'boy-1', 'a set avatar of the other gender → the default');
select is(public.child_avatar_key('fr-boy-1', 'boy'), 'boy-1', 'an unknown set → the default');
select is(public.child_avatar_key('en-boy-5', 'boy'), 'boy-1', 'only 1–4 per set');
select is(public.child_avatar_key('girl-3', 'girl'), 'girl-3', 'the Arabic set is unchanged');
select is(public.child_avatar_key('g3', 'girl'), 'girl-3', 'legacy ids still map');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('80000000-0000-0000-0000-00000000000b', 'avatars-lang@test.local', false, '{"name":"Ummu Aisyah"}');
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('81000000-0000-0000-0000-0000000000b1', '80000000-0000-0000-0000-00000000000b', 'Aisyah', 9, 'girl', 'id-girl-2', '{0,1}', 900, '{1}');
select is((select avatar from public.children where id = '81000000-0000-0000-0000-0000000000b1'), 'id-girl-2',
  'a child saved with an Indonesian avatar keeps it');
update public.children set avatar = 'en-girl-3' where id = '81000000-0000-0000-0000-0000000000b1';
select is((select avatar from public.children where id = '81000000-0000-0000-0000-0000000000b1'), 'en-girl-3',
  'switching to an English avatar is stored');

select * from finish();
rollback;
