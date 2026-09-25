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
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(88px+env(safe-area-inset-bottom))] items-start justify-around border-t border-t-border bg-surface px-[16px] pt-[12px] pb-[env(safe-area-inset-bottom)]"
    >
      {items.map((it) =>
        it.active ? (
          <span
            key={it.to}
            aria-current="page"
            className="flex min-w-[88px] flex-col items-center gap-[5px] py-[4px] text-deep-green"
          >
            {it.icon('deepGreen')}
            <span className="text-[12.5px] font-extrabold">{it.label}</span>
          </span>
        ) : (
          <Link
            key={it.to}
            to={it.to}
            className={cx(
              'flex min-w-[88px] flex-col items-center gap-[5px] py-[4px] text-text-muted no-underline',
            )}
          >
            {it.icon('textMuted')}
            <span className="text-[12.5px] font-bold">{it.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
