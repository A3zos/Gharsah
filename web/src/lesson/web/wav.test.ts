import { describe, expect, it } from 'vitest';

import { concat, downsample, encodeWav, REPORT_SAMPLE_RATE } from './wav';

describe('wav', () => {
  it('downsamples 48 kHz to 12 kHz by averaging', () => {
    const input = new Float32Array([0, 0.4, 0.4, 0.4, 1, 1, 1, 1]);
    const out = downsample(input, 48000);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0.3);
    expect(out[1]).toBeCloseTo(1);
  });

  it('keeps audio that is already at or below the target rate', () => {
    const input = new Float32Array([0.1, 0.2]);
    expect(Array.from(downsample(input, 8000))).toEqual(Array.from(input));
  });

  it('concatenates chunks in order', () => {
    expect(Array.from(concat([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3]);
  });

  it('writes a 16-bit mono PCM header and clamped samples', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]));
    const v = new DataView(wav.buffer);
    const text = (at: number, n: number) => String.fromCharCode(...wav.slice(at, at + n));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(v.getUint32(4, true)).toBe(36 + 8);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(REPORT_SAMPLE_RATE);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });

  it('keeps three minutes under the 5 MB Storage limit', () => {
    expect(44 + 3 * 60 * REPORT_SAMPLE_RATE * 2).toBeLessThan(5 * 1024 * 1024);
  });
});
