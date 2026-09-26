// INTERIM AI teacher for the web — clearly temporary, replaced by the AI
// developer's module behind AiTeacher (ai/CONTRACT.md). Port of
// app/lib/features/lesson/ai/interim/device_ai_teacher.dart:
// * Voice: the browser's Arabic speech synthesis reading the approved line bank
//   (no Arabic voice → silent, paced by the caption length).
// * Listening: on-device presence detection on the shared mic. Presence only —
//   no grading; nothing is stored or uploaded.
// * Short answers: any detected speech in answer mode counts as «yes» (INTERIM,
//   as in the Dart); the design's tap fallback stays available.
import {
  MicPermissionDenied,
  type AiTeacher,
  type LessonEvent,
  type ListenMode,
  type TeacherAction,
} from '../aiTeacher';
import { Emitter } from '../observable';
import { PresenceDetector } from '../presenceDetector';
import type { TeacherLine } from '../teacherLines';
import type { LessonMicrophone } from './microphone';

const MS_PER_CHAR = 70;
const MIN_SILENT_MS = 1200;
const VOICES_WAIT_MS = 1500;

/** How long a line takes when it can't be voiced (captions still pace the lesson). */
export const estimatedSpeechMs = (text: string) => Math.max(MIN_SILENT_MS, text.length * MS_PER_CHAR);

export class SpeechTeacher implements AiTeacher {
  private readonly _actions = new Emitter<TeacherAction>();
  private readonly _level = new Emitter<number>();
  readonly actions = this._actions.subscribe;
  readonly inputLevel = this._level.subscribe;

  private mode: ListenMode | null = null;
  private stopSampling: (() => void) | null = null;
  private speaking = false;
  private finishSpeech: (() => void) | null = null;
  private volume = 1;
  private voice: Promise<SpeechSynthesisVoice | null> | null = null;
  private detector: PresenceDetector | null = null;

  constructor(
    private readonly mic: LessonMicrophone,
    private readonly synth: SpeechSynthesis | null = typeof speechSynthesis === 'undefined'
      ? null
      : speechSynthesis,
  ) {}

  onEvent(_event: LessonEvent): void {
    // Stateless between events (the real module may use them).
  }

  async speak(_line: TeacherLine, text: string): Promise<void> {
    this.finishSpeech?.();
    const voice = await this.arabicVoice();
    this.speaking = true;
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (this.finishSpeech !== done) return;
        this.finishSpeech = null;
        this.speaking = false;
        clearTimeout(timer);
        resolve();
      };
      this.finishSpeech = done;
      if (!this.synth || !voice) {
        timer = setTimeout(done, estimatedSpeechMs(text));
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      u.volume = this.volume;
      u.onend = done;
      u.onerror = done;
      // Some engines never fire `end` (Chrome drops long utterances) — never hang the lesson.
      timer = setTimeout(done, estimatedSpeechMs(text) * 2 + 3000);
      this.synth.cancel();
      this.synth.speak(u);
    });
  }

  async stopSpeaking(): Promise<void> {
    try {
      this.synth?.cancel();
    } catch {
      // nothing to stop
    }
    this.finishSpeech?.();
  }

  async listen(mode: ListenMode): Promise<void> {
    this.mode = mode;
    if (this.stopSampling) return; // already open — just switch mode
    await this.mic.open().catch(() => {
      throw new MicPermissionDenied();
    });
    const detector = new PresenceDetector({
      sampleRate: this.mic.sampleRate,
      onSpeechStart: () => this._actions.emit({ type: 'speechStarted' }),
      onUtterance: () =>
        this._actions.emit(
          this.mode === 'answer'
            ? { type: 'answerDetected', intent: 'yes' } // INTERIM: presence = answer
            : { type: 'repeatDetected' },
        ),
    });
    this.detector = detector;
    this.stopSampling = this.mic.sample((frame, rate) => {
      // Deaf while the teacher talks (the agent also waits out an echo guard).
      if (this.speaking) return;
      detector.addSamples(frame, rate);
      this._level.emit(detector.level);
    });
  }

  async stopListening(): Promise<void> {
    this.mode = null;
    this.stopSampling?.();
    this.stopSampling = null;
    this.detector?.reset();
    this.detector = null;
    this._level.emit(0);
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  async dispose(): Promise<void> {
    await this.stopListening();
    await this.stopSpeaking();
    this._actions.clear();
    this._level.clear();
  }

  /** ar-SA first, then any Arabic voice; null if the browser has none. */
  private arabicVoice(): Promise<SpeechSynthesisVoice | null> {
    const synth = this.synth;
    if (!synth) return Promise.resolve(null);
    this.voice ??= new Promise((resolve) => {
      const pick = () => {
        const voices = synth.getVoices();
        const ar = voices.filter((v) => v.lang.toLowerCase().startsWith('ar'));
        return ar.find((v) => v.lang.toLowerCase() === 'ar-sa') ?? ar[0] ?? null;
      };
      if (synth.getVoices().length) return resolve(pick());
      const timer = setTimeout(() => resolve(pick()), VOICES_WAIT_MS);
      synth.addEventListener(
        'voiceschanged',
        () => {
          clearTimeout(timer);
          resolve(pick());
        },
        { once: true },
      );
    });
    return this.voice;
  }
}
