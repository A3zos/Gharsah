// One shared microphone for the lesson: opened once (the design's mic "opens
// once and stays open"). Presence detection only measures levels through an
// AnalyserNode; the project report (recorder.ts) taps raw PCM from the same
// stream — the only child audio that is ever kept.
import { MicPermissionDenied } from '../aiTeacher';

export class LessonMicrophone {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private opening: Promise<MediaStream> | null = null;

  get isOpen(): boolean {
    return this.stream !== null;
  }

  /** Rejects with MicPermissionDenied if the browser/user refuses or there is no mic. */
  open(): Promise<MediaStream> {
    if (this.stream) return Promise.resolve(this.stream);
    this.opening ??= (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new MicPermissionDenied();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
      } catch {
        throw new MicPermissionDenied();
      } finally {
        this.opening = null;
      }
      this.stream = stream;
      this.ctx = new AudioContext();
      this.source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.source.connect(this.analyser); // not connected to the speakers
      return stream;
    })();
    return this.opening;
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  /** Samples every `ms` and hands the latest frame to `onFrame` until the returned stop is called. */
  sample(onFrame: (frame: Float32Array, sampleRate: number) => void, ms = 50): () => void {
    const analyser = this.analyser;
    const ctx = this.ctx;
    if (!analyser || !ctx) return () => {};
    void ctx.resume().catch(() => {});
    const buf = new Float32Array(analyser.fftSize);
    // Each tick measures `ms` of audio: take that many of the newest samples.
    const span = Math.min(buf.length, Math.round((ctx.sampleRate * ms) / 1000));
    const id = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      onFrame(buf.subarray(buf.length - span), ctx.sampleRate);
    }, ms);
    return () => clearInterval(id);
  }

  /**
   * Every PCM block (mono float, the context's rate) until the returned stop.
   * ScriptProcessorNode: deprecated but available everywhere, and it needs no
   * separate worklet module. Its output is silent (gain 0) — never played back.
   */
  tap(onChunk: (chunk: Float32Array, sampleRate: number) => void): () => void {
    const ctx = this.ctx;
    const source = this.source;
    if (!ctx || !source) return () => {};
    void ctx.resume().catch(() => {});
    const node = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    node.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate);
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    return () => {
      node.onaudioprocess = null;
      try {
        source.disconnect(node);
      } catch {
        // already disconnected (mic closed)
      }
      node.disconnect();
      mute.disconnect();
    };
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.source = null;
    this.analyser = null;
  }
}

/** 0..1 for the voice bars — same scale as PresenceDetector.level. */
export function levelOf(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  const rms = samples.length ? Math.sqrt(sum / samples.length) : 0;
  const db = rms <= 1e-9 ? -100 : 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 60) / 50));
}
