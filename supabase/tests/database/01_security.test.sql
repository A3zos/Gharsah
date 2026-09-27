-- غَرْسة — RLS / constraints / pairing (pgTAP). Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- ── fixtures (as postgres) ───────────────────────────────────────────────────
-- Parents A, B; A's children A1, A2; B's child B1; anonymous devices dA1 → A1, dA2 → A2.
insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', false, '{"name":"أبو أحمد"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', false, '{"name":"أم بدر"}'),
  ('00000000-0000-0000-0000-0000000000d1', null, true, '{}'),
  ('00000000-0000-0000-0000-0000000000d2', null, true, '{}'),
  ('00000000-0000-0000-0000-0000000000d3', null, true, '{}');

create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into public.subscriptions (parent_id, plan) values
  ('00000000-0000-0000-0000-00000000000a', 'annual'),
  ('00000000-0000-0000-0000-00000000000b', 'monthly');
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'أحمد علي', 10, 'boy', 'b1', '{0,1,2,4,5}', 1020, '{5}'),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'سارة علي', 9, 'girl', 'g1', '{0,1,2}', 1020, '{2}'),
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'بدر', 11, 'boy', 'b2', '{0,3}', 960, '{3}');
insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a2');
insert into public.progress (child_id, lesson_id) values ('10000000-0000-0000-0000-0000000000a2', 'm01-w03-ikhlas');

select is((select count(*)::int from public.parents where id in
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 2,
  'sign-up trigger creates a parents row (not for anonymous devices)');
select is((select count(*)::int from public.parents), 2, 'anonymous devices get no parents row');

-- ── monthly plan = one child; annual = unlimited ─────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', false);
select throws_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('00000000-0000-0000-0000-00000000000b', 'نور', 8, 'girl', 'g2', '{0}', 900, '{0}')$$,
  'P0001', 'monthly plan blocks a 2nd child');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', false);
select lives_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('00000000-0000-0000-0000-00000000000a', 'يوسف', 12, 'boy', 'b3', '{0,1}', 900, '{1}')$$,
  'annual plan allows a 3rd child');

-- ── review days: 1–3, each a lesson day ──────────────────────────────────────
select throws_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('00000000-0000-0000-0000-00000000000a', 'x', 10, 'boy', 'b1', '{0,1,2,3,4}', 900, '{0,1,2,3}')$$,
  '23514', 'more than 3 review days rejected');
select throws_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('00000000-0000-0000-0000-00000000000a', 'x', 10, 'boy', 'b1', '{0,1}', 900, '{5}')$$,
  '23514', 'a review day that is not a lesson day is rejected');
select throws_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('00000000-0000-0000-0000-00000000000a', 'x', 10, 'boy', 'b1', '{0,1}', 900, '{}')$$,
  '23514', 'at least one review day');
select throws_ok($$update public.children set review_days = '{0,1,2,4}' where id = '10000000-0000-0000-0000-0000000000a1'$$,
  '23514', 'update to 4 review days rejected');
select lives_ok($$update public.children set review_days = '{0,2,5}' where id = '10000000-0000-0000-0000-0000000000a1'$$,
  '3 review days accepted');

-- ── cross-parent isolation ───────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', false);
select is((select count(*)::int from public.children), 1, 'parent B sees only own child');
select is((select count(*)::int from public.children where parent_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'parent B cannot see parent A''s children');
select is((select count(*)::int from public.progress), 0, 'parent B cannot see A''s progress');
select is((select count(*)::int from public.subscriptions), 1, 'parent B sees only own subscription');
update public.children set name = 'hacked' where id = '10000000-0000-0000-0000-0000000000a1';
delete from public.children where id = '10000000-0000-0000-0000-0000000000a2';
reset role;
select is((select name from public.children where id = '10000000-0000-0000-0000-0000000000a1'), 'أحمد علي',
  'parent B cannot rename A''s child');
select is((select count(*)::int from public.children where id = '10000000-0000-0000-0000-0000000000a2'), 1,
  'parent B cannot delete A''s child');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', false);
select throws_ok($$insert into public.children (parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days)
  values ('00000000-0000-0000-0000-00000000000a', 'x', 10, 'boy', 'b1', '{0}', 900, '{0}')$$,
  '42501', 'parent B cannot add a child under parent A');
select throws_ok($$select public.child_stats('10000000-0000-0000-0000-0000000000a1')$$,
  '42501', 'parent B cannot read A''s child stats');
select is(public.child_pairing('10000000-0000-0000-0000-0000000000a1'), null, 'parent B cannot see A''s pairing code');

-- ── cross-child isolation (two devices of the same parent) ──────────────────
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', true);
select is((select count(*)::int from public.children), 1, 'device A1 sees only its own child');
select is((select id from public.children), '10000000-0000-0000-0000-0000000000a1'::uuid, '… and it is A1');
select is((select count(*)::int from public.progress), 0, 'device A1 cannot read A2''s progress');
select throws_ok($$insert into public.progress (child_id, lesson_id) values ('10000000-0000-0000-0000-0000000000a2', 'surah-113')$$,
  '42501', 'device A1 cannot write A2''s progress');
select lives_ok($$insert into public.progress (child_id, lesson_id) values ('10000000-0000-0000-0000-0000000000a1', 'm01-w03-ikhlas')$$,
  'device A1 writes its own progress');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('recordings',
  '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-0000000000a2/x.wav')$$,
  '42501', 'device A1 cannot upload into A2''s folder');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('recordings',
  '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-0000000000a1/r1.wav')$$,
  'device A1 uploads into its own folder');
select lives_ok($$insert into public.submissions (child_id, lesson_id, stage, project_id, storage_path, duration_ms)
  values ('10000000-0000-0000-0000-0000000000a1', 'm01-w03-ikhlas', 'project', 'birr-3-acts',
          '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-0000000000a1/r1.wav', 12000)$$,
  'device A1 files a report pointing at its uploaded recording');
select throws_ok($$insert into public.submissions (child_id, lesson_id, storage_path, duration_ms)
  values ('10000000-0000-0000-0000-0000000000a1', 'm01-w03-ikhlas',
          '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-0000000000a1/missing.wav', 5000)$$,
  '42501', 'a report must point at an existing own recording');
select throws_ok($$select count(*) from public.pairing_codes$$, '42501', 'pairing codes are never visible to clients');

-- ── stages, stars ────────────────────────────────────────────────────────────
select throws_ok($$update public.progress set stars = 4 where child_id = '10000000-0000-0000-0000-0000000000a1'$$,
  '42501', 'a device cannot write stars');
update public.progress set stage = 'full_twice' where child_id = '10000000-0000-0000-0000-0000000000a1';
select is((select stars from public.progress where child_id = '10000000-0000-0000-0000-0000000000a1'), 2,
  'stars are server-owned: one per completed stage');
select throws_ok($$update public.progress set stage = 'listen_full' where child_id = '10000000-0000-0000-0000-0000000000a1'$$,
  'P0001', 'stages never move backwards');
update public.progress set stage = 'done' where child_id = '10000000-0000-0000-0000-0000000000a1';
select ok((select completed_at is not null from public.progress where child_id = '10000000-0000-0000-0000-0000000000a1'),
  'done sets completed_at');
select is((public.child_stats('10000000-0000-0000-0000-0000000000a1') ->> 'surahs')::int, 1,
  'the device reads its own stats (1 surah completed)');

-- ── revoked session ──────────────────────────────────────────────────────────
reset role;
update public.child_sessions set revoked = true where device_uid = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1', true);
select is((select count(*)::int from public.children), 0, 'revoked device sees no child');
select is((select count(*)::int from public.progress), 0, 'revoked device sees no progress');
select throws_ok($$insert into public.progress (child_id, lesson_id) values ('10000000-0000-0000-0000-0000000000a1', 'surah-113')$$,
  '42501', 'revoked device cannot write progress');

-- ── pairing (server functions; single use, 10 minutes, demo only in DEMO_MODE) ─
reset role;
select ok((public.issue_pairing_code('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a2', false) ->> 'code') ~ '^[0-9]{6}$',
  'a parent with a plan gets a 6-digit code');
select is((public.claim_pairing_code('00000000-0000-0000-0000-0000000000d3',
  (select code from public.pairing_codes where child_id = '10000000-0000-0000-0000-0000000000a2' and not revoked), false) ->> 'childId')::uuid,
  '10000000-0000-0000-0000-0000000000a2'::uuid, 'a device claims the code');
select throws_ok(format($$select public.claim_pairing_code('00000000-0000-0000-0000-0000000000d1', %L, false)$$,
  (select code from public.pairing_codes where child_id = '10000000-0000-0000-0000-0000000000a2' and claimed_at is not null)),
  'P0002', 'a code is single-use');
select is((select revoked from public.child_sessions where device_uid = '00000000-0000-0000-0000-0000000000d2'), true,
  'claiming unpairs the child''s previous device');

select * from finish();
rollback;
