// A child's avatar picture (src/content/avatars.ts) on its circle: mint for boys,
// pink for girls.
import { avatarByKey, avatarSrc } from '../../content/avatars';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';

/**
 * A child's avatar by key. `circle` = on its tinted circle (cards, chips, rows); off =
 * the picker grid. `className` reshapes the circle (e.g. a rounded square). `fluid` =
 * sized by `className` instead of `size` (`size` still picks the image file). An
 * unknown key ('neutral' from an older board) → a neutral silhouette.
 */
export function ChildAvatar({
  id,
  size = 56,
  circle = true,
  className,
  fluid = false,
}: {
  id: string;
  size?: number;
  circle?: boolean;
  className?: string;
  fluid?: boolean;
}) {
  const a = avatarByKey(id);
  if (!a) return <NeutralAvatar size={size} />;
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-end justify-center overflow-hidden',
        circle && cx('rounded-full', a.gender === 'girl' ? 'bg-berry-tint' : 'bg-green-tint'),
        className,
      )}
      style={fluid ? undefined : { width: size, height: size }}
    >
      <img
        src={avatarSrc(a, size)}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="block h-full w-full object-contain"
      />
    </span>
  );
}

function NeutralAvatar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={C.borderSoft} />
      <circle cx="32" cy="26" r="10" fill={C.stageOffStem} />
      <path d="M14 54 C14 43 22 38 32 38 C42 38 50 43 50 54 Z" fill={C.stageOffStem} />
    </svg>
  );
}
