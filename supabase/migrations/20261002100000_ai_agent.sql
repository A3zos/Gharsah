-- The web lesson on the AI teacher server (VITE_AI_AGENT=1).
-- 1. The parent's consent for the AI server to receive the child's voice (it stores
--    recitation audio — ai/API_web.md §6). Off by default; only the parent can change
--    it; the database stamps when it was given (null while off).
-- 2. Catalogue rows for the surahs the AI server teaches that had none yet (the pilot
--    is 112, 114, 113 + the Fatiha intro), so the lesson's progress rows — and with
--    them stars, streak, the dashboard and the leaderboard — have a lesson to point at.

alter table public.children
  add column ai_voice_consent boolean not null default false,
  add column ai_voice_consent_at timestamptz;

create or replace function public.ai_voice_consent_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.ai_voice_consent is distinct from old.ai_voice_consent then
    new.ai_voice_consent_at := case when new.ai_voice_consent then now() else null end;
  else
    new.ai_voice_consent_at := old.ai_voice_consent_at;
  end if;
  return new;
end $$;

create trigger ai_voice_consent_stamp
  before insert or update on public.children
  for each row execute function public.ai_voice_consent_stamp();

-- Parents edit it through the existing "parent edits own children" policy; paired
-- devices have no update policy on children, so they can only read it.
grant update (ai_voice_consent) on public.children to authenticated;

insert into public.lessons (lesson_id, kind, ref, title, hadith_id, project_id, available, sort_order) values
  ('surah-1', 'surah', '1', 'سورة الفاتحة', null, null, false, 90),
  ('surah-112', 'surah', '112', 'سورة الإخلاص', null, null, false, 100)
on conflict (lesson_id) do nothing;
