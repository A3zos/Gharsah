-- غَرْسة — the free pilot lasts 30 days (pgTAP). Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is((select period_days from public.plan_catalog where plan = 'trial'), 30, 'the pilot lasts 30 days');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('60000000-0000-0000-0000-00000000000a', 'pilot30@test.local', false, '{"name":"أم سارة"}');
select ok((select renews_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour'
           from public.subscriptions where parent_id = '60000000-0000-0000-0000-00000000000a'),
  'signing up starts a 30-day pilot');
select ok((select (select tgenabled from pg_trigger where tgname = 'subscriptions_guard') = 'O'),
  'the subscriptions guard is back on after the migration');

select * from finish();
rollback;
