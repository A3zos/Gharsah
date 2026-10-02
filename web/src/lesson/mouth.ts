// The teacher's mouth from the sound of their voice — pure logic, no DOM (the
// browser part, web/lipSync.ts, feeds it Web Audio analyser readings).
//   silence → idle · low → mouth-small · mid → mouth-open · high → mouth-wide
//   strong low-frequency energy → now and then mouth-o
// ~12 fps with a little smoothing so the mouth doesn't jitter.

export type MouthFrame = 'idle' | 'mouth-small' | 'mouth-open' | 'mouth-wide' | 'mouth-o';

/** Frames per second of the mouth. */
export const MOUTH_FPS = 12;
export const MOUTH_FRAME_MS = Math.round(1000 / MOUTH_FPS);

/** One analyser reading: loudness 0..1 and the share of energy in the low band (≈80–400 Hz). */
export interface VoiceReading {
  readonly level: number;
  readonly lowRatio: number;
}

const SMOOTH = 0.45; // weight of the new reading
const SILENT = 0.08;
const LOW = 0.25;
const MID = 0.5;
const O_LOW_RATIO = 0.6;
const O_MIN_LEVEL = 0.2;
const O_COOLDOWN = 5; // frames before another «o»

export class MouthShaper {
  private smoothed = 0;
  private oCooldown = 0;

  reset(): void {
    this.smoothed = 0;
    this.oCooldown = 0;
  }

  next(r: VoiceReading): MouthFrame {
    const level = Math.min(1, Math.max(0, r.level));
    this.smoothed = this.smoothed * (1 - SMOOTH) + level * SMOOTH;
    if (this.oCooldown > 0) this.oCooldown--;
    const s = this.smoothed;
    if (s < SILENT) return 'idle';
    if (r.lowRatio >= O_LOW_RATIO && s >= O_MIN_LEVEL && this.oCooldown === 0) {
      this.oCooldown = O_COOLDOWN;
      return 'mouth-o';
    }
    return s < LOW ? 'mouth-small' : s < MID ? 'mouth-open' : 'mouth-wide';
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
    // a short closed beat every ~4–6 frames (between syllables)
    if (this.step % 5 === 0 || this.random() < 0.12) return 'idle';
    const r = this.random();
    return r < 0.4 ? 'mouth-small' : r < 0.8 ? 'mouth-open' : r < 0.94 ? 'mouth-wide' : 'mouth-o';
  }
}
