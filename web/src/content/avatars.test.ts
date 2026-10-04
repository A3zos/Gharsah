import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { childFromRow } from '../data/children';
import { MESSAGES } from '../i18n/i18n';
import { avatarByKey, avatarKey, avatarLabel, AVATARS, avatarSet, avatarSrc, defaultAvatar } from './avatars';

describe('child avatars', () => {
  it('three language sets of 4 boys + 4 girls', () => {
    expect(avatarSet('ar').map((a) => a.key)).toEqual([
      'boy-1',
      'boy-2',
      'boy-3',
      'boy-4',
      'girl-1',
      'girl-2',
      'girl-3',
      'girl-4',
    ]);
    expect(avatarSet('en').map((a) => a.key)).toEqual([
      'en-boy-1',
      'en-boy-2',
      'en-boy-3',
      'en-boy-4',
      'en-girl-1',
      'en-girl-2',
      'en-girl-3',
      'en-girl-4',
    ]);
    expect(avatarSet('id').map((a) => a.key)).toEqual([
      'id-boy-1',
      'id-boy-2',
      'id-boy-3',
      'id-boy-4',
      'id-girl-1',
      'id-girl-2',
      'id-girl-3',
      'id-girl-4',
    ]);
    expect(AVATARS).toHaveLength(24);
    expect(avatarByKey('id-girl-3')).toMatchObject({ gender: 'girl', set: 'id' });
  });

  it('every avatar has both files and a name in ar / en / id', () => {
    for (const a of AVATARS) {
      for (const size of [38, 104]) {
        const file = resolve(__dirname, '../../public', `.${avatarSrc(a, size)}`);
        expect(existsSync(file), avatarSrc(a, size)).toBe(true);
      }
      for (const lang of ['ar', 'en', 'id'] as const) {
        expect(
          (MESSAGES[lang].parent.avatars as Record<string, string>)[a.key],
          `${lang} ${a.key}`,
        ).toBeTruthy();
      }
    }
    expect(avatarLabel(avatarByKey('en-boy-2')!, 'en')).toBe('Red-haired boy in a white kufi');
  });

  it('the default follows the UI language (Arabic unchanged)', () => {
    expect(defaultAvatar('girl')).toBe('girl-1');
    expect(defaultAvatar('boy', 'ar')).toBe('boy-1');
    expect(defaultAvatar('boy', 'en')).toBe('en-boy-1');
    expect(defaultAvatar('girl', 'id')).toBe('id-girl-1');
  });

  it('old avatars map to the closest new one (same rule as the database)', () => {
    expect(avatarKey('g3', 'girl')).toBe('girl-3');
    expect(avatarKey('g5', 'girl')).toBe('girl-1');
    expect(avatarKey('b3', 'boy')).toBe('boy-2');
    expect(avatarKey('boy-3', 'boy')).toBe('boy-3');
  });

  it('en / id avatars are kept, always of the child gender; unknown → the first', () => {
    expect(avatarKey('en-boy-2', 'boy')).toBe('en-boy-2');
    expect(avatarKey('id-girl-4', 'girl')).toBe('id-girl-4');
    expect(avatarKey('en-girl-2', 'boy')).toBe('boy-1');
    expect(avatarKey('girl-2', 'boy')).toBe('boy-1');
    expect(avatarKey(null, 'girl')).toBe('girl-1');
    expect(avatarKey('x', 'boy')).toBe('boy-1');
  });

  it('a saved child keeps an en / id avatar (whatever the UI language)', () => {
    const row = (avatar: string, gender: 'boy' | 'girl') =>
      childFromRow({ id: 'c', name: 'A', age: 9, gender, avatar, created_at: '2026-10-04T09:00:00Z' });
    expect(row('en-boy-3', 'boy').avatarId).toBe('en-boy-3');
    expect(row('id-girl-2', 'girl').avatarId).toBe('id-girl-2');
  });

  it('the 256 px file for anything ≤ 64 px', () => {
    const a = avatarByKey('girl-2')!;
    expect(avatarSrc(a, 38)).toBe('/avatars/child-girl-2-256.webp');
    expect(avatarSrc(a, 104)).toBe('/avatars/child-girl-2.webp');
    expect(avatarSrc(avatarByKey('en-boy-1')!, 38)).toBe('/avatars/child-en-boy-1-256.webp');
  });
});
