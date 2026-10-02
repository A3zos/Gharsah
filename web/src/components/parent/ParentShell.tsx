// The parent area frame: ≥1024px = the ParentWeb* sidebar layout (276px
// sidebar + content); below = the phone frames with the bottom bar.
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { isSubscribed } from '../../data/parent';
import { cx } from '../../lib/cx';
import { DESKTOP, useMedia } from '../../lib/useMedia';
import { BottomNav } from '../ui/BottomNav';
import { C, type ColorName } from '../ui/color';
import { CardIcon, ChildrenIcon, GearIcon, GridIcon, LogoutIcon, SproutMark } from '../ui/icons';
import { Blob } from '../ui/Page';
import { initialOf, useParentData } from './ParentData';
import { useSignOut } from './SignOut';
import { PILOT_NAME } from '../../content/pilot';

export type ParentTab = 'home' | 'children' | 'plans' | 'settings' | null;

function HomeIcon({ color }: { color: ColorName }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11 L12 4.5 L20 11 V19 C20 19.6 19.6 20 19 20 H5 C4.4 20 4 19.6 4 19 Z"
        stroke={C[color]}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Sidebar({ tab }: { tab: ParentTab }) {
  const { profile, subscription } = useParentData();
  const signOut = useSignOut();
  const items: { key: ParentTab; to: string; label: string; icon: (c: ColorName) => React.ReactNode }[] = [
    { key: 'home', to: paths.parent.dashboard(), label: 'الرئيسية', icon: (c) => <GridIcon color={c} /> },
    { key: 'children', to: paths.parent.children, label: 'أبنائي', icon: (c) => <ChildrenIcon color={c} /> },
    { key: 'plans', to: paths.parent.plans, label: 'الباقات', icon: (c) => <CardIcon color={c} /> },
  ];
  const name = profile?.name ?? '';
  return (
    <aside className="sticky top-0 flex h-dvh w-[276px] shrink-0 flex-col gap-[26px] border-l border-l-border bg-surface px-[20px] py-[28px]">
      <Link to={paths.parent.dashboard()} className="flex items-center gap-[11px] px-[6px] no-underline">
        <SproutMark size={36} />
        <span className="font-heading text-[25px] font-bold text-deep-green">غَرْسة</span>
      </Link>
      <nav aria-label="أقسام وليّ الأمر" className="flex flex-col gap-[7px]">
        {items.map((it) => {
          const on = it.key === tab;
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={on ? 'page' : undefined}
              className={cx(
                'flex h-[54px] items-center gap-[13px] rounded-px-18 px-[16px] text-[15.5px] no-underline',
                on
                  ? 'bg-green-tint font-extrabold text-deep-green'
                  : 'bg-transparent font-bold text-text-muted',
              )}
            >
              {it.icon(on ? 'deepGreen' : 'textMuted')}
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-[10px]">
        <Link
          to={paths.parent.settings}
          aria-current={tab === 'settings' ? 'page' : undefined}
          className={cx(
            'flex h-[50px] items-center gap-[13px] rounded-px-18 px-[16px] text-[15px] font-bold no-underline',
            tab === 'settings' ? 'bg-green-tint text-deep-green' : 'text-text-muted',
          )}
        >
          <GearIcon color={tab === 'settings' ? 'deepGreen' : 'textMuted'} />
          الإعدادات
        </Link>
        <div className="flex items-center gap-[12px] rounded-px-20 bg-background p-[14px]">
          <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 bg-green-tint font-heading text-[17px] font-extrabold text-deep-green">
            {initialOf(name)}
          </span>
          <span className="flex min-w-0 grow flex-col gap-[2px]">
            <span className="truncate text-[14.5px] font-extrabold">{name}</span>
            {subscription && isSubscribed(subscription) ? (
              <span className="text-[12px] text-text-muted">{PILOT_NAME}</span>
            ) : (
              <Link to={paths.parent.plans} className="text-[12px] font-extrabold text-deep-green">
                اشترك الآن
              </Link>
            )}
          </span>
          <button
            type="button"
            aria-label="تسجيل الخروج"
            onClick={signOut.ask}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-px-12 border-0 bg-transparent"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
      {signOut.sheet}
    </aside>
  );
}

/**
 * One parent page (only one layout is mounted). `desktop` is the ParentWeb*
 * content (≥1024); `mobile` the phone frame (defaults to `desktop` when a page has one layout). `tab` marks
 * the nav item; null hides the mobile bottom bar (flows like «إضافة ابن»).
 */
export function ParentPage({
  tab,
  desktop,
  mobile,
  mobileDecor = true,
}: {
  tab: ParentTab;
  desktop: React.ReactNode;
  mobile?: React.ReactNode;
  mobileDecor?: boolean;
}) {
  const isDesktop = useMedia(DESKTOP);
  const bar = tab === 'home' || tab === 'children' || tab === 'plans' || tab === 'settings';
  if (isDesktop) {
    return (
      <div className="flex min-h-dvh bg-background text-text-dark">
        <Sidebar tab={tab} />
        <main className="flex min-w-0 grow flex-col gap-[22px] px-[40px] py-[34px]">{desktop}</main>
      </div>
    );
  }
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-text-dark">
      {mobileDecor && <Blob className="-top-[160px] -left-[140px] h-[400px] w-[400px] bg-blob-green-09" />}
      <main
        className={cx(
          'relative z-1 mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-[16px] px-[20px] py-[26px]',
          bar && 'pb-[calc(110px+env(safe-area-inset-bottom))]',
        )}
      >
        {mobile ?? desktop}
      </main>
      {bar && (
        <BottomNav
          label="أقسام وليّ الأمر"
          items={[
            {
              to: paths.parent.dashboard(),
              label: 'الرئيسية',
              active: tab === 'home',
              icon: (c) => <HomeIcon color={c} />,
            },
            {
              to: paths.parent.children,
              label: 'أبنائي',
              active: tab === 'children',
              icon: (c) => <ChildrenIcon size={26} color={c} />,
            },
            {
              to: paths.parent.plans,
              label: 'الباقات',
              active: tab === 'plans',
              icon: (c) => <CardIcon size={26} color={c} />,
            },
          ]}
        />
      )}
    </div>
  );
}

/** The phone frames' page title row (title + optional subtitle + trailing button). */
export function MobileHeader({
  title,
  subtitle,
  leading,
  trailing,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      {leading}
      <span className="flex grow flex-col gap-[3px]">
        <h1 className="m-0 font-heading text-[26px] leading-[1.4] font-bold">{title}</h1>
        {subtitle && <span className="text-[13px] text-text-muted">{subtitle}</span>}
      </span>
      {trailing}
    </div>
  );
}

/** The square gear link to «الإعدادات» in the phone headers. */
export function SettingsButton() {
  return (
    <Link
      to={paths.parent.settings}
      aria-label="الإعدادات"
      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 border border-border bg-surface no-underline"
    >
      <GearIcon color="textDark" />
    </Link>
  );
}

/** Desktop page title row. */
export function DesktopHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end gap-[20px]">
      <div className="flex grow flex-col gap-[7px]">
        <h1 className="m-0 font-heading text-[34px] font-bold">{title}</h1>
        {subtitle && <p className="m-0 text-[15px] text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
