import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import {
  ChildrenIcon,
  CheckIcon,
  PlusIcon,
  ShieldIcon,
  SproutBadge,
  ForwardIcon,
} from '../../components/ui/icons';
import { C } from '../../components/ui/color';
import { buttonClass } from '../../components/ui/Button';
import { useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, ParentPage, SettingsButton } from '../../components/parent/ParentShell';
import {
  daysLeft,
  isSubscribed,
  PLAN_LABEL,
  remainingFraction,
  startTrial,
  trialSubscribeEnabled,
  type PlanId,
  type Subscription,
} from '../../data/parent';
import { AuthFailure } from '../../data/authFailure';
import { childrenCount } from '../../data/stats';
import { toArabicDigits } from '../../lib/arabicDigits';
import { hijriDate, hijriDayMonth } from '../../lib/dates';
import { PlanCards } from '../../components/plans/PlanCards';
import { PILOT_BUTTON } from '../../components/plans/pilotButton';
import { maxChildren } from '../../content/plans';
import { PILOT_CTA, PILOT_ITEMS, PILOT_NAME, PILOT_PRICE } from '../../content/pilot';
import type { Route } from './+types/plans';

export const meta: Route.MetaFunction = () => [{ title: 'الباقات — غَرْسة' }];

/**
 * design/v3 ParentWebPlans (desktop) / Packages (phone). Review notes B6: each
 * «اشترك» writes a TRIAL subscription (provider 'mock', the database fills the
 * dates) behind VITE_TRIAL_SUBSCRIBE — switch it off before launch; real
 * purchases are Google Play Billing in the Android app (CLAUDE.md §3).
 */
export default function PlansRoute() {
  const { children, subscription } = useParentData();
  const [params] = useSearchParams();
  const sub = subscription && isSubscribed(subscription) ? subscription : null;
  const count = children?.length ?? 0;
  // design/v3 PackagesLimit: shown when the add-child flow sent a monthly parent here.
  const max = sub ? maxChildren(sub.plan) : null;
  const limit = params.get('limit') === '1' && max !== null && count >= max;
  return (
    <ParentPage
      tab="plans"
      desktop={<Desktop sub={sub} count={count} limit={limit ? max : null} />}
      mobile={<Mobile sub={sub} count={count} limit={limit ? max : null} />}
      mobileDecor={false}
    />
  );
}

function Desktop({ sub, count, limit }: { sub: Subscription | null; count: number; limit: number | null }) {
  return (
    <div className="flex grow flex-col gap-[24px]">
      <DesktopHeader title="الباقات" subtitle="الباقة التجريبية: ثلاثة أيام، حصة واحدة كل يوم" />
      {limit !== null && <LimitBanner max={limit} />}
      {sub && (
        <div className="flex items-center gap-[20px] rounded-px-28 bg-surface px-[30px] py-[24px] shadow-dark-14-30-5">
          <span
            className="flex h-[58px] w-[58px] items-center justify-center rounded-px-20 bg-green-tint"
            aria-hidden="true"
          >
            <CheckIcon size={28} />
          </span>
          <span className="flex grow flex-col gap-[5px]">
            <span className="text-[19px] font-extrabold">
              باقتك الحالية — {PILOT_NAME} · {PILOT_PRICE}
            </span>
            <span className="text-[14px] text-text-muted">
              تنتهي في {hijriDate(sub.expiresAt)} · {PILOT_ITEMS[2]}
            </span>
          </span>
          <a
            href="https://play.google.com/store/account/subscriptions"
            target="_blank"
            rel="noreferrer"
            className={buttonClass(
              'quiet',
              'custom',
              'h-[52px] rounded-px-18 px-[22px] text-[15px] font-bold',
            )}
          >
            إدارة الاشتراك في Play
          </a>
        </div>
      )}
      <PlanCards pilotAction={<PilotAction current={!!sub} />} />
      <div className="flex grow items-end gap-[20px]">
        <Link
          to={paths.parent.children}
          className="flex grow items-center gap-[16px] rounded-px-26 border-[1.5px] border-border bg-surface px-[26px] py-[20px] text-text-dark no-underline hover:text-text-dark"
        >
          <span
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-px-18 bg-green-tint"
            aria-hidden="true"
          >
            <ChildrenIcon size={26} color="deepGreen" />
          </span>
          <span className="flex grow flex-col gap-[4px]">
            <span className="text-[17px] font-extrabold">أبنائي — {childrenCount(count)}</span>
            <span className="text-[13.5px] text-text-muted">
              رموز الربط، المتابعة التفصيلية، وإضافة ابن جديد
            </span>
          </span>
          <ForwardIcon size={22} color="deepGreen" strokeWidth={2.4} />
        </Link>
        <span className="flex items-center gap-[12px] rounded-px-26 border-[1.5px] border-border bg-surface px-[26px] py-[20px]">
          <ShieldIcon size={22} />
          <span className="max-w-[240px] text-[13.5px] leading-[1.7] text-text-muted">
            لا نطلب بيانات بطاقة · الإلغاء من إعدادات الاشتراكات في Play
          </span>
        </span>
      </div>
    </div>
  );
}

function Mobile({ sub, count, limit }: { sub: Subscription | null; count: number; limit: number | null }) {
  const current = sub?.plan;
  return (
    <div className="flex flex-col gap-[18px] pt-[4px]">
      <div className="flex items-center gap-[12px]">
        <span className="shrink-0">
          <SproutBadge size={40} />
        </span>
        <h1 className="m-0 grow font-heading text-[26px] leading-[1.5] font-bold">الباقات</h1>
        <SettingsButton />
      </div>

      {limit !== null && <LimitBanner max={limit} />}

      {/* TODO(design): no designed "no subscription yet" hero; the card only shows with an active plan. */}
      {sub && (
        <div className="relative flex flex-col gap-[14px] overflow-hidden rounded-px-28 bg-deep-green px-[20px] pt-[22px] pb-[20px]">
          <div
            aria-hidden="true"
            className="absolute -top-[40px] -left-[30px] h-[150px] w-[150px] rounded-full bg-hero-circle"
          />
          <div className="relative flex items-center justify-between gap-[10px]">
            <span className="font-heading text-[19px] leading-[1.5] font-bold text-surface">
              باقتك الحالية — {PILOT_NAME} · {PILOT_PRICE}
            </span>
            <span className="rounded-pill bg-gold px-[12px] py-[5px] text-[12px] font-extrabold whitespace-nowrap text-on-gold">
              نشطة
            </span>
          </div>
          <div className="relative flex items-baseline gap-[8px]">
            <span className="font-heading text-[42px] leading-[1.1] font-extrabold text-gold">
              {toArabicDigits(daysLeft(sub))}
            </span>
            <span className="text-[15px] font-medium text-on-deep-green-muted">يومًا متبقية</span>
          </div>
          <div className="relative flex flex-col gap-[8px]">
            <div className="h-[10px] overflow-hidden rounded-px-6 bg-hero-track">
              <div
                className="h-full rounded-px-6 bg-gold"
                style={{ width: `${Math.round(remainingFraction(sub) * 100)}%` }}
              />
            </div>
            <span className="text-[12.5px] text-on-deep-green-muted">
              تنتهي في {hijriDayMonth(sub.expiresAt)}
            </span>
          </div>
        </div>
      )}

      <PlanCards pilotAction={<PilotAction current={!!current} />} />

      <Link
        to={paths.parent.addChildFrom('plans')}
        className={buttonClass('primary', 'lg', 'gap-[10px] shadow-green-button')}
      >
        <PlusIcon size={22} color="surface" />
        إضافة ابن
      </Link>
      <Link
        to={paths.parent.children}
        className="flex items-center gap-[13px] rounded-px-24 border-[1.5px] border-border bg-surface px-[18px] py-[16px] text-text-dark no-underline hover:text-text-dark"
      >
        <span
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-px-16 bg-green-tint"
          aria-hidden="true"
        >
          <ChildrenIcon size={26} color="deepGreen" />
        </span>
        <span className="flex grow flex-col gap-[3px]">
          <span className="text-[16px] font-extrabold">أبنائي</span>
          <span className="text-[12.5px] text-text-muted">
            {childrenCount(count)} · {count === 1 ? 'رمز الربط والإدارة' : 'رموز الربط والإدارة'}
          </span>
        </span>
        <ForwardIcon size={20} color="deepGreen" strokeWidth={2.3} />
      </Link>
    </div>
  );
}

/** design/v3 PackagesLimit — a one-child plan (the pilot) and a second child was added. */
function LimitBanner({ max }: { max: number }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-[14px] rounded-px-26 border-[1.5px] border-berry-border bg-berry-tint p-[20px]"
    >
      <div className="flex items-start gap-[13px]">
        <span
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-px-16 bg-surface"
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="8" r="3.4" stroke={C.berryDeep} strokeWidth="2" />
            <path
              d="M3 19 C3 15.5 5.7 13.6 9 13.6 C12.3 13.6 15 15.5 15 19"
              stroke={C.berryDeep}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M18 7.5 V13 M15.2 10.2 H20.8"
              stroke={C.berryDeep}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="flex min-w-0 grow flex-col gap-[6px]">
          <span className="font-heading text-[19px] leading-[1.45] font-bold text-error-text">
            {max === 1 ? 'باقتك لابن واحد' : `${PILOT_NAME} حتى ${toArabicDigits(max)} أبناء`}
          </span>
          <span className="text-[14px] leading-[1.8] text-error-text">
            وصلت إلى عدد الأبناء الذي تشمله باقتك — نخبرك حين تتوفّر الباقات لكل الأبناء.
          </span>
        </span>
      </div>
    </div>
  );
}

/** The pilot card's button: «باقتك الحالية» when on it, else «ابدأ مجانًا» (free — no payment). */
function PilotAction({ current }: { current: boolean }) {
  if (current) return <CurrentChip />;
  return (
    <SubscribeButton plan="trial" className={PILOT_BUTTON}>
      {PILOT_CTA}
      <ForwardIcon size={20} />
    </SubscribeButton>
  );
}

function CurrentChip({ muted }: { muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? 'flex h-[56px] items-center justify-center gap-[8px] rounded-px-19 bg-border-soft font-heading text-[17px] font-bold text-text-muted'
          : 'flex h-[56px] items-center justify-center gap-[8px] rounded-px-19 bg-green-tint font-heading text-[17px] font-bold text-deep-green'
      }
    >
      <CheckIcon size={19} color={muted ? 'textMuted' : 'deepGreen'} />
      باقتك الحالية
    </span>
  );
}

/**
 * «اشترك» / «الترقية» / «تجديد»: writes the trial subscription, shows the success
 * state, then opens the dashboard. Off (VITE_TRIAL_SUBSCRIBE≠1) → a disabled
 * «قريبًا من التطبيق» (purchases then only through Google Play in the app).
 */
function SubscribeButton({
  plan,
  className,
  children,
}: {
  plan: PlanId | 'trial';
  className: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // The free pilot needs no purchase; paid plans only through Google Play (off on the web).
  if (plan !== 'trial' && !trialSubscribeEnabled()) {
    return (
      <button type="button" disabled className={className}>
        قريبًا من التطبيق
      </button>
    );
  }
  const go = async () => {
    setError(null);
    setState('busy');
    try {
      await startTrial(plan);
      setState('done');
      setTimeout(() => navigate(paths.parent.dashboard()), 1200);
    } catch (e) {
      setState('idle');
      setError(e instanceof AuthFailure ? e.message : 'تعذّر تفعيل الباقة — حاول مرة أخرى.');
    }
  };
  return (
    <span className="mt-auto flex flex-col gap-[8px]">
      <button
        type="button"
        onClick={() => void go()}
        disabled={state !== 'idle'}
        aria-busy={state === 'busy'}
        className={className}
      >
        {state === 'done' ? (
          <>
            <CheckIcon size={19} color="surface" />
            تم تفعيل الباقة
          </>
        ) : (
          children
        )}
      </button>
      {state === 'done' && (
        <span role="status" className="text-center text-[13px] font-bold text-deep-green">
          تم تفعيل {plan === 'trial' ? PILOT_NAME : `الباقة ${PLAN_LABEL[plan]}`} — ننتقل إلى لوحة التحكم…
        </span>
      )}
      {error && (
        <span role="alert" className="text-center text-[13px] font-bold text-error-text">
          {error}
        </span>
      )}
    </span>
  );
}
