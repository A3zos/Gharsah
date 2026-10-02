import { describe, expect, it } from 'vitest';
import { avatarKey, avatarsFor, avatarSrc } from './avatars';

describe('child avatars', () => {
  it('four per gender', () => {
    expect(avatarsFor('boy').map((a) => a.key)).toEqual(['boy-1', 'boy-2', 'boy-3', 'boy-4']);
    expect(avatarsFor('girl').map((a) => a.key)).toEqual(['girl-1', 'girl-2', 'girl-3', 'girl-4']);
  });

  it('old avatars map to the closest new one (same rule as the database)', () => {
    expect(avatarKey('g3', 'girl')).toBe('girl-3');
    expect(avatarKey('g5', 'girl')).toBe('girl-1');
    expect(avatarKey('b3', 'boy')).toBe('boy-2');
    expect(avatarKey('boy-3', 'boy')).toBe('boy-3');
  });

  it('always of the child gender; unknown → the first', () => {
    expect(avatarKey('girl-2', 'boy')).toBe('boy-1');
    expect(avatarKey(null, 'girl')).toBe('girl-1');
    expect(avatarKey('x', 'boy')).toBe('boy-1');
  });

  it('the 256 px file for anything ≤ 64 px', () => {
    const a = avatarsFor('girl')[1]!;
    expect(avatarSrc(a, 38)).toBe('/avatars/child-girl-2-256.webp');
    expect(avatarSrc(a, 104)).toBe('/avatars/child-girl-2.webp');
  });
});
