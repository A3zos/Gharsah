// Test doubles for the lesson agent — port of app/test/lesson/fakes.dart.
import hadithJson from '@content/hadith/hadith.json';
import ikhlas from '@content/lessons/m01-w03-ikhlas.json';
import day2 from '@content/lessons/m01-w03-day2.json';
import projectsJson from '@content/projects/projects.json';
import manifestJson from '@content/audio/quran/manifest.json';
import metaJson from '@content/quran/quran_meta.json';
import textJson from '@content/quran/quran_text.json';

import { LessonAgent, type LessonContent } from '../agent';
import {
  MicPermissionDenied,
  type AiTeacher,
  type LessonEvent,
  type ListenMode,
  type TeacherAction,
} from '../aiTeacher';
import { MemoryAudioCacheStore, QuranAudioRepository, RecitationManifest } from '../audioRepository';
import { HadithRepository } from '../hadith';
import { Emitter } from '../observable';
import {
  PlaybackBlocked,
  type LessonProgressSink,
  type ProjectRecorder,
  type RecitationAudio,
  type RecitationPlayer,
  type RecordedAudio,
} from '../ports';
import { ProjectRepository } from '../projects';
import { QuranMeta, QuranText } from '../quran';
import { parseLessonScript, type LessonScript } from '../script';
import type { LessonProgress, LessonState } from '../state';
import type { TeacherLine } from '../teacherLines';

export const SPEAK_MS = 1000;

export class FakeTeacher implements AiTeacher {
  readonly events: LessonEvent[] = [];
  readonly spoken: string[] = [];
  private readonly _actions = new Emitter<TeacherAction>();
  private readonly _level = new Emitter<number>();
  private speakingDone: (() => void) | undefined;
  listeningMode: ListenMode | null = null;
  denyMic = false;
  stopSpeakingCalls = 0;

  get isListening() {
    return this.listeningMode !== null;
  }
  get isSpeaking() {
    return this.speakingDone !== undefined;
  }

  emit(a: TeacherAction) {
    this._actions.emit(a);
  }

  /** The child says one repeat (speech then silence). */
  childRepeats() {
    this.emit({ type: 'speechStarted' });
    this.emit({ type: 'repeatDetected' });
  }

  onEvent(event: LessonEvent) {
    this.events.push(event);
  }
  readonly actions = this._actions.subscribe;
  readonly inputLevel = this._level.subscribe;

  speak(l: TeacherLine): Promise<void> {
    this.spoken.push(l.id);
    return new Promise<void>((resolve) => {
      const done = () => {
        if (this.speakingDone === done) this.speakingDone = undefined;
        resolve();
      };
      this.speakingDone = done;
      setTimeout(done, SPEAK_MS);
    });
  }
  async stopSpeaking() {
    this.stopSpeakingCalls++;
    this.speakingDone?.();
  }
  async listen(mode: ListenMode) {
    if (this.denyMic) throw new MicPermissionDenied();
    this.listeningMode = mode;
  }
  async stopListening() {
    this.listeningMode = null;
  }
  async setVolume() {}
  async dispose() {}
}

export class FakePlayer implements RecitationPlayer {
  readonly started: RecitationAudio[] = [];
  private readonly done = new Emitter<void>();
  blockAutoplay = false;
  playing = false;
  paused = false;
  volume = 1;

  get lastAsset(): string | null {
    const a = this.started.at(-1);
    return a?.kind === 'asset' ? a.assetPath : null;
  }

  /** The reciter reaches the end of the ayah. */
  finish() {
    if (!this.playing || this.paused) return;
    this.playing = false;
    this.done.emit();
  }

  async start(audio: RecitationAudio) {
    if (this.blockAutoplay) throw new PlaybackBlocked();
    this.started.push(audio);
    this.playing = true;
    this.paused = false;
  }
  readonly completed = this.done.subscribe;
  async pause() {
    this.paused = true;
  }
  async resume() {
    this.paused = false;
  }
  async stop() {
    this.playing = false;
    this.paused = false;
  }
  async setVolume(v: number) {
    this.volume = v;
  }
  async dispose() {}
}

export class FakeRecorder implements ProjectRecorder {
  readonly discarded: RecordedAudio[] = [];
  private readonly _level = new Emitter<number>();
  recording = false;
  paused = false;
  denyMic = false;
  takes = 0;

  async start() {
    if (this.denyMic) throw new MicPermissionDenied();
    this.recording = true;
    this.paused = false;
  }
  async pause() {
    this.paused = true;
  }
  async resume() {
    this.paused = false;
  }
  async stop(): Promise<RecordedAudio | null> {
    if (!this.recording) return null;
    this.recording = false;
    this.takes++;
    return { durationMs: (10 + this.takes) * 1000, path: `/tmp/take${this.takes}.m4a` };
  }
  async discard(audio: RecordedAudio) {
    this.discarded.push(audio);
  }
  readonly level = this._level.subscribe;
  async dispose() {}
}

export class FakeSink implements LessonProgressSink {
  readonly checkpoints: LessonProgress[] = [];
  readonly completedCalls: LessonProgress[] = [];
  readonly reports: [string, RecordedAudio][] = [];
  failSave = false;

  async checkpoint(p: LessonProgress) {
    this.checkpoints.push(p);
  }
  async completed(p: LessonProgress) {
    this.completedCalls.push(p);
  }
  async saveReport(projectId: string, audio: RecordedAudio) {
    if (this.failSave) throw new Error('offline');
    this.reports.push([projectId, audio]);
  }
}

/** Node's sha256 for tests (the browser uses crypto.subtle). */
export async function nodeSha256(bytes: Uint8Array): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

export const realMeta = () => QuranMeta.fromJson(metaJson);
export const realManifest = () => RecitationManifest.fromJson(manifestJson);

export function realContent(o: { hadith?: HadithRepository } = {}): LessonContent {
  const meta = realMeta();
  return {
    meta,
    text: QuranText.fromJson(textJson),
    audio: new QuranAudioRepository({
      meta,
      manifest: realManifest(),
      cache: new MemoryAudioCacheStore(),
      fetch: async () => {
        throw new Error('offline');
      },
      sha256: nodeSha256,
    }),
    hadith: o.hadith ?? HadithRepository.fromJson(hadithJson),
    projects: ProjectRepository.fromJson(projectsJson),
  };
}

export const SCRIPTS: Record<string, Record<string, unknown>> = {
  'm01-w03-ikhlas': ikhlas,
  'm01-w03-day2': day2,
};

export const loadScript = (id: string): LessonScript => parseLessonScript(SCRIPTS[id]!);

/** Everything a test needs, wired together. */
export class Rig {
  readonly teacher = new FakeTeacher();
  readonly player = new FakePlayer();
  readonly recorder = new FakeRecorder();
  readonly sink = new FakeSink();
  readonly agent: LessonAgent;

  constructor(
    o: {
      lessonId?: string;
      content?: LessonContent;
      now?: Date;
      debugTap?: boolean;
      script?: LessonScript;
    } = {},
  ) {
    this.agent = new LessonAgent({
      script: o.script ?? loadScript(o.lessonId ?? 'm01-w03-ikhlas'),
      content: o.content ?? realContent(),
      teacher: this.teacher,
      player: this.player,
      recorder: this.recorder,
      sink: this.sink,
      childFirstName: 'سارة',
      now: () => o.now ?? new Date(2026, 8, 24, 18),
      debugTapCountsRepeat: o.debugTap ?? false,
      log: () => {},
    });
  }

  get s(): LessonState {
    return this.agent.state.value;
  }
}
