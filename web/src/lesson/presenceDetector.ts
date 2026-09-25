// INTERIM — replaced by the AI developer's VAD (ai/CONTRACT.md §1).
// Port of app/lib/features/lesson/ai/interim/presence_detector.dart.
//
// On-device speech-*presence* detection: "the child spoke, then stopped" = one
// utterance. It never judges pronunciation, and the audio is only measured, never
// stored or sent anywhere. Energy-based with an adaptive noise floor; time is
// derived from the sample count, so it's deterministic in tests.

export interface PresenceOptions {
  onSpeechStart: () => void;
  /** voicedMs = how long the child actually spoke in this utterance. */
  onUtterance: (voicedMs: number) => void;
  sampleRate?: number;
  /** Speech must be this far above the noise floor… */
  marginDb?: number;
  /** …and above this absolute level (quiet rooms). */
  minSpeechDb?: number;
  /** Voiced time needed before speech "starts" (ignores clicks). */
  onsetMs?: number;
  /** Silence that ends an utterance. */
  hangoverMs?: number;
  /** Shorter utterances (a cough, a tap) are ignored. */
  minUtteranceMs?: number;
  /** The first moments of each listening window only measure the room. */
  calibrationMs?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class PresenceDetector {
  readonly sampleRate: number;
  private readonly o: Required<PresenceOptions>;
  // Microsecond counters, as in the Dart original.
  private floor = -60;
  private calibratedUs = 0;
  private calibrationMin = 0;
  private voicedUs = 0;
  private silenceUs = 0;
  private inSpeech = false;
  private _level = 0;

  constructor(options: PresenceOptions) {
    this.o = {
      sampleRate: 16000,
      marginDb: 12,
      minSpeechDb: -50,
      onsetMs: 150,
      hangoverMs: 700,
      minUtteranceMs: 350,
      calibrationMs: 250,
      ...options,
    };
    this.sampleRate = this.o.sampleRate;
  }

  /** 0..1 for the voice bars. */
  get level(): number {
    return this._level;
  }

  reset(): void {
    this.calibratedUs = 0;
    this.voicedUs = 0;
    this.silenceUs = 0;
    this.inSpeech = false;
    this._level = 0;
  }

  /** Feeds one chunk of float samples (-1..1), e.g. from an AudioWorklet / AnalyserNode. */
  addSamples(samples: Float32Array, sampleRate = this.sampleRate): void {
    const n = samples.length;
    if (n === 0) return;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += samples[i]! * samples[i]!;
    const rms = Math.sqrt(sum / n);
    const db = rms <= 1e-9 ? -100 : 20 * Math.log10(rms);
    this.addLevel(db, (n * 1000) / sampleRate);
  }

  /** Feeds one chunk of PCM16 little-endian mono samples. */
  addPcm16(pcm: Uint8Array): void {
    const n = Math.floor(pcm.byteLength / 2);
    if (n === 0) return;
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = view.getInt16(i * 2, true) / 32768;
    this.addSamples(f);
  }

  /** Feeds one measured level (dBFS) covering spanMs of audio. */
  addLevel(db: number, spanMs: number): void {
    const us = Math.round(spanMs * 1000);
    const { marginDb, minSpeechDb } = this.o;
    this._level = clamp((db + 60) / 50, 0, 1);
    const calibrationUs = this.o.calibrationMs * 1000;
    if (this.calibratedUs < calibrationUs) {
      this.calibrationMin = this.calibratedUs === 0 ? db : Math.min(this.calibrationMin, db);
      this.calibratedUs += us;
      if (this.calibratedUs >= calibrationUs) this.floor = clamp(this.calibrationMin, -90, -25);
      return;
    }
    const threshold = Math.max(this.floor + marginDb, minSpeechDb);
    const voiced = db > threshold;
    // Noise floor: drops fast, rises slowly (and not while the child speaks).
    if (db < this.floor) this.floor += (db - this.floor) * 0.5;
    else if (!voiced) this.floor += (db - this.floor) * 0.02;
    this.floor = clamp(this.floor, -90, -25);

    if (voiced) {
      this.voicedUs += us;
      this.silenceUs = 0;
      if (!this.inSpeech && this.voicedUs >= this.o.onsetMs * 1000) {
        this.inSpeech = true;
        this.o.onSpeechStart();
      }
      return;
    }
    if (!this.inSpeech) {
      // Decay stray voiced blips that never reached the onset.
      this.voicedUs = Math.max(0, this.voicedUs - us);
      return;
    }
    this.silenceUs += us;
    if (this.silenceUs >= this.o.hangoverMs * 1000) {
      const voicedMs = this.voicedUs / 1000;
      this.inSpeech = false;
      this.voicedUs = 0;
      this.silenceUs = 0;
      if (voicedMs >= this.o.minUtteranceMs) this.o.onUtterance(voicedMs);
    }
  }
}
