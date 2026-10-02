// The teacher's mouth from the sound of their voice — pure logic, no DOM (the
// browser part, web/lipSync.ts, feeds it Web Audio analyser readings).
//   silence → idle · low → mouth-small · mid → mouth-open · high → mouth-wide
//   strong low-frequency energy → now and then mouth-o
// ~8 fps, fast attack / slow release, closed in pauses (a threshold from the line's
// own loudness), mouth-wide only on real peaks.

export type MouthFrame = 'idle' | 'mouth-small' | 'mouth-open' | 'mouth-wide' | 'mouth-o';

/** ~8 fps: each mouth frame is held ≥110 ms (125 ms) — slower reads as real speech. */
export const MOUTH_FPS = 8;
export const MOUTH_FRAME_MS = Math.round(1000 / MOUTH_FPS);

/** One analyser reading: loudness 0..1 and the share of energy in the low band (≈80–400 Hz). */
export interface VoiceReading {
  readonly level: number;
  readonly lowRatio: number;
}

const ATTACK = 0.65; // opening follows the voice fast…
const RELEASE = 0.25; // …closing eases off
const PEAK_DECAY = 0.985; // the line's own loudness, remembered for a few seconds
const PEAK_FLOOR = 0.12;
const SILENCE_SHARE = 0.22; // below 22% of the line's peak = a pause → closed
const SILENCE_MIN = 0.04;
const WIDE_SHARE = 0.85; // mouth-wide only on real peaks…
const WIDE_MIN = 0.45;
const OPEN_SHARE = 0.5;
const O_LOW_RATIO = 0.6;
const O_SHARE = 0.4;
const O_COOLDOWN = 6; // frames before another «o»

export class MouthShaper {
  private smoothed = 0;
  private peak = PEAK_FLOOR;
  private oCooldown = 0;

  reset(): void {
    this.smoothed = 0;
    this.peak = PEAK_FLOOR;
    this.oCooldown = 0;
  }

  next(r: VoiceReading): MouthFrame {
    const level = Math.min(1, Math.max(0, r.level));
    const k = level > this.smoothed ? ATTACK : RELEASE;
    this.smoothed += (level - this.smoothed) * k;
    this.peak = Math.max(level, this.peak * PEAK_DECAY, PEAK_FLOOR);
    if (this.oCooldown > 0) this.oCooldown--;
    // Pauses between words and sentences: the raw level drops under the line's own
    // threshold → closed at once (the smoothing must not keep it open).
    const silence = Math.max(SILENCE_MIN, this.peak * SILENCE_SHARE);
    if (level < silence) return 'idle';
    const rel = this.smoothed / this.peak;
    if (r.lowRatio >= O_LOW_RATIO && rel >= O_SHARE && this.oCooldown === 0) {
      this.oCooldown = O_COOLDOWN;
      return 'mouth-o';
    }
    if (rel >= WIDE_SHARE && this.smoothed >= WIDE_MIN) return 'mouth-wide';
    return rel >= OPEN_SHARE ? 'mouth-open' : 'mouth-small';
  }
}

/** Loudness 0..1 from time-domain samples (−1..1): RMS, scaled so speech fills the range. */
export function levelOf(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  const rms = samples.length ? Math.sqrt(sum / samples.length) : 0;
  return Math.min(1, rms * 4);
}

/** Share of the spectrum's energy in the low band (byte magnitudes from getByteFrequencyData). */
export function lowRatioOf(freq: ArrayLike<number>, sampleRate: number, fftSize: number): number {
  const hz = sampleRate / fftSize;
  let low = 0;
  let all = 0;
  for (let i = 0; i < freq.length; i++) {
    const f = i * hz;
    if (f < 80 || f > 4000) continue;
    const e = freq[i]! * freq[i]!;
    all += e;
    if (f <= 400) low += e;
  }
  return all > 0 ? low / all : 0;
}

/**
 * When the voice can't be analysed (the browser's speechSynthesis plays outside the
 * page, so no web page can read it): a natural syllable rhythm while it speaks.
 */
export class SyllableMouth {
  private step = 0;

  constructor(private readonly random: () => number = Math.random) {}

  next(): MouthFrame {
    this.step++;
    // a closed beat between syllables (every ~3–4 frames at 8 fps)
    if (this.step % 4 === 0 || this.random() < 0.15) return 'idle';
    const r = this.random();
    return r < 0.45 ? 'mouth-small' : r < 0.88 ? 'mouth-open' : r < 0.96 ? 'mouth-wide' : 'mouth-o';
  }
}
