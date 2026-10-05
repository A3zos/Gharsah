// «أكمل اسمك ليظهر مع اسم طفلك في لوحة المتصدرين» — once, on the dashboard, when the
// parent's name is only the sign-up fallback (the email's local part / «ولي الأمر»), the
// same rule as public.parent_first_name() (20261005100000_leaderboard_names). Closing it
// hides it on this browser. TODO(design): no designed banner.
import { useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { useI18n } from '../../i18n/i18n';
import { useParentData } from './ParentData';

const KEY = 'gh.nameBanner.closed';
const PLACEHOLDERS = ['ولي الأمر', 'ولي أمر', 'حساب تجريبي'];

/** The name the board would not show as the father's (mirrors parent_first_name in SQL). */
export function isPlaceholderName(
  name: string | null | undefined,
  email: string | null | undefined,
): boolean {
  const n = (name ?? '').replace(/\s+/g, ' ').trim();
  return !n || n === (email ?? '').split('@')[0] || PLACEHOLDERS.includes(n);
}

export function NameBanner() {
  const { profile } = useParentData();
  const { m } = useI18n();
  const t = m.parent.dashboard;
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (closed || !profile || !isPlaceholderName(profile.name, profile.email)) return null;
  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // storage blocked — hidden for this visit
    }
  };
  return (
    <div
      role="status"
      className="flex items-center gap-[10px] rounded-px-18 bg-gold-tint px-[14px] py-[11px] text-[13.5px] leading-[1.7] text-on-gold"
    >
      <span className="grow font-bold">
        {t.nameBanner}{' '}
        <Link to={paths.parent.settings} className="font-extrabold text-deep-green">
          {t.nameBannerLink}
        </Link>
      </span>
      <button
        type="button"
        onClick={close}
        aria-label={m.language.close}
        className="flex h-[36px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-[18px] text-on-gold"
      >
        ×
      </button>
    </div>
  );
}
