import { cx } from '../../lib/cx';

/**
 * ﴿ verified ayah ﴾ — Amiri Quran with gold brackets (CLAUDE.md §4). `text`
 * must come from the verified Tanzil asset (content/), never from code or AI.
 */
export function AyahText({
  text,
  className,
  bracketClassName,
}: {
  text: string;
  /** Size / line-height of the ayah. */
  className?: string;
  /** Size of the brackets. */
  bracketClassName?: string;
}) {
  return (
    <p className={cx('m-0 text-center font-ayah text-text-dark', className)}>
      <span className={cx('text-ayah-bracket', bracketClassName)} aria-hidden="true">
        ﴿
      </span>{' '}
      <span>{text}</span>{' '}
      <span className={cx('text-ayah-bracket', bracketClassName)} aria-hidden="true">
        ﴾
      </span>
    </p>
  );
}
