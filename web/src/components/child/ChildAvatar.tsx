// The nine modest avatars of design/v2 AvatarPicker (g1–g5 girls, b1–b4 boys) —
// same ids/colors as app/lib/widgets/app_icons.dart (stored in children/{id}.avatar).
import { C, type ColorName } from '../ui/color';

export interface AvatarStyle {
  id: string;
  girl: boolean;
  label: string;
  cloth: ColorName;
  skin: ColorName;
}

export const AVATARS: readonly AvatarStyle[] = [
  { id: 'g1', girl: true, label: 'فتاة بحجاب توتي', cloth: 'berry', skin: 'avatarSkinLight' },
  { id: 'g2', girl: true, label: 'فتاة بحجاب سماوي', cloth: 'sky', skin: 'avatarSkinTan' },
  { id: 'g3', girl: true, label: 'فتاة بحجاب أخضر', cloth: 'primary', skin: 'avatarSkinMid' },
  { id: 'g4', girl: true, label: 'فتاة بحجاب ذهبي', cloth: 'gold', skin: 'avatarSkinDeep' },
  { id: 'g5', girl: true, label: 'فتاة بحجاب كريمي', cloth: 'avatarCream', skin: 'avatarSkinLight' },
  { id: 'b1', girl: false, label: 'فتى بثوب أخضر', cloth: 'primary', skin: 'avatarSkinTan' },
  { id: 'b2', girl: false, label: 'فتى بثوب سماوي', cloth: 'sky', skin: 'avatarSkinMid' },
  { id: 'b3', girl: false, label: 'فتى بثوب ذهبي', cloth: 'gold', skin: 'avatarSkinDeep' },
  { id: 'b4', girl: false, label: 'فتى بثوب كريمي', cloth: 'avatarCream', skin: 'avatarSkinLight' },
];

export const avatarById = (id: string): AvatarStyle => AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;

/** Circle behind an avatar, matched to its clothing color. */
export function avatarTint(a: AvatarStyle): ColorName {
  switch (a.cloth) {
    case 'berry':
      return 'berryTint';
    case 'sky':
      return 'skyTint';
    case 'primary':
      return 'greenTint';
    case 'gold':
      return 'goldTint';
    default:
      return 'borderSoft';
  }
}

/** The text color that goes with an avatar's tint (initial-letter chips). */
export function avatarInk(a: AvatarStyle): string {
  switch (a.cloth) {
    case 'berry':
      return 'text-berry-deep';
    case 'sky':
      return 'text-sky-text';
    case 'gold':
      return 'text-warning-text';
    default:
      return 'text-deep-green';
  }
}

/**
 * `circle` = on its tinted circle (cards, chips, rows); off = the picker grid.
 * `mouth` off = the dashboard's small chips.
 */
export function ChildAvatar({
  id,
  size = 56,
  circle = true,
  mouth = true,
}: {
  id: string;
  size?: number;
  circle?: boolean;
  mouth?: boolean;
}) {
  const a = avatarById(id);
  const ink = C.avatarFeatures;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {circle && <circle cx="32" cy="32" r="32" fill={C[avatarTint(a)]} />}
      {a.girl ? (
        <g>
          <path
            d="M32 8 C19 8 13 18 13 31 C13 44 19 53 21 58 H43 C45 53 51 44 51 31 C51 18 45 8 32 8 Z"
            fill={C[a.cloth]}
          />
          <ellipse cx="32" cy="31" rx="11" ry="12.5" fill={C[a.skin]} />
          <path d="M21 28 C21 21 25 16 32 16 C39 16 43 21 43 28 Z" fill={C[a.cloth]} />
          <circle cx="27.5" cy="32" r="2.3" fill={ink} />
          <circle cx="37" cy="32" r="2.3" fill={ink} />
          {mouth && (
            <path d="M28.5 38 C30.5 40 34 40 36.5 38" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          )}
        </g>
      ) : (
        <g>
          <path d="M15 58 C15 47 23 41 32 41 C41 41 49 47 49 58 Z" fill={C[a.cloth]} />
          <ellipse cx="32" cy="30" rx="11.5" ry="12.5" fill={C[a.skin]} />
          <path d="M20 24 C20 16 25 11.5 32 11.5 C39 11.5 44 16 44 24 Z" fill={C.avatarCap} />
          {!circle && (
            <path d="M20.5 25 H43.5" stroke={C.borderStrong} strokeWidth="2" strokeLinecap="round" />
          )}
          <circle cx="27.5" cy="31" r="2.3" fill={ink} />
          <circle cx="37" cy="31" r="2.3" fill={ink} />
          {mouth && (
            <path d="M28.5 37 C30.5 39 34 39 36.5 37" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          )}
        </g>
      )}
    </svg>
  );
}
