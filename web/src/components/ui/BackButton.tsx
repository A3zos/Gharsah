import { Link } from 'react-router';

import { useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { BackIcon } from './icons';

/** The square «رجوع» button (02–04: 46px, r16; secondary screens: 44px, r15); the chevron mirrors in LTR. */
export function BackButton({
  to,
  onClick,
  small,
  label,
  className,
}: {
  to?: string;
  onClick?: () => void;
  small?: boolean;
  label?: string;
  className?: string;
}) {
  const { m } = useI18n();
  const name = label ?? m.common.back;
  const cls = cx(
    'flex shrink-0 items-center justify-center border border-border bg-surface no-underline',
    small ? 'h-[44px] w-[44px] rounded-px-15' : 'h-[46px] w-[46px] rounded-px-16',
    className,
  );
  const icon = (
    <span className="flex ltr:-scale-x-100" aria-hidden="true">
      <BackIcon size={small ? 20 : 22} strokeWidth={small ? 2.4 : 2.2} />
    </span>
  );
  if (to) {
    return (
      <Link to={to} aria-label={name} className={cls}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={name} onClick={onClick} className={cls}>
      {icon}
    </button>
  );
}
