// The project report (frame 22) — the only child audio that is ever stored
// (GUARDRAILS §11). Raw PCM from the shared lesson mic → 12 kHz mono 16-bit WAV
// (the Storage rule accepts .wav/audio/wav from web builds, ≤ 5 MB).
import { MicPermissionDenied } from '../aiTeacher';
import { Emitter } from '../observable';
import type { ProjectRecorder, RecordedAudio } from '../ports';
import { levelOf, type LessonMicrophone } from './microphone';
import { concat, downsample, encodeWav, REPORT_SAMPLE_RATE } from './wav';

const MIN_MS = 1000;
/** Matches the agent's maxRecordingMs and the submissions rule (≤ 180000). */
const MAX_MS = 180_000;

export class WavProjectRecorder implements ProjectRecorder {
  private readonly _level = new Emitter<number>();
  readonly level = this._level.subscribe;

  private chunks: Float32Array[] = [];
  private samples = 0;
  private rate = 48000;
  private stopTap: (() => void) | null = null;
  private paused = false;

  constructor(private readonly mic: LessonMicrophone) {}

  async start(): Promise<void> {
    this.stopTap?.();
    this.chunks = [];
    this.samples = 0;
    this.paused = false;
    await this.mic.open().catch(() => {
      throw new MicPermissionDenied();
    });
    this.rate = this.mic.sampleRate;
    this.stopTap = this.mic.tap((chunk, rate) => {
      if (this.paused) return;
      this.rate = rate;
      if (((this.samples + chunk.length) / rate) * 1000 > MAX_MS) return;
      this.chunks.push(chunk);
      this.samples += chunk.length;
      this._level.emit(levelOf(chunk));
    });
  }

  async pause(): Promise<void> {
    this.paused = true;
    this._level.emit(0);
  }

  async resume(): Promise<void> {
    this.paused = false;
  }

  async stop(): Promise<RecordedAudio | null> {
    if (!this.stopTap) return null;
    this.stopTap();
    this.stopTap = null;
    this._level.emit(0);
    const durationMs = Math.round((this.samples / this.rate) * 1000);
    const pcm = concat(this.chunks);
    this.chunks = [];
    this.samples = 0;
    if (durationMs < MIN_MS) return null;
    const wav = encodeWav(downsample(pcm, this.rate), REPORT_SAMPLE_RATE);
    return {
      durationMs,
      blob: new Blob([wav.buffer as ArrayBuffer], { type: 'audio/wav' }),
      mimeType: 'audio/wav',
    };
  }

  async discard(_audio: RecordedAudio): Promise<void> {
    // In memory only — dropping the reference is enough.
  }

  async dispose(): Promise<void> {
    this.stopTap?.();
    this.stopTap = null;
    this.chunks = [];
    this._level.clear();
  }
}
