import { describe, expect, it } from 'vitest';

import { claimErrorOf } from './childSession';

describe('claimErrorOf (review notes A2, Supabase edge function codes)', () => {
  it('a wrong, expired, used or malformed code', () => {
    expect(claimErrorOf('wrong-code', true)).toBe('wrong');
    expect(claimErrorOf('bad-code', true)).toBe('wrong');
  });
  it('the function not reachable (not deployed) / anonymous sign-ins off / internal → «unavailable»', () => {
    expect(claimErrorOf('unavailable', true)).toBe('unavailable');
    expect(claimErrorOf('internal', true)).toBe('unavailable');
    expect(claimErrorOf('unauthenticated', true)).toBe('unavailable');
  });
  it('network problems → «offline»', () => {
    expect(claimErrorOf('network', true)).toBe('offline');
    expect(claimErrorOf('internal', false)).toBe('offline');
  });
  it('too many attempts', () => {
    expect(claimErrorOf('too-many-attempts', true)).toBe('tooManyAttempts');
  });
});
