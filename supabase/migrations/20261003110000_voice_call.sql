-- The lesson is a pure voice call. Without the parent's voice consent nothing leaves
-- the device, so a quiz answer can't be known (the first option is sent to the AI
-- teacher) — the parent sees that quiz as «لم يُقيَّم». Set by the child's device.
alter table public.progress add column quiz_unscored boolean not null default false;
grant update (quiz_unscored) on public.progress to authenticated;
