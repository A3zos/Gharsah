// Everything a lesson screen renders — produced only by the LessonAgent.
// Port of app/lib/features/lesson/agent/lesson_state.dart.
import type { Hadith } from './hadith';
import type { ProjectContent } from './projects';
import type { QuranRef } from './quran';

/** Which design frame the lesson is on. */
export type LessonScreen =
  | 'loading'
  | 'intro' // 18 (plan)
  | 'reviewIntro' // weekly review (v0.2 §8.6)
  | 'ayah' // 18 (the three memorization stages: whole surah card)
  | 'surahDone' // 19
  | 'hadith' // 20
  | 'projectAssign' // 21
  | 'projectReport' // 22
  | 'lessonEnd' // 23
  | 'ended' // left the call (checkpoint saved)
  | 'failed'; // content couldn't be prepared

/** The live moment inside a screen. Screens map it to the design's states. */
export type LessonBeat =
  /** Teacher says a line; mic closed (dimmed). */
  | 'speaking'
  /** Reciter plays; teacher quiet; mic closed (dimmed). */
  | 'reciting'
  /** Waiting for the mic — only when it couldn't open by itself (permission refused); a tap retries. */
  | 'awaitMic'
  /** Mic open, hearing the child's repeats. */
  | 'listening'
  /** Mic open for the child's go-ahead before the hadith («جاهز ننتقل للحديث؟») — any speech = yes. */
  | 'hearingAnswer'
  /** The lesson's final save is in progress (the lesson isn't shown as finished before it succeeds). */
  | 'saving'
  /** The final save failed after retries — «حاول مجددًا» retries it. */
  | 'saveFailed'
  /** Teacher counts by voice («باقي مرتين»); mic stays open. */
  | 'counted'
  /** Silence nudge («باقي مرة، هيا…»); mic stays open. */
  | 'nudging'
  /** Teacher praises after the last repeat; mic idle. */
  | 'praising'
  /** Handoff line («ننتقل…») — moving to the next screen. */
  | 'advancing'
  /** Frame 22 — recording the project report. */
  | 'recording'
  /** Frame 22 — recorded («حُفظ صوتك» + «أعِد التسجيل»). */
  | 'recorded'
  /** Frame 23 — lesson finished; only «عودة للرئيسية» remains. */
  | 'done';

export interface LessonState {
  readonly screen: LessonScreen;
  readonly beat: LessonBeat;
  readonly stepIndex: number;
  /** Index of the current line within the step (plan highlight on 18, hints on 21). */
  readonly lineIndex: number;
  /** The one line under the teacher (a teacher line or a silent caption). */
  readonly caption: string;
  readonly captionId: string | null;
  readonly teacherSpeaking: boolean;
  /** Praise moments (happy eyes, green caption). */
  readonly happy: boolean;
  readonly ayahRef: QuranRef | null;
  /** Verified Tanzil text — never generated. */
  readonly ayahText: string | null;
  /** «سورة الإخلاص · الآية ١» */
  readonly ayahReference: string | null;
  readonly surahName: string | null;
  readonly surahAyahCount: number | null;
  readonly hadith: Hadith | null;
  readonly project: ProjectContent | null;
  readonly repeatsDone: number;
  readonly repeatsTarget: number;
  /** v0.2 stage of the current step: 1 «استمع وردّد», 2 «آية آية», 3 «السورة كاملة» (0 = none). */
  readonly stage: 0 | 1 | 2 | 3;
  /** The short line between stages is showing (thin progress bar, then auto-advance). */
  readonly stageTransition: boolean;
  /** The whole current surah — verified Tanzil text, in order (the surah card). */
  readonly surahAyat: readonly { readonly ayah: number; readonly text: string }[];
  /** Stage 3: full passes done / needed («المرة ١ من ٢»). */
  readonly passesDone: number;
  readonly passesTarget: number;
  /** Autoplay was refused — show only the design's small fallback play. */
  readonly playbackBlocked: boolean;
  readonly paused: boolean;
  /** TODO(design): no designed state for a denied mic permission yet. */
  readonly micDenied: boolean;
  /** TODO(design): the project report couldn't be saved — retry. */
  readonly saveFailed: boolean;
  /** A progress checkpoint couldn't be saved after retries («لم نتمكّن من حفظ تقدّمك»). */
  readonly progressSaveFailed: boolean;
  /** TODO(design): the recitation audio isn't on the device (offline). */
  readonly contentUnavailable: boolean;
  /** Call timer (frames 18–23 «٠٢:٤٦»), in ms. */
  readonly elapsedMs: number;
  readonly recordingElapsedMs: number;
  readonly recordedDurationMs: number | null;
  readonly endedByUser: boolean;
}

export const initialLessonState: LessonState = {
  screen: 'loading',
  beat: 'speaking',
  stepIndex: 0,
  lineIndex: 0,
  caption: '',
  captionId: null,
  teacherSpeaking: false,
  happy: false,
  ayahRef: null,
  ayahText: null,
  ayahReference: null,
  surahName: null,
  surahAyahCount: null,
  hadith: null,
  project: null,
  repeatsDone: 0,
  repeatsTarget: 3,
  stage: 0,
  stageTransition: false,
  surahAyat: [],
  passesDone: 0,
  passesTarget: 0,
  playbackBlocked: false,
  paused: false,
  micDenied: false,
  saveFailed: false,
  progressSaveFailed: false,
  contentUnavailable: false,
  elapsedMs: 0,
  recordingElapsedMs: 0,
  recordedDurationMs: null,
  endedByUser: false,
};

/** The design's "mic live" (gold, pulse, voice bars). */
export const isMicLive = (s: LessonState): boolean =>
  s.beat === 'listening' || s.beat === 'counted' || s.beat === 'nudging' || s.beat === 'hearingAnswer';

/** The teacher leans in (listening) vs. talks vs. stays quiet (reciter). */
export const isTeacherListening = (s: LessonState): boolean =>
  s.beat === 'listening' || s.beat === 'hearingAnswer' || s.beat === 'recording';

export const isTeacherQuiet = (s: LessonState): boolean => s.beat === 'reciting';

/**
 * What the child has done in this lesson — saved as a checkpoint after each step
 * and on leaving the call, so «أكمل الحصة» resumes where they stopped.
 * Refs are «surah:ayah» keys (the Firestore format).
 */
export interface LessonProgress {
  readonly lessonId: string;
  /** The step to resume at. */
  readonly stepIndex: number;
  readonly doneRefs: ReadonlySet<string>;
  readonly surahsCompleted: ReadonlySet<number>;
  readonly hadithDone: ReadonlySet<string>;
  readonly projectAssigned: string | null;
  readonly reportedProject: string | null;
  readonly completed: boolean;
}

export const newLessonProgress = (lessonId: string): LessonProgress => ({
  lessonId,
  stepIndex: 0,
  doneRefs: new Set(),
  surahsCompleted: new Set(),
  hadithDone: new Set(),
  projectAssigned: null,
  reportedProject: null,
  completed: false,
});
