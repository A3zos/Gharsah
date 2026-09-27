-- غَرْسة — Row Level Security (replaces app/firestore.rules + app/storage.rules).
-- Roles: a PARENT is a signed-in non-anonymous user; a CHILD DEVICE is an anonymous
-- user with a non-revoked child_sessions row (current_child_id()). A revoked or
-- unpaired device sees nothing. Server-only tables have RLS on and no policies.

-- No access without a session (anon role), except the public catalogues.
revoke all on all tables in schema public from anon;

alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.subscriptions enable row level security;
alter table public.plan_catalog enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.child_sessions enable row level security;
alter table public.claim_attempts enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;
alter table public.star_events enable row level security;
alter table public.lesson_days enable row level security;
alter table public.submissions enable row level security;
alter table public.leaderboard enable row level security;
alter table public.storage_cleanup_queue enable row level security;

-- Server-only: pairing_codes, claim_attempts, leaderboard (read through get_leaderboard()),
-- storage_cleanup_queue → no policies at all.
revoke all on public.pairing_codes, public.claim_attempts, public.leaderboard, public.storage_cleanup_queue
  from authenticated;

-- ── catalogues ───────────────────────────────────────────────────────────────

grant select on public.plan_catalog, public.lessons to anon;
create policy "plan catalogue is public" on public.plan_catalog for select to anon, authenticated using (true);
create policy "lessons are readable" on public.lessons for select to anon, authenticated using (true);

-- ── parents ──────────────────────────────────────────────────────────────────

create policy "parent reads own row" on public.parents for select to authenticated
  using (id = auth.uid() and not public.is_anonymous_user());
create policy "parent updates own row" on public.parents for update to authenticated
  using (id = auth.uid() and not public.is_anonymous_user())
  with check (id = auth.uid());
-- Inserts come from the auth trigger (handle_new_user); deletes from deleting the auth user.
revoke insert, delete on public.parents from authenticated;
-- Column privileges: only these columns are editable (a table-level grant would override column revokes).
revoke update on public.parents from authenticated;
grant update (name, locale) on public.parents to authenticated;

-- ── children ─────────────────────────────────────────────────────────────────

create policy "parent reads own children" on public.children for select to authenticated
  using (parent_id = auth.uid() and not public.is_anonymous_user());
create policy "parent adds a child" on public.children for insert to authenticated
  with check (parent_id = auth.uid() and not public.is_anonymous_user());
create policy "parent edits own children" on public.children for update to authenticated
  using (parent_id = auth.uid() and not public.is_anonymous_user())
  with check (parent_id = auth.uid());
create policy "parent removes own children" on public.children for delete to authenticated
  using (parent_id = auth.uid() and not public.is_anonymous_user());
create policy "paired device reads its child" on public.children for select to authenticated
  using (id = public.current_child_id());
revoke update on public.children from authenticated;
grant update (name, age, gender, avatar, schedule_days, schedule_time, schedule_custom,
  session_duration, reminder, review_days) on public.children to authenticated;

-- ── subscriptions (mock purchase path; Play Billing later = server-only) ─────

create policy "parent reads own subscription" on public.subscriptions for select to authenticated
  using (parent_id = auth.uid() and not public.is_anonymous_user());
create policy "parent starts a plan" on public.subscriptions for insert to authenticated
  with check (parent_id = auth.uid() and not public.is_anonymous_user());
create policy "parent changes own plan" on public.subscriptions for update to authenticated
  using (parent_id = auth.uid() and not public.is_anonymous_user())
  with check (parent_id = auth.uid());
revoke delete on public.subscriptions from authenticated;

-- ── child_sessions (written by claim-pairing-code / revoke-pairing-code) ─────

create policy "device reads own session" on public.child_sessions for select to authenticated
  using (device_uid = auth.uid());
create policy "parent sees own children's devices" on public.child_sessions for select to authenticated
  using (parent_id = auth.uid() and not public.is_anonymous_user());
revoke insert, update, delete on public.child_sessions from authenticated;

-- ── progress ─────────────────────────────────────────────────────────────────

create policy "parent reads progress" on public.progress for select to authenticated
  using (public.is_parent_of(child_id));
create policy "device reads own progress" on public.progress for select to authenticated
  using (child_id = public.current_child_id());
create policy "device starts a lesson" on public.progress for insert to authenticated
  with check (child_id = public.current_child_id());
create policy "device saves progress" on public.progress for update to authenticated
  using (child_id = public.current_child_id())
  with check (child_id = public.current_child_id());
create policy "parent resets progress" on public.progress for delete to authenticated
  using (public.is_parent_of(child_id));
-- stars / started_at / completed_at / updated_at are set by progress_guard() regardless.
revoke update on public.progress from authenticated;
grant update (stage, ayah_index, ayah_reps, full_reps, step_index, done_refs, project_assigned, reported_project)
  on public.progress to authenticated;

-- ── stars / lesson days (trigger-written) ────────────────────────────────────

create policy "parent reads stars" on public.star_events for select to authenticated
  using (public.is_parent_of(child_id));
create policy "device reads own stars" on public.star_events for select to authenticated
  using (child_id = public.current_child_id());
revoke insert, update, delete on public.star_events from authenticated;

create policy "parent reads lesson days" on public.lesson_days for select to authenticated
  using (public.is_parent_of(child_id));
create policy "device reads own lesson days" on public.lesson_days for select to authenticated
  using (child_id = public.current_child_id());
revoke insert, update, delete on public.lesson_days from authenticated;

-- ── submissions ──────────────────────────────────────────────────────────────

-- The recording must already be in this child's storage folder (replaces onSubmissionCreated's check).
create or replace function public.own_recording_exists(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select path = public.current_child_parent_id()::text || '/' || public.current_child_id()::text || '/' || split_part(path, '/', 3)
     and exists (select 1 from storage.objects o where o.bucket_id = 'recordings' and o.name = path)
$$;

create policy "device files a report" on public.submissions for insert to authenticated
  with check (child_id = public.current_child_id() and public.own_recording_exists(storage_path));
create policy "parent reads reports" on public.submissions for select to authenticated
  using (public.is_parent_of(child_id));
create policy "parent deletes reports" on public.submissions for delete to authenticated
  using (public.is_parent_of(child_id));
revoke update on public.submissions from authenticated;

-- ── storage: private bucket `recordings` at {parent_id}/{child_id}/{file} ────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 2097152,
        array['audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "recordings: paired device uploads under its own child"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and public.current_child_id() is not null
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = public.current_child_parent_id()::text
    and (storage.foldername(name))[2] = public.current_child_id()::text
  );

-- Parents read (signed URLs) and delete their own children's recordings.
create policy "recordings: parent reads own"
  on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and not public.is_anonymous_user()
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recordings: parent deletes own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and not public.is_anonymous_user()
         and (storage.foldername(name))[1] = auth.uid()::text);
