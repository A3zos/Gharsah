// design/v3's shared top bar (Auth, Login, Signup, AddChild, Schedule,
// ScheduleCustom, AvatarPicker, PairingCode, SCodeExpired): «‹ الرئيسية» at the
// start, the underlined غَرْسة logo at the end — both go "home" (the parent
// dashboard when signed in, else the landing page). Leaving a form with unsaved
// input is confirmed by the page's own navigation blocker (useLeaveGuard).
import { Link } from 'react-router';

import { useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { useHomeTarget } from '../../lib/useHomeTarget';
import { ForwardIcon, SproutMark } from './icons';

export function HomeBar({
  className,
  to,
  logoFirst,
}: {
  className?: string;
  to?: string;
  logoFirst?: boolean;
}) {
  const home = useHomeTarget();
  const { m } = useI18n();
  const target = to ?? home;
  const button = (
    <Link
      to={target}
      className="flex h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-px-15 border-[1.5px] border-input-border bg-surface px-[15px] text-[14px] font-extrabold text-deep-green no-underline"
    >
      {/* mirrored in LTR (the English login) */}
      <ForwardIcon size={18} color="deepGreen" strokeWidth={2.4} className="ltr:-scale-x-100" />
      {m.common.home}
    </Link>
  );
  const logo = (
    <Link
      to={target}
      aria-label={m.common.logoLabel}
      className="flex shrink-0 items-center gap-[8px] rounded-px-12 px-[6px] py-[4px] no-underline"
    >
      <SproutMark size={26} seed={false} />
      <span className="font-heading text-[19px] font-bold text-deep-green underline decoration-deep-green/35 underline-offset-4">
        غَرْسة
      </span>
    </Link>
  );
  // RTL: the first child sits on the right. logoFirst = logo right, «الرئيسية» left (login).
  return (
    <nav
      aria-label={m.common.navLabel}
      className={cx('flex w-full shrink-0 items-center gap-[12px]', className)}
    >
      {logoFirst ? logo : button}
      <span className="grow" />
      {logoFirst ? button : logo}
    </nav>
  );
}
