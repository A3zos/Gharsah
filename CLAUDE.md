# غَرْسة (Gharsah) — Full Project Brief for Claude Code

This file is the complete spec: product, architecture, design system, all screens, and the build
plan. It lives at the repo root so it's always in context. **Plan first, then implement.**

---

## 0. Repository layout (monorepo — READ FIRST)

```
Gharsah/
├── app/      Flutter app + firebase.json + firestore.rules + storage.rules + functions/ (Cloud
│             Functions, TypeScript) + tool/ (rules tests, emulator wrapper, asset builders, design_compare)
├── web/      Web app — Vite + React + TypeScript (React Router 8, Tailwind 4), same Firebase project.
│             src/lesson/ = framework-free TS port of the LessonAgent (+ same tests).
├── content/  Verified content shared by app/ and web/ (single source of truth): Tanzil Quran text +
│             meta + splash ayat, Alafasy audio + manifest, hadith (placeholder), projects, lesson scripts.
├── tokens/   design-tokens.json → generates app/lib/theme/app_tokens.g.dart + web Tailwind theme
├── ai/       AI teacher — owned by a separate AI developer. Do NOT write code here unless asked.
│             The app ↔ AI interface is ai/CONTRACT.md (Draft v0.1); guardrails in ai/GUARDRAILS.md.
├── design/   Approved design (screens/*.png, html/*.html, DESIGN_NOTES.md)
├── docs/     BRD and other documents
└── CLAUDE.md this file
```

- **All Flutter commands run from `app/`** (`cd app && flutter run -d chrome`). All code paths in this
  file (`lib/...`, `assets/...`, `tool/...`) are relative to `app/`.
- **Web commands run from `web/`**: `npm run dev` (live Firebase) / `npm run dev:emu` (emulators), `npm run ci`
  (tokens check, typecheck, lint, unit tests, build), `npm run e2e` (Playwright). Paths `src/...` are relative to `web/`.
- **content/ is the source of truth**; `app/assets/{data,lessons,audio/quran}` is a committed mirror. Edit `content/`,
  then from `app/` run `dart run tool/sync_content.dart` (`flutter test` fails if they differ). Web reads `content/` directly.
- **Design tokens**: edit `tokens/design-tokens.json`, then `node tokens/build.mjs` (never edit the generated
  `app_tokens.g.dart` / `web/src/styles/tokens.generated.*`; CI runs `--check`).
- **Firebase CLI runs from `app/`** too (firebase.json lives there): `firebase deploy --only firestore:rules --project nibras-59284`.
- Design files are at the repo root: from `app/` they are `../design/...`.
- When building the lesson screens (frames 17–23), code against the interface in `ai/CONTRACT.md` and use a
  local mock of the AI teacher until the real module is delivered. Propose contract changes in writing; don't
  change `ai/` files silently.
- Git: private repo https://github.com/A3zos/Gharsah (branch `main`). Commit per finished screen/feature.

---

## 1. What we're building

**غَرْسة** — a mobile app (Flutter, **Android-first via Google Play**) that teaches children
**ages 8–13** to memorize Quran, hadith, and Islamic values through an **interactive "live-feel"
lesson** led by an AI teacher (voice), then turns each lesson into a **weekly practical project**
the child does in real life (e.g. برّ الوالدين) and reports back by voice.

Built for the **"تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي" (Bathel Foundation)** — Track 3
(interactive experiences) + Track 4 (verification & attribution). **Reliability of religious
content is the top judging criterion.**

**Two users, two experiences under one identity:**
- **Parent (adult):** subscribes, adds a child, sets a schedule, gets a pairing code, and monitors
  progress (view-only). Parent screens are **calm & trustworthy**.
- **Child (8–13):** enters the parent's pairing code (no account), goes through the live lesson.
  Child screens are **playful**. Audio-first (many can't read vowelized Quran).

## 2. Tech stack & architecture

- **Flutter** (Dart), Android-first. Later: iOS.
- **Firebase**: Auth (parent email/password) + Firestore (source of truth) + Storage (child audio).
- **Google Play Billing** for the subscription (NOT a custom card form — Play rejects that).
- **HARD ARCHITECTURE CONSTRAINT — parent and child are on SEPARATE devices.** Local storage
  CANNOT bridge them. The pairing code, the child's submissions, and progress MUST live on the
  server (Firestore). Local storage only caches the verified session so the child needn't re-enter
  the code. Flow: parent subscribes (Play) → **server** generates a one-time pairing code tied to
  the child profile → child enters the 6-digit code → child app verifies with the server → server
  returns a session token + profile → child device caches only that.
- **AI teacher**: a **guided per-lesson script + dynamic voice responses** (NOT open chat). Uses
  **Arabic TTS** for the teacher's voice, and **on-device speech-presence detection** to count the
  child's 3 repeats (detect that the child spoke — NOT pronunciation grading). Real recitation
  grading (e.g. on-device fastconformer-quran) is a **future** phase, only after testing on kids.
- **Quran**: text from a **verified local JSON asset** bundled offline (Hafs), audio from a trusted
  reciter source (e.g. AlQuran Cloud, per-ayah) downloaded offline. **Never fetch splash/lesson
  Quran text from an API at runtime, and never let the AI generate it.**

## 3. Critical guardrails (do not violate)

1. **The AI never generates or completes Quran/hadith text.** Quran = verified local asset; hadith
   = a clearly-marked placeholder «[نص حديث برّ الوالدين — يُعتمد لاحقًا من مصدر موثّق مع التخريج]»
   until a real vetted source is added. Surah info (مكية/مدنية, ayah count, سبب النزول) from a
   verified source, not free generation.
2. **Child data privacy (Designed for Families):** parental gate before parent areas; declare audio
   + progress in Play Data Safety; prefer on-device processing; store child audio securely and delete
   when no longer needed; child gives no personal data (enters only a code).
3. **Payment only via Google Play Billing.**
4. **Server is the source of truth** for pairing and submissions (never local storage).

## 4. Design system (single source of truth)

Create `lib/theme/app_theme.dart` with these exact tokens (extracted from the approved design).
Add `google_fonts`. **No screen hardcodes a color / size / radius / shadow — all from here.** Give
the `TextTheme` an explicit `fontSize` on every style (prevents the `fontSize != null` assertion).

- **Colors:** cream bg `#FBF6EC`; surface `#FFFFFF`; primary green `#2FA98C`; deep green (brand/
  buttons/CTA text-on-light) `#1B7F69`, darker `#14624F`; green tint `#EAF6F2`; soft green `#7ACBB6`;
  gold `#F4B740`, gold tint `#FDF1DA`, text-on-gold `#4A3206`; berry `#E86A92` / deep `#A8365C` /
  tint `#FDE9EF`; sky `#4EA9E8` / tint `#E7F2FC`; text dark `#1F3D37`; text muted `#5C716C`; ayah
  brackets gold `#9C6B12`; borders `#EFE7D6` / `#E4DCC8` / `#F4F0E4`.
  Also from the approved auth frames (tokens in `AppColors`): input border `inputBorder #E7DECB`;
  placeholder `placeholder #8A9A95`; error text `errorText #8E2B4D`; warning text `warningText #7A5209`;
  seed core `seedGold #D99F23`.
- **Fonts:** body **Cairo**; headings/brand **Baloo Bhaijaan 2**; Quran ayat **Amiri Quran** (Uthmani: ٱ, dotless ى,
  small waqf marks — product-owner decision, both apps); hadith/classical text **Amiri**.
- Colors, radii, shadows and font families live in `tokens/design-tokens.json` (single source for both apps).
- **Radii:** chips 14, icon-box 18, rows 18, auth buttons & text fields 20 (`AppRadii.input`),
  gold CTA button 22 (`AppRadii.cta`), small card 24, card 28, hero card 30, pills 999.
- **Shadows:** card `0 10px 26px rgba(31,61,55,0.06)`; soft `0 8px 18px rgba(31,61,55,0.04)`; hero
  green `0 16px 32px rgba(27,127,105,0.26)`.
- RTL Arabic (`locale: Locale('ar')`), Arabic-Indic numerals ٠١٢٣ everywhere, touch targets ≥48px,
  phone width 390 (center content ~560 on tablet), respect safe areas, Android back collapses an
  open section (doesn't exit).

## 5. Reusable widgets (build before screens)

`TeacherCharacter` (human Muslim teacher: white thobe + head cover + book, large & centered; states
`speaking` = talking + sound-wave/glow, `listening` = quiet/leans-in; SAME character across all
lesson screens); `LiveMicButton` (one persistent listening control — open = mic no slash + pulse,
muted = mic with slash; not tapped per repeat); `LiveBadge` («● مباشر»); `AyahCard` (﴿ … ﴾ Amiri,
gold brackets + reference, no visible play button, card tappable as silent fallback); `GPrimaryButton`
(gold CTA); `GHeroCard` (deep-green card + hero shadow); `GStatCard`; `GPill`; `GrowthTimeline`
(seed→sprout→tree, RTL: seed on the right); `BottomNavBar`.

## 6. Screens & functional requirements

### Parent flow
- **Splash** — dynamic ayah in ﴿ ﴾ (Amiri, gold brackets) + reference; rotates each launch from a
  verified local JSON; brand «غَرْسة» + tagline «نغرس حُبّ القرآن… ويكبر معهم»; auto → Login.
- **Auth** — two buttons: «تسجيل دخول» / «إنشاء حساب» + terms & privacy links.
- **Login** — two tabs. **ولي الأمر**: email + password (show/hide) + «نسيت كلمة المرور؟» +
  «تسجيل الدخول» + link «إنشاء حساب». **الطفل**: 6-digit pairing code (Arabic-Indic, auto-advance),
  verify via server, states: incomplete / wrong / verified; no email/password.
- **Signup** — name + email + password + confirm.
- **Packages** — current-plan card (name + days left + progress + expiry + «تجديد»); plans:
  **سنوية ١١٩ ريال (الأفضل قيمة)** + **شهرية ٢٩ ريال**; «الدفع عبر Google Play»; «إضافة ابن»;
  children list (avatar + name + age + pairing code + «الإنجازات» → Dashboard); note: subscription
  managed by Google Play, no in-app card, cancel from Play. Bottom nav: الباقات / لوحة التحكم.
- **PlayConfirm** — Google-Play-style purchase confirmation (no card entry).
- **AddChild** — 3-step stepper: (1) البيانات: name + age chips ٨–١٣ (default ١٠) + gender بنت/ولد
  → (2) الجدول: weekday toggles + unified time (+ per-day custom) + duration ٣٠/٤٥/٦٠ (default ٤٥,
  daily cap) + reminder → (3) الشخصية: modest Muslim avatar picker.
- **PairingCode** — big 6-digit code + «انسخ» + «شارك» + «أعطِ هذا الرمز لطفلك»; issued by server
  after successful payment.
- **Dashboard** (view-only) — child-switcher chips; growth hero (`GrowthTimeline` by yearly-plan %,
  + month/week chip); four stat cards (السور / الآيات / الأحاديث / المشاريع), each expands.
- **DashProjects** (highlight) — list of the child's projects: title + «مكتمل ✓» + date + **audio
  player** to hear the child's own recording. (DashSurahs / DashAyat / DashHadith similar.)

### Student flow (audio-first, live feel)
- **StudentHome** — greeting + growth stage + streak; **weekly leaderboard** (top 5, medals top 3,
  child's row highlighted, encouraging «أنت ضمن أفضل ٢٠٪», «يتجدد أسبوعيًا», first names only);
  **hero «حصة اليوم»** (chips سورة الإخلاص + حديث برّ الوالدين, progress, gold CTA «ابدأ الحصة»);
  3 shortcuts (القرآن / الأحاديث / المشاريع); bottom nav الرئيسية / ملفّي.
- **L1Intro** — `TeacherCharacter` + «● مباشر»; spoken interactive intro (surah name / مكية-مدنية /
  ayah count) + «خطة اليوم» + «جاهز نبدأ نحفظ؟» (mic answer) → the **ayah loop**: for each of Surah
  Al-Ikhlas's 4 ayat — `AyahCard` → auto-play recitation (no visible play button) → child repeats
  **3×** with the mic opened once & staying open, teacher counts by voice → auto-advance. No
  per-ayah result screen, no chat bubbles, no pronunciation grading (presence only).
- **L6SurahDone** — live surah-complete: celebration + growth step + teacher praises by voice +
  stats + mic; asks «جاهز ننتقل للحديث؟» → yes → hadith (fallback button kept).
- **L7Hadith** — topic **برّ الوالدين**; same style as Quran (repeat 3×); hadith text = placeholder;
  ends with the teacher voicing the project assignment + «بكرة خبّرني».
- **L8Project** — teacher assigns برّ-الوالدين project; three step-hints shown as reminder; mic for
  the child to reply (فهمت / إن شاء الله), not to record now.
- **L9Record** — next-day report: teacher «وش سويت في مشروع الأمس؟» → child records by voice
  (recording state + waveform + re-record) → saved to server for the parent.
- **L10Done** — lesson complete: growth step («غرستك كبرت») + «أكملت درس اليوم ✓» + streak +
  «عودة للرئيسية» + a mic line «بكرة أنتظرك، علّمني وش سويت».

## 7. Build plan (phased — verify each on the emulator/Chrome before the next)

- **Phase A — foundation:** new Flutter project, `google_fonts`, `app_theme.dart`, RTL + Arabic
  locale + Arabic-Indic numerals helper, Firebase wired (Auth + Firestore), folder structure.
- **Phase B — reusable widgets** (section 5).
- **Phase C — parent flow** screens (section 6) with real Firebase auth + Firestore pairing +
  Play Billing (mock the Play purchase first, then integrate).
- **Phase D — student flow** screens (the live lesson), with the verified Quran asset, Arabic TTS,
  and on-device speech-presence counting.
- **Phase E — polish, error/edge states** (wrong code, no mic permission, offline, autoplay
  blocked, expired subscription, multiple children), Play Data Safety + parental gate.

Build **one screen at a time**, run it, and confirm before moving on.

## 8. Do NOT

- Do not generate/complete Quran or hadith text. Do not fetch Quran text at runtime for splash/lesson.
- Do not use local storage as the source of truth for pairing or submissions (server only).
- Do not build a custom card-payment form (Google Play Billing only).
- Do not add chat bubbles, a visible media play button, or per-repeat mic toggling.
- Do not change the teacher character between lesson screens.
- Do not collect personal data from the child (code entry only).

## 9. Notes for the developer

- First Android build is slow (Gradle + SDK downloads); on a 16GB machine set
  `org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m` and `org.gradle.daemon=false` in
  `android/gradle.properties`, and close browsers, or a real phone is lighter than an emulator.
- Ask me (the product owner) whenever a requirement is ambiguous rather than guessing on
  irreversible choices.

---

## 10. Design reference (READ BEFORE EVERY SCREEN)

The approved design lives in `design/` at the repo root:
- `design/README.md` — screen map (frame number → file → screen name).
- `design/screens/*.png` — how each screen must look. View the PNG before building that screen.
- `design/html/*.html` — exact values (colors, sizes, radii, spacing, copy). Read it; don't eyeball.
- `design/DESIGN_NOTES.md` — behavior notes for the live lesson, mic, dashboard, growth stages.

Workflow per screen: open the PNG + HTML → build with `app_theme.dart` tokens and the shared widgets →
run it → take a screenshot and compare side by side with the PNG → fix differences before moving on.
The HTML is a mockup, not code to port. Mockup data and the hadith text are placeholders.

---

## 11. Pre-release TODO (do not ship without these)

- [ ] **Bundle fonts offline.** Amiri Quran (ayat) is already bundled in `assets/google_fonts/` (the exact file
      google_fonts pins). `google_fonts` still downloads Cairo / Baloo Bhaijaan 2 / Amiri at runtime. Before
      release: add those .ttf files there too and set `GoogleFonts.config.allowRuntimeFetching = false`.
      (Web self-hosts all four via @fontsource.)
- [ ] **Require email verification** before subscribing or adding a child (Phase C). Login is allowed
      while unverified, with a resend banner on the parent home.
- [ ] **Tanzil attribution (CC BY 3.0).** Quran text comes from the Tanzil Project
      (`content/quran/splash_ayat.json`). Credit «نص القرآن: مشروع تنزيل — tanzil.net» with a link in a
      visible place (e.g. an «عن التطبيق» screen or the terms page) before release.
- [ ] **Reciter audio licence.** Confirm the reciter recordings' usage terms (Mishary Alafasy via
      Al Quran Cloud / islamic.network) allow use in a paid app before release.
- [ ] **Remove the remaining sample data** (`lib/core/mock_data.dart`): today it's used only for debug
      design previews, the dashboard of a child with no progress yet (flagged «بيانات توضيحية»), and
      the Packages plan card when there is no subscription — which still needs a designed
      "no subscription yet" state.
- [ ] **Replace the mock Play purchase** (`MockPlaySubscriptionRepository`) with Google Play Billing +
      server-side token verification; then `parents/{uid}/subscription` becomes server-write-only
      (`allow write: if false`). `createPairingCode` already requires an active subscription.
- [ ] **Replace the INTERIM AI teacher** (`lib/features/lesson/ai/interim/`) with the AI developer's
      module behind `AiTeacher`; review the teacher-line bank (lines marked `// REVIEW`).
- [ ] **Hadith:** add a vetted hadith (text + takhrij + grading + source + reviewer + audio) and set
      `approved: true` in `content/hadith/hadith.json` (then sync) — it then displays and plays with no code change.
- [ ] **Real lesson plan:** replace the interim `m01-w03-day2` script with the yearly plan.
- [ ] **Designs for the TODO(design) states** (grep `TODO(design)`): mic permission denied, offline /
      audio unavailable, report save failed, «done for today» hero, «ملفّي», the 3 shortcuts,
      expired / claimed pairing code + «إصدار رمز جديد» confirm, delete recording, no-children
      dashboard, sample-data note, too-many-attempts / offline on the child code tab, autoplay-blocked
      fallback play.
- [ ] **Remove or rotate the demo account before public launch.** `node tool/remove_demo.ts` deletes
      it (auth user, docs, recordings, isDemo codes); `node tool/seed_demo.ts` (re)creates it. The
      demo code's multi-device / no-expiry exception exists only for `isDemo: true` codes, in
      `claimPairingCode`.
- [ ] **App Check** (Play Integrity) on the callable Functions (`claimPairingCode` especially).
- [ ] Every rules change: extend `tool/rules_test/*.mjs` (allow + deny) and run them before deploying —
      never loosen a rule.

---

## 12. Data model (Firestore + Storage) — server is the source of truth

| Path | Written by | Read by |
|---|---|---|
| `parents/{uid}` name, email, role, createdAt | parent | parent |
| `parents/{uid}/subscription/current` | parent (MOCK Play) | parent |
| `parents/{uid}/children/{childId}` name, age, gender, avatar, schedule, ownerUid, createdAt | parent | parent; its linked device (get only) |
| … same doc: `pairing{code,expiresAt,status}`, `linkedDeviceUid`, `stats{…}`, `leader{…}` | **Functions only** | same |
| `…/children/{childId}/progress/{lessonId}` lesson checkpoints (stepIndex, doneRefs, surahsCompleted, hadithDone, projectAssigned, reportedProject, completed, startedAt, updatedAt) | linked device | parent, device |
| `…/children/{childId}/submissions/{id}` projectId, lessonId, storagePath, durationMs, createdAt | linked device (create only) | parent (read/delete) |
| `pairingCodes/{code}` parentUid, childId, createdAt, expiresAt (24 h), status | **Functions only** | nobody |
| `childSessions/{deviceUid}` parentUid, childId, linkedAt | **Functions only** | that device (get) |
| `rateLimits/{deviceUid}` | **Functions only** | nobody |
| `leaderboard/current` weekKey, total, rows[{rank, points}] — NO identities | **Functions only** | child devices (get) |
| Storage `recordings/{uid}/{childId}/{submissionId}.m4a` (.wav from web) | linked device (create, audio ≤ 5 MB) | parent (read/delete) |

`stats` (child doc): ayat, surahs, hadith, projects, streak (consecutive **scheduled** days, Riyadh time),
planPct (of the yearly plan — `functions/src/config/yearly_plan.json`, 295 ayat), stage
(seed 0–33 / sprout 34–66 / tree 67–100), surahsDone[{surah,at}], surahInProgress, hadithDone[{id,at}],
ayatBySurah, latestAyat, pendingProject, lessonDays, weekKey + weekPoints. `leader`: the child's own
weekly rank/points/topPercent/gapToAbove. Other children are never identified to a child.

Child device identity: anonymous Firebase Auth → `claimPairingCode` → only the verified session is
cached on the device (`ChildSessionRepository`); relaunch → StudentHome while `childSessions/{uid}`
exists; revoked → back to the child code tab.

## 13. The live lesson — `LessonAgent` (lib/features/lesson/agent/)

The single brain of frames 18–23; screens only render `LessonState` and forward taps as commands.
- Script: ai/CONTRACT.md format in `content/lessons/*.json` (`m01-w03-ikhlas`; interim `m01-w03-day2`).
  Quran by surah:ayah (verified Tanzil text `content/quran/quran_text.json`, Alafasy audio in
  `content/audio/quran/` + manifest, mirrored to `app/assets/`; other surahs downloaded once, sha256-cached, never streamed).
- Flow: intro → per ayah (recitation autoplays → «الآن ردّد» → 3 presence-counted repeats → praise) →
  surah done → hadith (placeholder, silent until approved) → project → end; next day the report first.
- Rules enforced: teacher silent while the reciter plays; mic deaf during reciter/teacher speech
  (+ echo guard); mute pauses counting only; background pauses, return resumes the same moment;
  autoplay blocked → small fallback play; silence → nudges, then one replay, then wait; checkpoints
  after each step so «أكمل الحصة» resumes.
- Commands: play, pause, resume, stop, replayAyah, nextAyah, previousAyah, setVolume, micTap,
  tapTeacher, tapFallback, continueTapped, reRecord, endCall.
- `AiTeacher` mirrors ai/CONTRACT.md events/actions. INTERIM implementation: device Arabic TTS +
  on-device energy presence detection (nothing stored/uploaded). Surah intro states the ayah count
  only — never مكية/مدنية or سبب النزول until a verified dataset exists.

## 14. Cloud Functions (`app/functions`, TypeScript, 2nd gen, us-central1 = Firestore nam5)

Callable: `createPairingCode`, `revokePairingCode` (parent only, active subscription, ownership by path),
`claimPairingCode` (anonymous device, 5 wrong codes / 10 min / device).
Triggers: `onProgressWritten`, `onSubmissionCreated` (verifies the recording exists), `onSubmissionDeleted`
→ recompute `stats`; `onChildDeleted` → delete progress, submissions, recordings, code, session.
Scheduled: `scheduledCleanup` daily 03:00 Riyadh (recordings > 90 days, dead codes, rate limits);
`leaderboardRefresh` every 30 min (anonymous board, weekly reset Saturday 00:00 Riyadh).

## 15. Tests & deploy

All emulator tests run on TEST ports via `tool/emu_test.sh` (it also stops the Java emulator the CLI
leaves behind on Windows). From `app/`:
```
flutter analyze && flutter test
bash tool/emu_test.sh firestore "node tool/rules_test/rules.test.mjs"
bash tool/emu_test.sh firestore,storage "node tool/rules_test/storage.test.mjs"
npm --prefix functions run test:emu
```
Deploy (only after the product owner approves), from `app/`:
```
firebase deploy --only firestore:rules,firestore:indexes,storage --project nibras-59284
firebase deploy --only functions --project nibras-59284
```
