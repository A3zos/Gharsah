// The child avatars (public/avatars/child-{boy,girl}-{1..4}.webp, transparent, head and
// shoulders; a -256 copy for anything ≤ 64 px). Four per gender; the choice is stored as
// its key in children.avatar ('boy-3', 'girl-1' …). Same keys as app/lib/widgets/child_avatar.dart
// and the database trigger (20261003120000_child_avatars.sql).
import type { Gender } from '../data/children';

export interface AvatarStyle {
  /** children.avatar */
  key: string;
  gender: Gender;
  label: string;
}

export const AVATARS: readonly AvatarStyle[] = [
  { key: 'boy-1', gender: 'boy', label: 'فتى بغترة بيضاء' },
  { key: 'boy-2', gender: 'boy', label: 'فتى بطاقية' },
  { key: 'boy-3', gender: 'boy', label: 'فتى بنظارة' },
  { key: 'boy-4', gender: 'boy', label: 'فتى بشماغ أحمر' },
  { key: 'girl-1', gender: 'girl', label: 'فتاة بحجاب وردي' },
  { key: 'girl-2', gender: 'girl', label: 'فتاة بحجاب أزرق ونظارة' },
  { key: 'girl-3', gender: 'girl', label: 'فتاة بحجاب نعناعي ونظارة' },
  { key: 'girl-4', gender: 'girl', label: 'فتاة بحجاب خردلي' },
];

/** The four choices of one gender («شخصية الابن»). */
export const avatarsFor = (g: Gender) => AVATARS.filter((a) => a.gender === g);

export const defaultAvatar = (g: Gender) => `${g}-1`;

// The old drawn avatars (before 20261003120000_child_avatars) → the closest new one.
const LEGACY: Record<string, string> = {
  g1: 'girl-1',
  g2: 'girl-2',
  g3: 'girl-3',
  g4: 'girl-4',
  g5: 'girl-1',
  b1: 'boy-1',
  b2: 'boy-4',
  b3: 'boy-2',
  b4: 'boy-3',
};

/** A stored value → a key of the child's gender (same rule as the database trigger). */
export function avatarKey(stored: string | null | undefined, g: Gender): string {
  const k = stored ? (LEGACY[stored] ?? stored) : '';
  return AVATARS.some((a) => a.key === k && a.gender === g) ? k : defaultAvatar(g);
}

export const avatarByKey = (k: string): AvatarStyle | null =>
  AVATARS.find((a) => a.key === (LEGACY[k] ?? k)) ?? null;

/** The image of a key; the -256 copy for anything ≤ 64 px. */
export const avatarSrc = (a: AvatarStyle, size: number) =>
  `/avatars/child-${a.key}${size <= 64 ? '-256' : ''}.webp`;
