import { describe, expect, it } from 'vitest';

import { levelOf, lowRatioOf, MOUTH_FPS, MOUTH_FRAME_MS, MouthShaper, SyllableMouth } from './mouth';

/** Feeds the same reading until the smoothing settles. */
const settle = (m: MouthShaper, level: number, lowRatio = 0.2) => {
  let f = m.next({ level, lowRatio });
  for (let i = 0; i < 12; i++) f = m.next({ level, lowRatio });
  return f;
};

describe('MouthShaper', () => {
  it('~12 fps', () => {
    expect(MOUTH_FPS).toBe(12);
    expect(MOUTH_FRAME_MS).toBe(83);
  });

  it.each([
    [0, 'idle'],
    [0.05, 'idle'],
    [0.15, 'mouth-small'],
    [0.35, 'mouth-open'],
    [0.8, 'mouth-wide'],
  ] as const)('level %s → %s', (level, want) => {
    expect(settle(new MouthShaper(), level)).toBe(want);
  });

  it('smooths: one loud spike from silence does not open wide', () => {
    const m = new MouthShaper();
    settle(m, 0);
    expect(m.next({ level: 1, lowRatio: 0.1 })).not.toBe('mouth-wide');
  });

  it('strong low-frequency energy → mouth-o now and then (cooldown), never every frame', () => {
    const m = new MouthShaper();
    settle(m, 0.4, 0.1);
    const frames = Array.from({ length: 12 }, () => m.next({ level: 0.4, lowRatio: 0.8 }));
    const os = frames.filter((f) => f === 'mouth-o').length;
    expect(os).toBeGreaterThanOrEqual(1);
    expect(os).toBeLessThanOrEqual(3);
    expect(frames.some((f, i) => f === 'mouth-o' && frames[i + 1] === 'mouth-o')).toBe(false);
  });

  it('reset closes the mouth', () => {
    const m = new MouthShaper();
    settle(m, 0.8);
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
  it('moves the mouth with short closed beats', () => {
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const s = new SyllableMouth(rnd);
    const frames = Array.from({ length: 60 }, () => s.next());
    expect(frames.filter((f) => f === 'idle').length).toBeGreaterThan(5);
    expect(new Set(frames).size).toBeGreaterThanOrEqual(4);
  });
});
