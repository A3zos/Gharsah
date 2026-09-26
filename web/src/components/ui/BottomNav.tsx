import { Link } from 'react-router';

import { cx } from '../../lib/cx';
import type { ColorName } from './color';

export interface NavItem {
  to: string;
  label: string;
  icon: (color: ColorName) => React.ReactNode;
  active?: boolean;
}

/** The 88px bottom bar of the phone frames (parent: الرئيسية/أبنائي/الباقات; child: الرئيسية/ملفّي). */
export function BottomNav({ items, label, child }: { items: NavItem[]; label: string; child?: boolean }) {
  return (
    <nav
      aria-label={label}
      className={cx(
        'fixed inset-x-0 bottom-0 z-30 flex items-start justify-around border-t border-t-border bg-surface pt-[12px] pb-[env(safe-area-inset-bottom)]',
        child
          ? 'h-[calc(90px+env(safe-area-inset-bottom))] px-[20px]'
          : 'h-[calc(88px+env(safe-area-inset-bottom))] px-[16px]',
      )}
    >
      {items.map((it) =>
        it.active ? (
          <span
            key={it.to}
            aria-current="page"
            className={cx(
              'flex flex-col items-center gap-[5px] text-deep-green',
              child ? 'min-w-[100px] py-[6px]' : 'min-w-[88px] py-[4px]',
            )}
          >
            {it.icon('deepGreen')}
            <span className={cx('font-extrabold', child ? 'text-[13px]' : 'text-[12.5px]')}>{it.label}</span>
          </span>
        ) : (
          <Link
            key={it.to}
            to={it.to}
            className={cx(
              'flex flex-col items-center gap-[5px] text-text-muted no-underline',
              child ? 'min-w-[100px] py-[6px]' : 'min-w-[88px] py-[4px]',
            )}
          >
            {it.icon('textMuted')}
            <span className={cx('font-bold', child ? 'text-[13px]' : 'text-[12.5px]')}>{it.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
