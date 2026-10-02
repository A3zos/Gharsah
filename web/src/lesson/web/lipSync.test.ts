import { afterEach, describe, expect, it, vi } from 'vitest';

import { LipSync } from './lipSync';

/** A tiny fake AudioContext: records routing, returns the readings we choose. */
function fakeContext(state: 'running' | 'suspended', level = 0.5) {
  const routed: unknown[] = [];
  const analyser = {
    fftSize: 1024,
    frequencyBinCount: 512,
    smoothingTimeConstant: 0,
    context: undefined as unknown,
    connect: vi.fn(),
    getFloatTimeDomainData: (a: Float32Array) => a.fill(level),
    getByteFrequencyData: (a: Uint8Array) => a.fill(0),
  };
  const ctx = {
    state,
    sampleRate: 48000,
    destination: {},
    resume: vi.fn(async () => {}),
    createAnalyser: () => analyser,
    createMediaElementSource: (el: unknown) => {
      routed.push(el);
      return { connect: vi.fn() };
    },
  };
  analyser.context = ctx;
  return { ctx: ctx as unknown as AudioContext, routed };
}

afterEach(() => vi.useRealTimers());

describe('LipSync', () => {
  it('a running context: the playing <audio> is analysed and moves the mouth', () => {
    vi.useFakeTimers();
    const { ctx, routed } = fakeContext('running', 0.5);
    const lip = new LipSync(() => ctx);
    const el = {} as HTMLMediaElement;
    lip.begin(el);
    vi.advanceTimersByTime(83 * 12);
    expect(routed).toEqual([el]);
    expect(lip.frame.value).toBe('mouth-wide');
    lip.end();
    expect(lip.frame.value).toBe('idle');
    // the same element is routed only once
    lip.begin(el);
    expect(routed).toHaveLength(1);
  });

  it('a suspended context: never routed (it would go silent) — syllable rhythm instead', () => {
    vi.useFakeTimers();
    const { ctx, routed } = fakeContext('suspended');
    const lip = new LipSync(() => ctx);
    lip.begin({} as HTMLMediaElement);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      vi.advanceTimersByTime(83);
      seen.add(lip.frame.value);
    }
    expect(routed).toEqual([]);
    expect(seen.size).toBeGreaterThan(1); // still talks
  });

  it('the browser voice (no element): syllable rhythm; end() closes the mouth', () => {
    vi.useFakeTimers();
    const lip = new LipSync(() => null);
    lip.begin(null);
    vi.advanceTimersByTime(83 * 20);
    lip.end();
    vi.advanceTimersByTime(83 * 5);
    expect(lip.frame.value).toBe('idle');
  });
});
