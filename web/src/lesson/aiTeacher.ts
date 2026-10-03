// The AI teacher, as seen by the app — mirrors ai/CONTRACT.md (Draft v0.1).
// Port of app/lib/features/lesson/ai/ai_teacher.dart.
//
// The web ships an INTERIM implementation (src/lesson/browser/) that the AI
// developer's module replaces behind this interface. Division of work with the
// LessonAgent: the teacher *speaks* approved lines and *detects* the child's
// speech (presence only — never grading). The agent decides what happens next.
import type { Subscribe } from './observable';
import type { QuranRef } from './quran';
import type { TeacherLine } from './teacherLines';

export type ListenMode = 'repeats' | 'answer';
export type AnswerIntent = 'yes' | 'no' | 'understood' | 'unknown';

/** The child can't be heard (permission refused or no microphone). */
export class MicPermissionDenied extends Error {
  override name = 'MicPermissionDenied';
}

/** App → AI events (CONTRACT §3). */
export type LessonEvent =
  | { type: 'lessonStarted'; lessonId: string; childFirstName: string }
  | { type: 'stepShown'; stepIndex: number }
  | { type: 'recitationStarted'; ref: QuranRef | null }
  | { type: 'recitationFinished'; ref: QuranRef | null }
  | { type: 'playbackBlocked'; ref: QuranRef | null }
  | { type: 'micOpened' }
  | { type: 'micMuted' }
  | { type: 'tapFallback'; answer: AnswerIntent };

/** AI → App actions that come from listening (CONTRACT §4). */
export type TeacherAction =
  /** The child started speaking (the agent holds the silence timer). */
  | { type: 'speechStarted' }
  /** Speech started but was too short to count — nothing was heard (the silence timer restarts). */
  | { type: 'speechIgnored' }
  /** The child spoke and stopped — one repeat candidate (presence only). `voicedMs`
   *  = how long they actually spoke (v0.2 §8.5; full-surah passes). */
  | { type: 'repeatDetected'; voicedMs?: number }
  /** v0.2 §8.4: the AI heard something off (manners) — the teacher redirects, nothing is counted.
   *  Only a content-aware AI module emits it; the interim presence-only teacher never does. */
  | { type: 'mannersRedirect' }
  /** A short answer in 'answer' mode. */
  | { type: 'answerDetected'; intent: AnswerIntent };

export interface AiTeacher {
  onEvent(event: LessonEvent): void;
  /** AI → App actions from listening. */
  readonly actions: Subscribe<TeacherAction>;
  /** Live input level 0..1 for the child's voice bars (on-device, never stored). */
  readonly inputLevel: Subscribe<number>;
  /** Plays [line] (resolved [text] for captions/TTS). Resolves when done or stopped. */
  speak(line: TeacherLine, text: string): Promise<void>;
  stopSpeaking(): Promise<void>;
  /** The mic stays open until stopListening. Rejects with MicPermissionDenied. */
  listen(mode: ListenMode): Promise<void>;
  stopListening(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  dispose(): Promise<void>;
}
