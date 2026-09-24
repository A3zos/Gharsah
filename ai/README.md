# ai/ — المعلّم الذكي · The AI teacher

> هذا المجلد لمطوّر الذكاء الاصطناعي. اقرأ بالترتيب: هذا الملف ← [`GUARDRAILS.md`](GUARDRAILS.md) ← [`CONTRACT.md`](CONTRACT.md) ← [`examples/`](examples/).
> This folder belongs to the AI developer. Read in order: this file → GUARDRAILS → CONTRACT → examples.

## الفكرة · What the child experiences

The child (8–13) opens today's lesson and feels like they're **on a live call with a teacher**. The teacher speaks, the ayah appears on screen, the reciter's recitation plays, and the child repeats it **3 times** while the teacher counts out loud like a game — then moves to the next ayah. After the surah: a short hadith in the same style, then a real-life project assignment («بكرة خبّرني وش سويت»). Next day the child reports on the project by voice, and the recording goes to the parent's dashboard.

Watch the flow in the design: `../design/screens/17-StudentHome.png` → `18-L1Intro` → `19-L6SurahDone` → `20-L7Hadith` → `21-L8Project` → `22-L9Record` → `23-L10Done`, and read `../design/DESIGN_NOTES.md` (the long note at the end describes every state of the lesson).

## النطاق · Scope (v1)

| # | Component | What it must do |
|---|---|---|
| 1 | **Guided lesson script** | A per-lesson script (NOT open chat): intro → ayah loop → surah done → hadith → project → end. Format defined in `CONTRACT.md`. |
| 2 | **Dynamic teacher lines** | Short, warm, child-friendly spoken lines chosen/varied by the teacher (praise, counting «باقي مرتين… باقي مرة»), using the child's first name. Varied, but always within the script's step — never free conversation. |
| 3 | **Teacher voice (Arabic TTS)** | Natural Arabic voice for the teacher's lines ONLY. The ayah is **never** read by TTS — it's played from the reciter's audio. |
| 4 | **Speech-presence detection** | On-device detection that the child *spoke then stopped* → counts one repeat. **Presence only — no pronunciation grading.** Must handle: silence → gentle nudge; background noise; teacher/reciter audio not counted as the child. |
| 5 | **Short voice answers** | Recognize simple replies at decision points («جاهز نبدأ؟» → نعم/لا; «فهمت؟» → فهمت / إن شاء الله). Small closed set of intents, with a tap fallback in the app. |

**Out of scope for v1:** recitation/pronunciation grading (future phase, only after testing with children), open-ended chat, generating any religious content.

## ما يوفّره التطبيق · What the app already provides

- Verified Quran text (Tanzil, bundled offline) and per-ayah reciter audio — referenced by `surah:ayah`.
- The UI: teacher character (speaking/listening states), ayah card, persistent mic control, «● مباشر» badge.
- Microphone access, audio playback, Firebase (auth, Firestore, Storage for the child's project recording).

## أسئلة مفتوحة للاتفاق · Open questions to agree on

1. Where does each part run — on-device, or a server? (Child privacy strongly prefers on-device for audio.)
2. Which Arabic TTS (quality, dialect, offline support, licensing, cost)?
3. Which presence/VAD model, and its latency and false-positive rate with kids' voices?
4. Pre-generated teacher audio vs. live TTS (pre-generated = consistent + offline + reviewable).
5. Language/runtime for the AI module and how it's packaged into the Flutter app (e.g. platform plugin, TFLite/ONNX, or HTTP service).

## الحالة · Status

`CONTRACT.md` is **Draft v0.1** — to be agreed between the app and AI developers before any code is written.
