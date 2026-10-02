-- The free pilot (plan 'trial') lasts 30 days instead of 7, so a child has time to
-- finish the three lesson days (one per calendar day, and only after the previous
-- one) even with gaps. New pilots get 30 days from subscriptions_guard (period_days).
update public.plan_catalog set period_days = 30 where plan = 'trial';

-- Pilots already running: 30 days from when they started (never shorter than now).
-- subscriptions_guard is bypassed for this one update: on UPDATE it would extend
-- from the current end date (7 + 30), not set start + 30.
alter table public.subscriptions disable trigger subscriptions_guard;
update public.subscriptions
  set renews_at = greatest(renews_at, started_at + interval '30 days')
  where plan = 'trial' and status = 'active';
alter table public.subscriptions enable trigger subscriptions_guard;
