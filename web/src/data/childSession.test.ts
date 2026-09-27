import { describe, expect, it } from 'vitest';

import { claimErrorOf } from './childSession';

describe('claimErrorOf (review notes A2)', () => {
  it('a wrong or expired code (server: not-found / wrong-code, or a malformed code)', () => {
    expect(claimErrorOf('functions/not-found', 'wrong-code', true)).toBe('wrong');
    expect(claimErrorOf('functions/invalid-argument', 'bad-code', true)).toBe('wrong');
  });
  it('the callable itself missing (not deployed) is «unavailable», not «wrong code»', () => {
    expect(claimErrorOf('functions/not-found', 'NOT_FOUND', true)).toBe('unavailable');
  });
  it('anonymous sign-in disabled, internal and unavailable → «unavailable»', () => {
    expect(claimErrorOf('auth/admin-restricted-operation', '', true)).toBe('unavailable');
    expect(claimErrorOf('functions/internal', 'INTERNAL', true)).toBe('unavailable');
    expect(claimErrorOf('functions/unavailable', '', true)).toBe('unavailable');
  });
  it('network problems → «offline»', () => {
    expect(claimErrorOf('auth/network-request-failed', '', true)).toBe('offline');
    expect(claimErrorOf('functions/internal', '', false)).toBe('offline');
  });
  it('too many attempts', () => {
    expect(claimErrorOf('functions/resource-exhausted', 'too-many-attempts', true)).toBe('tooManyAttempts');
  });
});
