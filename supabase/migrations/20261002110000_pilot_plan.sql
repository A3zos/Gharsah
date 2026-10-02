-- The PILOT PLAN (product-owner decision 2026-10-02): three days, one lesson a day,
-- each day one surah + one hadith, in order, no choosing:
--   day 1 الإخلاص + برّ الوالدين · day 2 الناس + الكذب · day 3 الفلق + الغضب
-- (content/lessons/pilot-day-*.json). Both the built-in lesson and the AI-server
-- lesson write the day's progress row, so stars, streak, the dashboard and the
-- leaderboard follow the plan.

insert into public.lessons (lesson_id, kind, ref, title, hadith_id, project_id, available, sort_order) values
  ('pilot-day-1', 'surah', '112', 'سورة الإخلاص + حديث برّ الوالدين', 'PLACEHOLDER-birr-alwalidayn', null, true, 1),
  ('pilot-day-2', 'surah', '114', 'سورة الناس + حديث عن الكذب', 'PLACEHOLDER-al-kadhib', null, true, 2),
  ('pilot-day-3', 'surah', '113', 'سورة الفلق + حديث عن الغضب', 'PLACEHOLDER-al-ghadab', null, true, 3)
on conflict (lesson_id) do update set
  kind = excluded.kind,
  ref = excluded.ref,
  title = excluded.title,
  hadith_id = excluded.hadith_id,
  project_id = excluded.project_id,
  available = excluded.available,
  sort_order = excluded.sort_order;

-- Day N can be started only once day N-1 is completed, on an earlier Riyadh day.
-- (The app shows the same rule; this keeps it true for any client.)
create or replace function public.pilot_day_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  n int;
  prev_done timestamptz;
begin
  if new.lesson_id !~ '^pilot-day-[0-9]+$' then
    return new;
  end if;
  n := substring(new.lesson_id from '^pilot-day-([0-9]+)$')::int;
  if n <= 1 then
    return new;
  end if;
  select p.completed_at into prev_done
  from public.progress p
  where p.child_id = new.child_id and p.lesson_id = 'pilot-day-' || (n - 1);
  if prev_done is null or (prev_done at time zone 'Asia/Riyadh')::date >= public.riyadh_today() then
    raise exception 'pilot-day-locked' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger pilot_day_guard
  before insert on public.progress
  for each row execute function public.pilot_day_guard();
