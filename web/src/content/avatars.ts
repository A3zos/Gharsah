// The child avatars (public/avatars/child-<key>.webp, transparent, head and shoulders;
// a -256 copy for anything ≤ 64 px), in three sets of 4 boys + 4 girls:
//   ar 'boy-1'…'girl-4' · en 'en-boy-1'…'en-girl-4' · id 'id-boy-1'…'id-girl-4'.
// The choice is stored as its key in children.avatar, always of the child's gender (the
// database trigger: 20261003120000_child_avatars + 20261004100000_child_avatars_per_language).
// Any of the 24 shows in every UI language — a child keeps theirs when the language changes.
// (app/lib/widgets/child_avatar.dart knows the Arabic set only.)
import type { Gender } from '../data/children';
import { MESSAGES, type UiLanguage } from '../i18n/i18n';

export type AvatarSet = UiLanguage;

export interface AvatarStyle {
  /** children.avatar */
  key: string;
  gender: Gender;
  /** The language set it belongs to (the picker shows the UI language's set first). */
  set: AvatarSet;
  /** The Arabic description (aria-label); avatarLabel() for a UI language. */
  label: string;
}

const LABELS = MESSAGES.ar.parent.avatars as Record<string, string>;

const setOf = (set: AvatarSet): AvatarStyle[] =>
  (['boy', 'girl'] as const).flatMap((gender) =>
    [1, 2, 3, 4].map((n) => {
      const key = `${set === 'ar' ? '' : `${set}-`}${gender}-${n}`;
      return { key, gender, set, label: LABELS[key]! };
    }),
  );

export const AVATAR_SETS: readonly AvatarSet[] = ['ar', 'en', 'id'];

/** All 24: the Arabic set first (its order is the old AVATARS order), then en, then id. */
export const AVATARS: readonly AvatarStyle[] = AVATAR_SETS.flatMap(setOf);

/** One language's 4 boys + 4 girls. */
export const avatarSet = (set: AvatarSet): readonly AvatarStyle[] => AVATARS.filter((a) => a.set === set);

/** The avatar's description in a UI language («فتاة بحجاب وردي» / "Girl in a pink hijab"). */
export const avatarLabel = (a: AvatarStyle, lang: UiLanguage = 'ar'): string =>
  (MESSAGES[lang].parent.avatars as Record<string, string>)[a.key] ?? a.label;

/** The first avatar of a gender in the UI language's set (a new child, a gender change). */
export const defaultAvatar = (g: Gender, set: AvatarSet = 'ar') => `${set === 'ar' ? '' : `${set}-`}${g}-1`;

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
