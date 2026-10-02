-- غَرْسة — AI teacher consent + the AI lesson catalogue rows (pgTAP). Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('40000000-0000-0000-0000-00000000000a', 'ai-a@test.local', false, '{"name":"أبو خالد"}'),
  ('40000000-0000-0000-0000-00000000000b', 'ai-b@test.local', false, '{"name":"أم سعد"}'),
  ('40000000-0000-0000-0000-0000000000d1', null, true, '{}');

create or replace function pg_temp.act_as(uid uuid, anon boolean) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into public.subscriptions (parent_id, plan) values ('40000000-0000-0000-0000-00000000000a', 'annual')
  on conflict (parent_id) do update set plan = excluded.plan; -- sign-up already started the free pilot
insert into public.children (id, parent_id, name, age, gender, avatar, schedule_days, schedule_time, review_days) values
  ('41000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-00000000000a', 'خالد', 10, 'boy', 'b1', '{0,1,2}', 1020, '{2}');
insert into public.child_sessions (device_uid, parent_id, child_id) values
  ('40000000-0000-0000-0000-0000000000d1', '40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1');

-- ── consent: off by default, parent only, stamped by the database ────────────
select is((select ai_voice_consent from public.children where id = '41000000-0000-0000-0000-0000000000a1'), false,
  'consent is off by default');

select pg_temp.act_as('40000000-0000-0000-0000-00000000000a', false);
select lives_ok($$update public.children set ai_voice_consent = true where id = '41000000-0000-0000-0000-0000000000a1'$$,
  'the parent turns consent on');
select ok((select ai_voice_consent and ai_voice_consent_at is not null from public.children
  where id = '41000000-0000-0000-0000-0000000000a1'), 'consent on is stamped with a time');
select throws_ok($$update public.children set ai_voice_consent_at = now() - interval '1 year'
  where id = '41000000-0000-0000-0000-0000000000a1'$$, '42501', 'the consent time cannot be written by clients');
update public.children set name = 'خالد علي' where id = '41000000-0000-0000-0000-0000000000a1';
select ok((select ai_voice_consent_at is not null from public.children where id = '41000000-0000-0000-0000-0000000000a1'),
  'other edits keep the consent time');
update public.children set ai_voice_consent = false where id = '41000000-0000-0000-0000-0000000000a1';
select ok((select not ai_voice_consent and ai_voice_consent_at is null from public.children
  where id = '41000000-0000-0000-0000-0000000000a1'), 'consent off clears the time');
update public.children set ai_voice_consent = true where id = '41000000-0000-0000-0000-0000000000a1';

select pg_temp.act_as('40000000-0000-0000-0000-00000000000b', false);
update public.children set ai_voice_consent = false where id = '41000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as('40000000-0000-0000-0000-0000000000d1', true);
select is((select ai_voice_consent from public.children where id = '41000000-0000-0000-0000-0000000000a1'), true,
  'another parent cannot change it; the paired device reads it');
update public.children set ai_voice_consent = false where id = '41000000-0000-0000-0000-0000000000a1';
reset role;
select is((select ai_voice_consent from public.children where id = '41000000-0000-0000-0000-0000000000a1'), true,
  'the child device cannot change consent');

-- ── the AI lessons write progress like any lesson ────────────────────────────
select ok(exists(select 1 from public.lessons where lesson_id = 'surah-112' and kind = 'surah' and ref = '112'),
  'surah-112 is in the catalogue');
select ok(exists(select 1 from public.lessons where lesson_id = 'surah-1' and kind = 'surah' and ref = '1'),
  'surah-1 (the Fatiha intro) is in the catalogue');

select pg_temp.act_as('40000000-0000-0000-0000-0000000000d1', true);
select lives_ok($$insert into public.progress (child_id, lesson_id, stage, done_refs)
  values ('41000000-0000-0000-0000-0000000000a1', 'surah-112', 'ayah_repeat', '{112:1,112:2}')$$,
  'the device saves AI-lesson progress');
select lives_ok($$update public.progress set stage = 'done', done_refs = '{112:1,112:2,112:3,112:4}'
  where child_id = '41000000-0000-0000-0000-0000000000a1' and lesson_id = 'surah-112'$$, 'and finishes it');
select is((select stars from public.progress where lesson_id = 'surah-112'
  and child_id = '41000000-0000-0000-0000-0000000000a1'), 4, 'every stage left behind earns its star');
select lives_ok($$insert into public.progress (child_id, lesson_id, stage)
  values ('41000000-0000-0000-0000-0000000000a1', 'hadith-al-ghadab', 'hadith')$$, 'hadith lessons too');
select is((public.child_stats('41000000-0000-0000-0000-0000000000a1') ->> 'surahs')::int, 1,
  'the dashboard counts the AI surah');

select * from finish();
rollback;
