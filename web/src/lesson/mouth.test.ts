import { describe, expect, it } from 'vitest';

import { levelOf, lowRatioOf, MOUTH_FPS, MOUTH_FRAME_MS, MouthShaper, SyllableMouth } from './mouth';

const run = (m: MouthShaper, levels: number[], lowRatio = 0.2) =>
  levels.map((level) => m.next({ level, lowRatio }));

describe('MouthShaper', () => {
  it('~8 fps: every frame is held at least 110 ms', () => {
    expect(MOUTH_FPS).toBe(8);
    expect(MOUTH_FRAME_MS).toBeGreaterThanOrEqual(110);
  });

  it('silence is closed', () => {
    expect(run(new MouthShaper(), [0, 0, 0])).toEqual(['idle', 'idle', 'idle']);
  });

  it('pauses between words close at once, even right after loud speech (adaptive threshold)', () => {
    const m = new MouthShaper();
    run(m, [0.6, 0.6, 0.6, 0.6]);
    // 0.1 is quiet for THIS line (peak 0.6) → a pause
    expect(m.next({ level: 0.1, lowRatio: 0.2 })).toBe('idle');
    expect(m.next({ level: 0, lowRatio: 0.2 })).toBe('idle');
  });

  it('a quiet line still moves the mouth (the threshold follows the line, not a fixed level)', () => {
    const m = new MouthShaper();
    const frames = run(m, Array(8).fill(0.09));
    expect(frames.slice(-3).every((f) => f !== 'idle')).toBe(true);
  });

  it('mostly small/open; mouth-wide only on real peaks', () => {
    const m = new MouthShaper();
    const speech = [0.3, 0.35, 0.32, 0.4, 0.33, 0.3, 0.36, 0.34, 0.31, 0.38];
    const frames = run(m, speech);
    expect(frames.filter((f) => f === 'mouth-wide').length).toBeLessThanOrEqual(2);
    expect(frames.filter((f) => f === 'mouth-small' || f === 'mouth-open').length).toBeGreaterThanOrEqual(7);
    // a real peak, well above the line's usual loudness
    const peak = run(m, [0.9, 0.9, 0.9]);
    expect(peak).toContain('mouth-wide');
  });

  it('fast attack, slow release', () => {
    const m = new MouthShaper();
    run(m, [0.5, 0.5, 0.5, 0.5, 0.5]);
    // one frame after the voice drops a little, still open (the release eases off)
    expect(m.next({ level: 0.3, lowRatio: 0.2 })).not.toBe('idle');
    const fresh = new MouthShaper();
    // from closed, the first loud frame already opens (attack)
    expect(fresh.next({ level: 0.5, lowRatio: 0.2 })).not.toBe('idle');
  });

  it('strong low-frequency energy → mouth-o now and then (cooldown), never two in a row', () => {
    const m = new MouthShaper();
    run(m, [0.4, 0.4, 0.4]);
    const frames = run(m, Array(14).fill(0.4), 0.8);
    const os = frames.filter((f) => f === 'mouth-o').length;
    expect(os).toBeGreaterThanOrEqual(1);
    expect(os).toBeLessThanOrEqual(3);
    expect(frames.some((f, i) => f === 'mouth-o' && frames[i + 1] === 'mouth-o')).toBe(false);
  });

  it('reset closes the mouth', () => {
    const m = new MouthShaper();
    run(m, [0.8, 0.8]);
    m.reset();
    expect(m.next({ level: 0, lowRatio: 0 })).toBe('idle');
  });
});

describe('readings', () => {
  it('levelOf: silence 0, a full-scale tone 1', () => {
    expect(levelOf(new Float32Array(256))).toBe(0);
    expect(levelOf(Float32Array.from({ length: 256 }, (_, i) => Math.sin(i / 3)))).toBe(1);
  });

  it('lowRatioOf: energy in 80–400 Hz over 80–4000 Hz', () => {
    const rate = 48000;
    const fft = 1024; // 46.9 Hz per bin
    const low = new Uint8Array(512);
    low[4] = 200; // ~188 Hz
    expect(lowRatioOf(low, rate, fft)).toBe(1);
    const high = new Uint8Array(512);
    high[40] = 200; // ~1875 Hz
    expect(lowRatioOf(high, rate, fft)).toBe(0);
    expect(lowRatioOf(new Uint8Array(512), rate, fft)).toBe(0);
  });
});

describe('SyllableMouth (the browser voice cannot be analysed)', () => {
  it('moves the mouth with closed beats between syllables, rarely wide', () => {
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const s = new SyllableMouth(rnd);
    const frames = Array.from({ length: 80 }, () => s.next());
    expect(frames.filter((f) => f === 'idle').length).toBeGreaterThan(15);
    expect(frames.filter((f) => f === 'mouth-wide').length).toBeLessThan(10);
  });
});
