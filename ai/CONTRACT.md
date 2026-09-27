# اتفاقية الربط بين التطبيق والمعلّم الذكي · App ↔ AI Teacher Contract

> **Draft v0.1 — to be agreed with the AI developer.** Nothing here is final; change it together, then bump the version.

## 1. Division of responsibility

| Concern | Owner |
|---|---|
| Screens, teacher character animation, ayah card, mic control, navigation | **App** |
| Quran text + reciter audio (by `surah:ayah`), hadith (approved set) | **App** (verified assets) |
| Lesson script authoring format + validation | **AI** (format below) |
| Choosing/varying teacher lines within a step, counting, nudges | **AI** |
| Teacher voice (TTS or pre-generated audio) | **AI** |
| Speech-presence detection (child spoke → stopped = 1 repeat) | **AI** |
| Short-answer intents (yes / no / understood) | **AI** |
| Saving progress + the project recording to Firebase | **App** |

### 1.1 Reciter audio (provided by the app)

The app plays the Quran recitation itself; the AI module never loads, synthesises or reads an ayah.

- **Reciter:** Mishary Rashid Alafasy (`ar.alafasy`), Hafs ʿan ʿĀṣim, 128 kbps MP3, per ayah, via
  Al Quran Cloud / islamic.network (`https://cdn.islamic.network/quran/audio/128/ar.alafasy/{globalAyahNumber}.mp3`).
  Audio only — Quran **text** always comes from the verified Tanzil asset, never from this API.
- **Lookup:** `QuranAudioRepository.audioFor(surah, ayah)` in the app. Bundled files live in
  `app/assets/audio/quran/SSSAAA.mp3` (e.g. `112001.mp3`) and are described by
  `app/assets/audio/quran/manifest.json` (reciter, edition, riwaya, bitrate, source pattern, download date,
  and per file: `surah`, `ayah`, `globalNumber`, `sha256`, `durationMs`). Ayat that aren't bundled are
  downloaded once, sha256-verified, cached on the device and played from the cache — never streamed
  mid-lesson.
- **What the AI does:** references ayat by `{"surah": n, "ayah": n}` only, and reacts to the app's
  `recitation_started` / `recitation_finished` events (§3) around app playback — e.g. stays silent while
  the reciter plays, then says «الآن ردّد». Teacher TTS must never read an ayah.

## 2. Lesson script (JSON)

A lesson is an ordered list of **steps**. The app renders each step; the AI drives the teacher and listening.
**Religious content is referenced, never embedded:** Quran by `{"surah": n, "ayah": n}`, hadith by an approved `hadithId`.

```jsonc
{
  "contractVersion": "0.1",
  "lessonId": "m01-w03-ikhlas",
  "title": "سورة الإخلاص + حديث برّ الوالدين",
  "value": "برّ الوالدين",
  "steps": [ /* see step types below */ ]
}
```

### Step types

| `type` | Screen (design frame) | Required fields | Done when |
|---|---|---|---|
| `intro` | 18 L1Intro | `lines[]`, `surah`, `surahInfoRef` | child answers `yes` (or taps) |
| `ayah_loop` | 18 L1Intro (ayah state) | `ref {surah, ayah}`, `repeats` (=3) | `repeats` repeats detected |
| `surah_done` | 19 L6SurahDone | `lines[]`, `question` | child answers `yes` |
| `hadith_loop` | 20 L7Hadith | `hadithId`, `repeats` | `repeats` repeats detected |
| `project_assign` | 21 L8Project | `projectId`, `lines[]`, `hints[3]` | child answers `understood` |
| `project_report` | 22 L9Record (next day) | `projectId`, `question` | recording saved |
| `lesson_end` | 23 L10Done | `lines[]` | — |

`lines[]` are **template ids** from the approved teacher-line bank (see §5), not free text.

## 3. Events: App → AI

| Event | Payload | Meaning |
|---|---|---|
| `lesson_started` | `lessonId`, `childFirstName` | Lesson opened |
| `step_shown` | `stepIndex` | Step UI is on screen |
| `recitation_started` / `recitation_finished` | `ref` | Reciter audio for the ayah |
| `playback_blocked` | `ref` | Autoplay blocked → app shows small fallback play |
| `mic_opened` / `mic_muted` | — | Child opened / muted the mic (one persistent control) |
| `audio_frame` | PCM stream (on-device only) | Live mic audio for presence detection — never stored |
| `tap_fallback` | `answer` | Child tapped instead of speaking |

## 4. Actions: AI → App

| Action | Payload | App does |
|---|---|---|
| `speak` | `lineId`, `slots {name, remaining, …}`, `audio` (file/stream) | Plays teacher audio; character → *speaking* |
| `listen` | `mode: "repeats" \| "answer"`, `expect` | Character → *listening*; mic stays open |
| `repeat_counted` | `count`, `of` | (no on-screen counter — teacher says it) |
| `nudge` | `lineId` | After silence timeout, e.g. «باقي مرة، هيا…» |
| `answer_detected` | `intent: yes \| no \| understood \| unknown` | App advances or re-asks |
| `advance` | `toStep` | App moves to next step |
| `end_lesson` | — | App shows frame 23 and saves progress |

## 5. Teacher-line bank

Approved Arabic templates with slots, reviewed before release. Example ids (text to be finalized + reviewed):

| id | Template |
|---|---|
| `greet.evening` | «مساء الخير يا {name}! أنا معك الآن.» |
| `intro.ready` | «جاهز نبدأ نحفظ؟» |
| `ayah.listen` | «اسمع الآية من القارئ…» |
| `ayah.repeat_now` | «الآن ردّد معي.» |
| `count.two_left` | «أحسنت… باقي مرتين.» |
| `count.one_left` | «ممتاز… باقي مرة.» |
| `count.done` | «ما شاء الله! ننتقل للآية التالية.» |
| `nudge.one_left` | «باقي مرة، هيا…» |
| `surah.done` | «أتممت السورة يا {name}!» |
| `surah.next_hadith` | «جاهز ننتقل للحديث؟» |
| `project.tomorrow` | «وبكرة، قبل حصتنا، خبّرني وش سويت.» |
| `report.ask` | «وش سويت في مشروع الأمس؟» |
| `end.see_you` | «بكرة أنتظرك… علّمني وش سويت في مشروعك.» |
| `offscript.ask_parent` | «سؤال جميل! اسأل بابا أو ماما.» |

## 6. Non-functional targets (proposed)

- Repeat detection latency: < 500 ms after the child stops speaking.
- Must not count the reciter/teacher audio as the child (echo/playback suppression).
- Works offline for a downloaded lesson.
- Child's live audio never leaves the device.

## 7. To decide together

Runtime & packaging (on-device plugin vs. service), TTS choice, pre-generated vs. live teacher audio, VAD/presence model, the exact silence-timeout values, and how lesson scripts are delivered (bundled vs. Firestore).

---

## 8. PROPOSAL — v0.2 (written by the app team; NOT yet agreed)

> **Status: proposal.** Sections 1–7 above stay the agreed Draft v0.1. This section describes what the
> app's on-device `LessonAgent` (web `web/src/lesson/`, Flutter `app/lib/features/lesson/`) implements
> from review notes C8–C12 + the product owner's decisions (D2, D3, D5, D7), so the AI developer can
> accept, change or reject it. Nothing in `ai/` other than this section was edited.
>
> ⚠️ The AI developer's branch `ai-api-docs` (`ai/API.md`) documents a different, server-side
> architecture (`manara-backend`: HTTP state machine, LLM-worded lines, external recitation scoring).
> This proposal describes the app's interim on-device teacher only; reconciling the two is an open item.

### 8.1 Memorization flow — three stages (replaces "ayah × 3")

Constants (app code, not magic numbers): `STAGE1_PASSES = 1`, `AYAH_REPEATS = 5`, `FULL_SURAH_PASSES = 2`.

| Stage | Name (UI) | What happens | Done when |
|---|---|---|---|
| 1 | «استمع وردّد» | For each ayah in order: the reciter plays it, then the child repeats it once | 1 repeat per ayah |
| 2 | «آية آية» | For each ayah: the reciter plays it, the child repeats it **5×** (5-dot counter) | 5 repeats per ayah |
| 3 | «السورة كاملة» | No recitation; the child recites the **whole surah twice** («المرة ١ من ٢») | 2 full passes |

- Between stages: one short teacher line, then auto-advance (thin progress bar).
- **Full pass (presence only, D3):** the child has spoken for at least **50 %** of the reciter's
  duration for that surah (sum of the manifest `durationMs`), then paused ≥ **2.5 s**. Never graded.
- The screen shows the **whole surah** (verified Tanzil text from the app) with the current ayah highlighted.

### 8.2 Script format v0.2

`contractVersion: "0.2"` scripts may be written directly; a v0.1 script (`intro` + `ayah_loop`s) is
**expanded by the app** into v0.2 steps, so existing lesson JSON keeps working:

| `type` | Fields | Meaning |
|---|---|---|
| `stage_intro` | `stage: 1\|2\|3`, `surah` | The line between stages; auto-advances |
| `ayah_loop` | `ref`, `repeats`, `stage: 1\|2` | As v0.1, now tagged with its stage |
| `full_surah` | `surah`, `passes` | Stage 3 (and the review lesson) |
| `review_intro` | `lines[]` | Opens the weekly review lesson |

`question` fields are **ignored** in v0.2: no step waits for an answer or a tap (§8.3).

### 8.3 No taps (C8, D2)

- Every transition is automatic: the teacher's line finishes, then ~2 s, then the next step.
- The mic is **not a button**: it opens by itself on the child's first turn and stays open
  (indicator only: «المعلّم يتكلم…» while the teacher speaks). The only control is ✕ → ExitConfirm.
- Frame 22 (project report): recording starts after the question and stops by itself after the child
  stops talking (~3 s of silence after speech) or at the cap (120 s); the recording is saved automatically.
- Silence while waiting for repeats: nudges → one replay → wait (unchanged).

### 8.4 New AI → App action: `manners_redirect`

| Action | Payload | App does |
|---|---|---|
| `manners_redirect` | — | Pauses counting (nothing is counted), the teacher says one approved line (`manners.redirect`), then the same moment resumes with the counts kept |

Emitted only by an AI module that understands speech content. The app's interim presence-only teacher
never emits it (it cannot tell what was said).

### 8.5 Event change: `repeat_detected` carries `voicedMs`

`repeat_detected { voicedMs }` — how long the child actually spoke in that utterance. Used for §8.1
full passes. Optional: when missing, the app assumes 1000 ms.

### 8.6 Weekly review lesson

Built by the app from what the child has already memorized (server stats), not a static script:
`review_intro` → for each memorized surah: `stage_intro(3)` + `full_surah(passes: 1)` →
approved hadith (if any): `hadith_loop(repeats: 1)` → `lesson_end`. Unapproved hadith topics are not
reviewed. Starting it from the «المراجعة» tab stays locked in the UI until the product owner enables it.

### 8.7 Hadith and project (C11, C12)

- Hadith line: `hadith.today` = «حديث اليوم عن {topic}». Unapproved (`approved !== true`): the teacher
  adds only `hadith.soon` = «سنتعلّمه معًا قريبًا بإذن الله» and moves on — no text, no attribution,
  no explanation (D5). Approved: the app shows/plays it exactly from `content/hadith/hadith.json`.
- Project: daily («مشروع اليوم»): `project.today` = «مشروعك اليوم: {projectTitle}», then the three
  hints, then «غدًا تحكي لي ماذا فعلت». `end.see_you` = «أراك غدًا يا {name}» moves to the lesson end.

### 8.8 New teacher-line ids (approved-bank candidates, REVIEW before release)

`stage.1`, `stage.2`, `stage.3`, `stage1.your_turn`, `full.start`, `full.again`, `full.done`,
`surah.to_hadith`, `hadith.today`, `hadith.soon`, `project.today`, `end.see_you`, `manners.redirect`,
`review.intro`, `review.surah` — exact Arabic in `web/src/lesson/teacherLines.ts` (= the Flutter bank).
None contains Quran or hadith text.
