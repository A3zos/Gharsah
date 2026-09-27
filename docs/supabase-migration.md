# Firebase → Supabase migration map

Firebase billing was declined (Spark plan: no Cloud Functions deploy). Target: **Supabase free tier**,
project `qtxxhfgqfyuiqflxtcol` (`https://qtxxhfgqfyuiqflxtcol.supabase.co`). Clients use the **anon key
only**; the service_role key never appears in client code or in git.

Status legend: ⬜ todo · 🟨 in progress · ✅ done

## 1. Platform pieces

| Firebase piece | Where today | Supabase replacement |
|---|---|---|
| Firebase Auth — parent email/password | `web/src/data/auth.ts`, `app/lib/features/auth/data/auth_repository.dart` | Supabase Auth email/password (`auth.signUp`, `signInWithPassword`, `resetPasswordForEmail`) |
| Firebase Auth — anonymous child device | `web/src/data/childSession.ts`, `app/.../student/data/child_session.dart` | Supabase **anonymous sign-ins** (`auth.signInAnonymously`) — must be enabled in Auth settings (local: `config.toml`) |
| Firestore `parents/{uid}` | `data/parent.ts`, `auth_repository.dart` | table `parents` (id = `auth.users.id`) |
| Firestore `parents/{uid}/subscription/current` (mock Play) | `data/parent.ts`, `subscription_repository.dart` | table `subscriptions` (PK `parent_id`, provider default `'mock'`) |
| Firestore `…/children/{childId}` (+ server fields `pairing`, `linkedDeviceUid`, `stats`, `leader`) | `data/children.ts`, `children_repository.dart`, `child_profile.dart` | table `children` (client-writable columns only) + **view/function `child_stats`** computed from `progress`/`submissions` + `pairing_codes` / `child_sessions` tables |
| Firestore `…/progress/{lessonId}` (LessonAgent checkpoints) | `data/student.ts`, `lesson/web/progressSink.ts`, `student_repository.dart` | table `progress` PK (`child_id`, `lesson_id`) with `stage`, `ayah_index`, `ayah_reps`, `full_reps`, `stars` |
| Firestore `…/submissions/{id}` | `data/submissions.ts`, `submissions_repository.dart` | table `submissions` |
| Firestore `pairingCodes/{code}` (Functions only) | `functions/src/pairing.ts` | table `pairing_codes` — **no client access** (RLS on, no policies); only Edge Functions (service role, server-side) touch it |
| Firestore `childSessions/{deviceUid}` | `functions/src/claim.ts`, `firebase/session.ts` | table `child_sessions` (`device_uid` = anonymous `auth.uid()`, `revoked`) |
| Firestore `rateLimits/{deviceUid}` | `claim.ts` | table `claim_attempts` (service-only) |
| Firestore `leaderboard/current` | `leaderboard.ts`, `data/student.ts` | table `leaderboard` refreshed by **pg_cron** |
| Storage `recordings/{parent}/{child}/{id}.(m4a|wav)` | `storage.rules`, `progressSink.ts`, `upload_io.dart`, `submissions.ts` | private bucket **`recordings`**, path `{parent_id}/{child_id}/{file}`; storage RLS on `storage.objects`; parent playback via **signed URLs** |
| `firestore.rules` (222 lines) | `app/firestore.rules` | **RLS policies** on every table + CHECK constraints + triggers (e.g. monthly = 1 child, ≤ 3 review days ⊆ lesson days) |
| `storage.rules` | `app/storage.rules` | policies on `storage.objects` for bucket `recordings` |
| Rules tests (`tool/rules_test/*.mjs`) | emulator | **pgTAP** tests in `supabase/tests/` (`supabase test db`) |
| Callable `createPairingCode` / `revokePairingCode` / `claimPairingCode` | `functions/src/index.ts`, `pairing.ts`, `claim.ts` | **Edge Functions** `create-pairing-code`, `revoke-pairing-code`, `claim-pairing-code` (Deno) |
| Trigger `onProgressWritten`, `onSubmissionCreated/Deleted` → recompute `stats` | `functions/src/progress.ts`, `stats.ts` | Postgres: stats are **computed on read** (`child_stats` function/view) — no denormalized copy to keep in sync; triggers only for `updated_at` + stars |
| Trigger `onChildDeleted` → delete progress/submissions/recordings/code/session | `index.ts` | FK `ON DELETE CASCADE` for rows + trigger that enqueues storage paths into `storage_cleanup_queue`; an Edge Function / pg_cron job deletes the objects |
| Scheduled `scheduledCleanup` (recordings > 90 days, dead codes, rate limits) | `index.ts` | **pg_cron** job (SQL) + queue for storage objects |
| Scheduled `leaderboardRefresh` (30 min) | `leaderboard.ts` | **pg_cron** job calling `refresh_leaderboard()` |
| Emulators (auth/firestore/functions/storage) | `firebase.json`, `tool/emu_test.sh` | `supabase start` (Docker) — local Postgres, Auth, Storage, Edge runtime |
| `firebase_options.dart`, `google-services.json`, `web/src/firebase/config.ts` | app + web | `SUPABASE_URL` / `SUPABASE_ANON_KEY` via `--dart-define` (Flutter) and `VITE_SUPABASE_*` (web) |
| Web SDK (`firebase/*`, 11 files) | `web/src/**` | `@supabase/supabase-js`, one client `web/src/supabase/client.ts`, repositories in `web/src/data/*` keep their public API |
| Flutter SDK (`firebase_*`, `cloud_*`, 14 files) | `app/lib/**` | `supabase_flutter`, same repository interfaces |

## 2. Data model changes requested with the migration

- **Remove the child "level" field everywhere** (already gone from the UI; not in the schema).
- Review days: `children.review_days int[]` with `CHECK (cardinality ≤ 3 AND review_days <@ schedule_days)`.
  Day encoding for the int arrays: **0 = السبت … 6 = الجمعة** (the app's week order).
- Pairing codes expire after **10 minutes** (was 24 h) and are single-use. UI copy that says «٢٤ ساعة» changes.
- Subscriptions: `plan ∈ {monthly, annual, trial, none}`; **monthly = 1 child enforced by a trigger** (was UI-only).
- Progress follows the 3-stage memorization flow: `listen_full → ayah_repeat (×5 per ayah) → full_twice → hadith → done`.
- Lessons table seeded **by script from `content/`**: Al-Ikhlas, Al-Falaq, An-Nas + hadith topics
  برّ الوالدين، الكذب، الغضب — all hadith `approved:false` (topic only, never text).
- Demo code 472918 only when the Edge Function secret `DEMO_MODE=true`.

## 3. Decisions / conflicts to confirm (defaults applied until you say otherwise)

1. **Leaderboard names.** The request says "first name + stars". CLAUDE.md §12 (Designed for Families) says other
   children are never identified to a child. *Default:* the table stores `first_name` as asked, but the child app
   shows **only the child's own name**; other rows stay anonymous (rank + stars) until you confirm.
2. **Recording size ≤ ~2 MB.** Web recordings are 12 kHz 16-bit WAV (≈ 24 KB/s → 3 min ≈ 4.3 MB).
   *Default:* web records **8 kHz mono WAV, max 120 s** (≈ 1.9 MB); Flutter keeps AAC/m4a (much smaller).
3. **Stars.** Not defined in the request. *Default:* +1 star per completed stage of a lesson
   (`listen_full`, `ayah_repeat`, `full_twice`, `hadith`) → max 4 per lesson; the leaderboard sums the week's stars.
4. **Hadith topics الكذب and الغضب** are not in `content/hadith/hadith.json` yet. *Default:* add **topic-only** entries
   (id, title, topic, `approved:false`, no text, no takhrij) so the seed script reads everything from `content/`.
5. **Stats (streak, plan %, growth stage)** were written by Functions. *Default:* computed in SQL on read
   (`child_stats(child_id)`), same rules as `functions/src/stats.ts` (Riyadh days, 295-ayah yearly plan).
6. **Docker Desktop is required** for Phase 7 (`supabase start`). It is not installed on this machine, and the
   machine has been running out of memory with the Firebase emulators — Supabase local needs several containers.
7. **Pending review-notes items** (B4 sidebar plan status, B5 reviewDays, B6 trial subscribe, C lesson stages,
   E tests) are implemented **on the Supabase repositories**, not on Firebase.

## 4. Files that end up removed (only after you confirm everything works — Phase 11)

`app/firebase.json`, `app/firestore.rules`, `app/firestore.indexes.json`, `app/storage.rules`, `app/functions/**`,
`app/tool/rules_test/**`, `app/tool/emu_test.sh`, `app/lib/firebase_options.dart`,
`app/android/app/google-services.json` (tracked today), `web/src/firebase/**`, web `firebase` dependency,
Flutter `firebase_*` / `cloud_*` packages, the Firebase emulator e2e helpers.

## 5. Phase checklist

- ✅ 1 Read & map (this file)
- ⬜ 2 Scaffold (`supabase init`, env examples, gitignore)
- ⬜ 3 Schema migrations + seed script
- ⬜ 4 RLS + storage policies + pgTAP
- ⬜ 5 Edge Functions + triggers + pg_cron
- ⬜ 6 Web + Flutter clients
- ⬜ 7 Local verify (needs Docker) — **stop for OK**
- ⬜ 8 Connect remote (you run the printed commands)
- ⬜ 9 Deploy (Vercel)
- ⬜ 10 Custom domain
- ⬜ 11 Public repo readiness
