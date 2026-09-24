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
