import { Link } from 'react-router';

import { cx } from '../../lib/cx';
import { BackIcon } from './icons';

/** The square «رجوع» button (02–04: 46px, r16; secondary screens: 44px, r15). */
export function BackButton({
  to,
  onClick,
  small,
  label = 'رجوع',
  className,
}: {
  to?: string;
  onClick?: () => void;
  small?: boolean;
  label?: string;
  className?: string;
}) {
  const cls = cx(
    'flex shrink-0 items-center justify-center border border-border bg-surface no-underline',
    small ? 'h-[44px] w-[44px] rounded-px-15' : 'h-[46px] w-[46px] rounded-px-16',
    className,
  );
  const icon = <BackIcon size={small ? 20 : 22} strokeWidth={small ? 2.4 : 2.2} />;
  if (to) {
    return (
      <Link to={to} aria-label={label} className={cls}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {icon}
    </button>
  );
}
