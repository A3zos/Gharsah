// What the agent needs from the outside world. Browser implementations live in
// src/lesson/browser/; tests use fakes. Ports of recitation_player.dart,
// project_recorder.dart and LessonProgressSink.
import type { Subscribe } from './observable';
import type { QuranRef } from './quran';
import type { LessonProgress } from './state';

/** Where a recitation plays from — always local/verified, never a live stream. */
export type RecitationAudio =
  /** Bundled with the app, path relative to the content root (e.g. `audio/quran/112001.mp3`). */
  | { kind: 'asset'; assetPath: string }
  /** Downloaded once, sha256-verified, cached on the device (an object URL on web). */
  | { kind: 'file'; path: string };

/** Autoplay was refused (browser policy) — the lesson shows the small fallback play. */
export class PlaybackBlocked extends Error {
  override name = 'PlaybackBlocked';
}

/** The ayah's audio isn't on the device — prefetch before the lesson; never stream mid-way. */
export class RecitationNotAvailable extends Error {
  override name = 'RecitationNotAvailable';
  constructor(
    readonly ref: QuranRef,
    readonly reason?: unknown,
  ) {
    super(`RecitationNotAvailable(${ref.surah}:${ref.ayah}${reason ? `, ${String(reason)}` : ''})`);
  }
}

/** Plays the reciter (or an approved hadith recording) from local audio only. */
export interface RecitationPlayer {
  /** Rejects with PlaybackBlocked if the browser refused to autoplay. */
  start(audio: RecitationAudio): Promise<void>;
  /** Fires once each time playback reaches the end. */
  readonly completed: Subscribe<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  dispose(): Promise<void>;
}

/** The child's project report (frame 22) — the only child audio ever stored (GUARDRAILS §11). */
export interface RecordedAudio {
  readonly durationMs: number;
  /** The recording (webm/opus, or mp4 on Safari). */
  readonly blob?: Blob;
  readonly mimeType?: string;
  /** Tests / other platforms. */
  readonly path?: string;
}

export interface ProjectRecorder {
  /** Rejects with MicPermissionDenied if the mic can't be used. */
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  /** Stops and returns the recording (null if nothing usable was captured). */
  stop(): Promise<RecordedAudio | null>;
  /** Drops a recording that won't be sent (re-record / lesson left). */
  discard(audio: RecordedAudio): Promise<void>;
  /** Live level 0..1 for the waveform. */
  readonly level: Subscribe<number>;
  dispose(): Promise<void>;
}

/** Where the lesson's results go (Firestore/Storage in the app, a fake in tests). */
export interface LessonProgressSink {
  /** After every step and when the child leaves the call. */
  checkpoint(progress: LessonProgress): Promise<void>;
  /** When frame 23 is reached. */
  completed(progress: LessonProgress): Promise<void>;
  /** Uploads the project report. Rejects if it couldn't be saved. */
  saveReport(projectId: string, audio: RecordedAudio): Promise<void>;
}
