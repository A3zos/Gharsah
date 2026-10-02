import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { ChildAvatar } from '../../components/child/ChildAvatar';
import { useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, MobileHeader, ParentPage, SettingsButton } from '../../components/parent/ParentShell';
import { buttonClass } from '../../components/ui/Button';
import { C } from '../../components/ui/color';
import { CheckIcon, ClockIcon, ForwardIcon, PlusIcon } from '../../components/ui/icons';
import { pairingActive, removeChild, type ChildProfile } from '../../data/children';
import { PlanBar, PlanTimeline, StageBadge } from '../../components/parent/PlanTimeline';
import { planProgress } from '../../data/planProgress';
import { ageLabel, childrenCount, headline } from '../../data/stats';
import { PILOT_PRICE } from '../../content/pilot';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { hoursUntil } from '../../lib/dates';
import type { Route } from './+types/children';

export const meta: Route.MetaFunction = () => [{ title: 'أبنائي — غَرْسة' }];

/** «١٠ سنوات · رمز الربط ٤٧٢٩١٨» or, waiting, «… · الرمز ينتهي بعد ٢٣ ساعة». */
function childLine(c: ChildProfile, desktopWaiting: boolean): string {
  const age = ageLabel(c.age);
  if (desktopWaiting && !c.linked && c.pairing && pairingActive(c.pairing)) {
    return `${age} · الرمز ينتهي بعد ${toArabicDigits(hoursUntil(c.pairing.expiresAt))} ساعة`;
  }
  return c.pairing ? `${age} · رمز الربط ${toArabicDigits(c.pairing.code)}` : age;
}

function StatusPill({ linked, small }: { linked: boolean; small?: boolean }) {
  return linked ? (
    <span
      className={cx(
        'flex items-center gap-[6px] rounded-pill bg-green-tint font-extrabold text-deep-green',
        small ? 'px-[11px] py-[6px] text-[11.5px]' : 'px-[12px] py-[6px] text-[12.5px]',
      )}
    >
      <CheckIcon size={13} strokeWidth={3.4} />
      مرتبط
    </span>
  ) : (
    <span
      className={cx(
        'flex items-center gap-[6px] rounded-pill bg-gold-tint font-extrabold text-warning-text',
        small ? 'px-[11px] py-[6px] text-[11.5px]' : 'px-[12px] py-[6px] text-[12.5px]',
      )}
    >
      <ClockIcon />
      بانتظار الربط
    </span>
  );
}

export default function ChildrenRoute() {
  const { children } = useParentData();
  const [error, setError] = useState<string | null>(null);
  const remove = async (c: ChildProfile) => {
    // TODO(design): no designed confirmation for «حذف الابن»; the browser's confirm dialog is used.
    if (!window.confirm(`حذف ${c.name}؟ تُحذف متابعته وتسجيلاته نهائيًا.`)) return;
    try {
      await removeChild(c.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <ParentPage
      tab="children"
      desktop={<Desktop kids={children} />}
      mobile={<Mobile kids={children} onRemove={remove} error={error} />}
    />
  );
}

function Desktop({ kids }: { kids: ChildProfile[] | null }) {
  const n = kids?.length ?? 0;
  return (
    <>
      <DesktopHeader
        title="أبنائي"
        subtitle={`${childrenCount(n)} على اشتراك واحد · اختر ابنًا لعرض متابعته التفصيلية`}
        action={
          <Link
            to={paths.parent.addChildFrom('children')}
            className={buttonClass(
              'gold',
              'custom',
              'h-[54px] gap-[10px] rounded-px-18 px-[24px] text-[15.5px] font-extrabold',
            )}
          >
            <PlusIcon />
            إضافة ابن
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-[20px]" aria-busy={kids === null}>
        {kids?.map((c) => {
          const h = headline(c);
          const plan = planProgress(c);
          return (
            <article
              key={c.id}
              className="flex flex-col gap-[18px] rounded-px-30 border-[1.5px] border-border bg-surface px-[26px] py-[24px] shadow-dark-12-26-5"
            >
              <div className="flex items-center gap-[16px]">
                <ChildAvatar id={c.avatarId} size={58} className="rounded-px-20" />
                <span className="flex min-w-0 grow flex-col gap-[5px]">
                  <h2 className="m-0 font-heading text-[22px] leading-[1.4] font-bold">{c.name}</h2>
                  <span className="text-[13.5px] text-text-muted">{childLine(c, true)}</span>
                </span>
                <StatusPill linked={c.linked} />
              </div>
              <div className="flex flex-col gap-[8px]">
                <span className="flex items-center gap-[8px] text-[13px] font-bold text-text-muted">
                  {plan.plan.name} · {PILOT_PRICE}
                  <StageBadge stage={plan.stage} />
                </span>
                <PlanTimeline progress={plan} unscored={c.pilotUnscored} compact />
                <PlanBar progress={plan} />
              </div>
              <div className="flex gap-[10px]">
                {(
                  [
                    [h.surahs, 'سور'],
                    [h.ayat, 'آيات'],
                    [h.hadith, 'أحاديث'],
                    [h.projects, 'مشاريع'],
                  ] as const
                ).map(([v, label]) => (
                  <span
                    key={label}
                    className="flex grow basis-0 flex-col gap-[3px] rounded-px-18 bg-background px-[14px] py-[12px]"
                  >
                    <span className="font-heading text-[25px] leading-[1.15] font-extrabold">
                      {toArabicDigits(v)}
                    </span>
                    <span className="text-[12px] font-bold text-text-muted">{label}</span>
                  </span>
                ))}
              </div>
              <div className="flex gap-[12px]">
                <Link
                  to={paths.parent.dashboard(c.id)}
                  className={buttonClass('primary', 'md', 'grow gap-[9px]')}
                >
                  عرض المتابعة
                  <ForwardIcon />
                </Link>
                <Link
                  to={`${paths.parent.childCode(c.id)}?new=1`}
                  className={buttonClass(
                    'quiet',
                    'custom',
                    'h-[52px] rounded-px-18 px-[20px] text-[14.5px] font-bold',
                  )}
                >
                  رمز ربط جديد
                </Link>
              </div>
            </article>
          );
        })}
        <Link
          to={paths.parent.addChildFrom('children')}
          className="flex min-h-[200px] flex-col items-center justify-center gap-[12px] rounded-px-30 border-[2px] border-dashed border-input-border bg-transparent text-deep-green no-underline"
        >
          <span
            className="flex h-[62px] w-[62px] items-center justify-center rounded-px-22 bg-green-tint"
            aria-hidden="true"
          >
            <PlusIcon size={28} color="deepGreen" />
          </span>
          <span className="font-heading text-[20px] font-bold">إضافة ابن جديد</span>
          <span className="text-[13.5px] text-text-muted">بلا حدّ على نفس الاشتراك</span>
        </Link>
      </div>
    </>
  );
}

function Mobile({
  kids,
  onRemove,
  error,
}: {
  kids: ChildProfile[] | null;
  onRemove: (c: ChildProfile) => void;
  error: string | null;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  return (
    <>
      <MobileHeader title="أبنائي" subtitle="حسابك يتّسع لجميع أبنائك" trailing={<SettingsButton />} />
      {error && (
        <p role="alert" className="m-0 text-[13px] font-bold text-error-text">
          {error}
        </p>
      )}
      {kids?.map((c) => (
        <article
          key={c.id}
          className="relative flex flex-col gap-[14px] rounded-px-26 border-[1.5px] border-border bg-surface p-[18px] shadow-dark-10-22-4"
        >
          <div className="flex items-center gap-[13px]">
            <span className="shrink-0">
              <ChildAvatar id={c.avatarId} size={56} />
            </span>
            <span className="flex min-w-0 grow flex-col gap-[5px]">
              <h2 className="m-0 text-[17px] font-extrabold">{c.name}</h2>
              <span className="text-[12.5px] text-text-muted">{childLine(c, false)}</span>
            </span>
            <button
              type="button"
              aria-label={`خيارات ${c.name}`}
              aria-expanded={menu === c.id}
              aria-haspopup="menu"
              onClick={() => setMenu((m) => (m === c.id ? null : c.id))}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 border-0 bg-background"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="5.5" r="1.8" fill={C.textMuted} />
                <circle cx="12" cy="12" r="1.8" fill={C.textMuted} />
                <circle cx="12" cy="18.5" r="1.8" fill={C.textMuted} />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-[10px]">
            <StatusPill linked={c.linked} small />
            <span className="grow" />
            <Link
              to={c.linked ? paths.parent.dashboard(c.id) : paths.parent.childCode(c.id)}
              className="flex h-[44px] items-center gap-[7px] rounded-px-15 bg-green-tint px-[16px] text-[13.5px] font-extrabold text-deep-green no-underline"
            >
              {c.linked ? 'الإنجازات' : 'عرض الرمز'}
              <ForwardIcon size={17} color="deepGreen" strokeWidth={2.4} />
            </Link>
          </div>
          {menu === c.id && (
            <ChildMenu child={c} onClose={() => setMenu(null)} onRemove={() => onRemove(c)} />
          )}
        </article>
      ))}
      <Link
        to={paths.parent.addChildFrom('children')}
        className="flex h-[62px] items-center justify-center gap-[11px] rounded-px-22 border-[1.5px] border-dashed border-input-border bg-transparent font-heading text-[18px] font-bold text-deep-green no-underline"
      >
        <PlusIcon color="deepGreen" />
        إضافة ابن
      </Link>
    </>
  );
}

function ChildMenu({
  child,
  onClose,
  onRemove,
}: {
  child: ChildProfile;
  onClose: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDoc = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('pointerdown', onDoc));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const item =
    'flex h-[46px] items-center gap-[10px] rounded-px-14 px-[12px] text-[14.5px] font-bold no-underline';
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`خيارات ${child.name}`}
      className="absolute top-[62px] left-[16px] z-4 flex w-[214px] animate-[gh-pop-2_.3s_ease-out_both] flex-col gap-[2px] rounded-px-20 border-[1.5px] border-border bg-surface p-[7px] shadow-dark-18-40-14"
    >
      <Link role="menuitem" to={paths.parent.editSchedule(child.id)} className={cx(item, 'text-text-dark')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5.5" width="16" height="14" rx="3" stroke={C.textMuted} strokeWidth="1.9" />
          <path
            d="M4 10 H20 M8.5 3.5 V7 M15.5 3.5 V7"
            stroke={C.textMuted}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
        تعديل الجدول
      </Link>
      <Link
        role="menuitem"
        to={`${paths.parent.childCode(child.id)}?new=1`}
        className={cx(item, 'text-text-dark')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.5 12 A7.5 7.5 0 1 1 7.4 17.9"
            stroke={C.textMuted}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4.5 7 V12 H9.5"
            stroke={C.textMuted}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        رمز ربط جديد
      </Link>
      <span className="mx-[8px] my-[4px] h-[1px] bg-divider" />
      <button
        role="menuitem"
        type="button"
        onClick={() => {
          onClose();
          onRemove();
        }}
        className={cx(item, 'border-0 bg-transparent text-right font-body text-berry-deep')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 7 H19 M9.5 7 V5.5 C9.5 4.7 10.2 4 11 4 H13 C13.8 4 14.5 4.7 14.5 5.5 V7"
            stroke={C.berryDeep}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M6.8 7 L7.7 19 C7.8 19.6 8.3 20 8.9 20 H15.1 C15.7 20 16.2 19.6 16.3 19 L17.2 7"
            stroke={C.berryDeep}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
        حذف الابن
      </button>
    </div>
  );
}
