// design/v3's shared top bar (Auth, Login, Signup, AddChild, Schedule,
// ScheduleCustom, AvatarPicker, PairingCode, SCodeExpired): «‹ الرئيسية» at the
// start, the underlined غَرْسة logo at the end — both go "home" (the parent
// dashboard when signed in, else the landing page). Leaving a form with unsaved
// input is confirmed by the page's own navigation blocker (useLeaveGuard).
import { Link } from 'react-router';

import { cx } from '../../lib/cx';
import { useHomeTarget } from '../../lib/useHomeTarget';
import { ForwardIcon, SproutMark } from './icons';

export function HomeBar({ className, to }: { className?: string; to?: string }) {
  const home = useHomeTarget();
  const target = to ?? home;
  return (
    <nav aria-label="التنقل" className={cx('flex w-full shrink-0 items-center gap-[12px]', className)}>
      <Link
        to={target}
        className="flex h-[44px] shrink-0 items-center justify-center gap-[8px] rounded-px-15 border-[1.5px] border-input-border bg-surface px-[15px] text-[14px] font-extrabold text-deep-green no-underline"
      >
        <ForwardIcon size={18} color="deepGreen" strokeWidth={2.4} />
        الرئيسية
      </Link>
      <span className="grow" />
      <Link
        to={target}
        aria-label="غَرْسة — العودة إلى الصفحة الرئيسية"
        className="flex shrink-0 items-center gap-[8px] rounded-px-12 px-[6px] py-[4px] no-underline"
      >
        <SproutMark size={26} seed={false} />
        <span className="font-heading text-[19px] font-bold text-deep-green underline decoration-deep-green/35 underline-offset-4">
          غَرْسة
        </span>
      </Link>
    </nav>
  );
}
