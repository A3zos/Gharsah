import { Link, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import {
  ChildrenIcon,
  CheckIcon,
  PlayGlyph,
  PlusIcon,
  ShieldIcon,
  SproutBadge,
  ForwardIcon,
} from '../../components/ui/icons';
import { C } from '../../components/ui/color';
import { buttonClass } from '../../components/ui/Button';
import { useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, ParentPage, SettingsButton } from '../../components/parent/ParentShell';
import { daysLeft, isSubscribed, PLAN_LABEL, remainingFraction, type Subscription } from '../../data/parent';
import { childrenCount } from '../../data/stats';
import { toArabicDigits } from '../../lib/arabicDigits';
import { hijriDate, hijriDayMonth } from '../../lib/dates';
import { StoreBadges } from '../../components/ui/StoreBadges';
import { PhoneDownloadIcon, PlanList } from '../../components/landing/shared';
import { MONTHLY_MAX_CHILDREN, PLANS, PRICE } from '../../content/plans';
import type { Route } from './+types/plans';

export const meta: Route.MetaFunction = () => [{ title: 'الباقات — غَرْسة' }];

/**
 * design/v3 ParentWebPlans (desktop) / Packages (phone). The web never sells:
 * Google Play Billing lives in the Android app (CLAUDE.md §3), so every buy /
 * renew button says «… من التطبيق» and points to the app download.
 */
export default function PlansRoute() {
  const { children, subscription } = useParentData();
  const [params] = useSearchParams();
  const sub = subscription && isSubscribed(subscription) ? subscription : null;
  const count = children?.length ?? 0;
  // design/v3 PackagesLimit: shown when the add-child flow sent a monthly parent here.
  const limit = params.get('limit') === '1' && sub?.plan === 'monthly' && count >= MONTHLY_MAX_CHILDREN;
  return (
    <ParentPage
      tab="plans"
      desktop={<Desktop sub={sub} count={count} limit={limit} />}
      mobile={<Mobile sub={sub} count={count} limit={limit} />}
      mobileDecor={false}
    />
  );
}

function Desktop({ sub, count, limit }: { sub: Subscription | null; count: number; limit: boolean }) {
  return (
    <div className="flex grow flex-col gap-[24px]">
      <DesktopHeader
        title="الباقات"
        subtitle="اشتراك واحد يكفي جميع أبنائك · الدفع والإلغاء عبر Google Play"
      />
      {limit && <LimitBanner href="#get-app" />}
      <div
        id="get-app"
        className="flex scroll-mt-[20px] items-center gap-[18px] rounded-px-24 border-[1.5px] border-gold-border bg-gold-tint px-[24px] py-[18px]"
      >
        <span
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-px-16 bg-surface"
          aria-hidden="true"
        >
          <PhoneGlyph />
        </span>
        <span className="flex grow flex-col gap-[4px]">
          <span className="text-[16.5px] font-extrabold text-on-gold">
            الشراء عبر Google Play غير متاح في المتصفح
          </span>
          <span className="text-[14px] leading-[1.7] text-warning-text">
            الأسعار معروضة للاطلاع. أكمل الاشتراك أو التجديد من التطبيق على جوالك — المتصفح للمتابعة فقط.
          </span>
        </span>
        <StoreBadges size={56} />
      </div>
      {sub && (
        <div className="flex items-center gap-[20px] rounded-px-28 bg-surface px-[30px] py-[24px] shadow-dark-14-30-5">
          <span
            className="flex h-[58px] w-[58px] items-center justify-center rounded-px-20 bg-green-tint"
            aria-hidden="true"
          >
            <CheckIcon size={28} />
          </span>
          <span className="flex grow flex-col gap-[5px]">
            <span className="text-[19px] font-extrabold">باقتك الحالية — {PLAN_LABEL[sub.plan]}</span>
            <span className="text-[14px] text-text-muted">
              تتجدّد في {hijriDate(sub.expiresAt)} · {PRICE[sub.plan]} ريال{' '}
              {sub.plan === 'annual' ? 'في السنة' : 'في الشهر'}
            </span>
          </span>
          <a href="#get-app" className={buttonClass('gold', 'md', 'gap-[9px] px-[24px]')}>
            <PlayGlyph color="onGold" />
            جدّد من التطبيق
          </a>
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
      <div className="flex gap-[20px]">
        {(['annual', 'monthly'] as const).map((plan) => {
          const current = sub?.plan === plan;
          const annual = plan === 'annual';
          return (
            <div
              key={plan}
              className={
                annual
                  ? 'relative flex grow basis-0 flex-col gap-[16px] rounded-px-32 border-[2.5px] border-primary bg-surface px-[32px] pt-[34px] pb-[28px] shadow-primary-16-34-12'
                  : 'flex grow basis-0 flex-col gap-[16px] rounded-px-32 border-[1.5px] border-border bg-surface px-[32px] pt-[34px] pb-[28px]'
              }
            >
              {annual && (
                <span className="absolute -top-[15px] right-[32px] rounded-pill bg-primary px-[18px] py-[8px] text-[13px] font-extrabold text-surface">
                  الأفضل قيمة
                </span>
              )}
              <h2 className="m-0 font-heading text-[25px] font-bold">
                {annual ? 'الباقة السنوية' : 'الباقة الشهرية'}
              </h2>
              <span className="flex items-baseline gap-[9px]">
                <span
                  className={`font-heading text-[58px] leading-[1] font-extrabold ${annual ? 'text-deep-green' : 'text-text-dark'}`}
                >
                  {PRICE[plan]}
                </span>
                <span className="text-[17px] font-bold text-text-muted">
                  {annual ? 'ريال / سنة' : 'ريال / شهر'}
                </span>
              </span>
              {annual ? (
                <span className="self-start rounded-pill bg-gold-tint px-[14px] py-[8px] text-[13.5px] font-bold text-warning-text">
                  أقل من ١٠ ريالات في الشهر
                </span>
              ) : (
                <span className="self-start py-[8px] text-[13.5px] font-bold text-text-muted">
                  تجربة مرنة للبداية
                </span>
              )}
              <div className="h-[1px] bg-border" />
              <PlanList items={PLANS[plan]} text="text-[15px]" />
              {current ? (
                <span className="mt-auto flex h-[58px] items-center justify-center rounded-px-20 bg-green-tint font-heading text-[18px] font-bold text-deep-green">
                  باقتك الحالية
                </span>
              ) : (
                <a
                  href="#get-app"
                  className={buttonClass(
                    'plain',
                    'custom',
                    'mt-auto h-[58px] gap-[10px] rounded-px-20 font-heading text-[18px] font-bold',
                  )}
                >
                  <PhoneDownloadIcon color="textDark" />
                  اشترك من التطبيق
                </a>
              )}
            </div>
          );
        })}
      </div>
      <p className="m-0 text-center text-[14.5px] leading-[1.8] font-extrabold text-deep-green">
        يمكنك الترقية من الشهرية إلى السنوية في أي وقت
      </p>
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

function PhoneGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="2.5" width="12" height="19" rx="3" stroke={C.warningText} strokeWidth="1.9" />
      <path d="M10.5 18.5 H13.5" stroke={C.warningText} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function Mobile({ sub, count, limit }: { sub: Subscription | null; count: number; limit: boolean }) {
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

      {limit && <LimitBanner href="#m-get-app" />}

      {/* TODO(design): no designed "no subscription yet" hero; the card only shows with an active plan. */}
      {sub && (
        <div className="relative flex flex-col gap-[14px] overflow-hidden rounded-px-28 bg-deep-green px-[20px] pt-[22px] pb-[20px]">
          <div
            aria-hidden="true"
            className="absolute -top-[40px] -left-[30px] h-[150px] w-[150px] rounded-full bg-hero-circle"
          />
          <div className="relative flex items-center justify-between gap-[10px]">
            <span className="font-heading text-[19px] leading-[1.5] font-bold text-surface">
              باقتك الحالية — {PLAN_LABEL[sub.plan]}
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
              تتجدّد في {hijriDayMonth(sub.expiresAt)} — تلقائيًا عبر Google Play
            </span>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-[10px]">
        <h2 className="m-0 font-heading text-[20px] leading-[1.5] font-bold">الباقات</h2>
        <span className="text-[12.5px] text-text-muted">الدفع عبر Google Play</span>
      </div>

      <div className="relative flex flex-col gap-[15px] rounded-px-28 border-[2.5px] border-primary bg-surface px-[20px] pt-[26px] pb-[20px] shadow-lesson-done-card">
        <span className="absolute -top-[13px] right-[22px] rounded-pill bg-primary px-[15px] py-[6px] text-[12px] font-extrabold text-surface">
          الأفضل قيمة
        </span>
        <h3 className="m-0 font-heading text-[22px] leading-[1.4] font-bold">الباقة السنوية</h3>
        <span className="flex items-baseline gap-[8px]">
          <span className="font-heading text-[46px] leading-[1] font-extrabold text-deep-green">
            {PRICE.annual}
          </span>
          <span className="text-[15px] font-bold text-text-muted">ريال / سنة</span>
        </span>
        <span className="self-start rounded-pill bg-gold-tint px-[13px] py-[7px] text-[13px] font-bold text-warning-text">
          أقل من ١٠ ريالات في الشهر
        </span>
        <span className="h-[1px] bg-border" />
        <PlanList items={PLANS.annual} text="text-[14.5px]" />
        {current === 'annual' ? (
          <CurrentChip />
        ) : (
          <a
            href="#m-get-app"
            className={buttonClass(
              'primary',
              'custom',
              'h-[56px] gap-[9px] rounded-px-19 font-heading text-[18px] font-bold',
            )}
          >
            {current === 'monthly' ? 'الترقية للسنوية' : 'اشترك من التطبيق'}
            <ForwardIcon size={20} />
          </a>
        )}
      </div>

      <div className="relative flex flex-col gap-[15px] rounded-px-28 border-[1.5px] border-border bg-surface px-[20px] pt-[26px] pb-[20px] shadow-lesson-done-card">
        <h3 className="m-0 font-heading text-[22px] leading-[1.4] font-bold">الباقة الشهرية</h3>
        <span className="flex items-baseline gap-[8px]">
          <span className="font-heading text-[46px] leading-[1] font-extrabold text-text-dark">
            {PRICE.monthly}
          </span>
          <span className="text-[15px] font-bold text-text-muted">ريال / شهر</span>
        </span>
        <span className="self-start rounded-pill bg-gold-tint px-[13px] py-[7px] text-[13px] font-bold text-warning-text">
          تجربة مرنة للبداية
        </span>
        <span className="h-[1px] bg-border" />
        <PlanList items={PLANS.monthly} text="text-[14.5px]" />
        {current === 'monthly' ? (
          <CurrentChip muted />
        ) : (
          <a
            href="#m-get-app"
            className={buttonClass(
              'plain',
              'custom',
              'h-[56px] rounded-px-19 font-heading text-[17px] font-bold',
            )}
          >
            {current === 'annual' ? 'التحويل إلى الشهرية' : 'اشترك من التطبيق'}
          </a>
        )}
      </div>

      <p className="m-0 text-center text-[13.5px] leading-[1.8] font-extrabold text-deep-green">
        يمكنك الترقية من الشهرية إلى السنوية في أي وقت
      </p>

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
      <div
        id="m-get-app"
        className="flex scroll-mt-[20px] flex-col gap-[14px] rounded-px-20 bg-border-soft px-[16px] py-[15px]"
      >
        <div className="flex items-start gap-[12px]">
          <span
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-px-11 border border-border-strong bg-surface"
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 3.5 L19 12 L6 20.5 Z" fill={C.playGlyph} />
            </svg>
          </span>
          <div className="flex flex-col gap-[4px]">
            <span className="text-[13.5px] font-bold">الاشتراك يُدار من Google Play</span>
            <span className="text-[12.5px] leading-[1.7] text-text-muted">
              لا نطلب بيانات بطاقة داخل التطبيق. يمكنك الإلغاء في أي وقت من إعدادات الاشتراكات في Play. الشراء
              والترقية من التطبيق على جوالك — المتصفح للمتابعة فقط.
            </span>
          </div>
        </div>
        <StoreBadges size={50} className="justify-center" />
      </div>
    </div>
  );
}

/** design/v3 PackagesLimit — a monthly parent tried to add a second child. */
function LimitBanner({ href }: { href: string }) {
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
            الباقة الشهرية لابن واحد
          </span>
          <span className="text-[14px] leading-[1.8] text-error-text">
            رقِّ إلى السنوية لتضيف كل أبنائك — بلا حدّ، وعلى نفس الاشتراك.
          </span>
        </span>
      </div>
      <a
        href={href}
        className={buttonClass(
          'primary',
          'custom',
          'h-[56px] gap-[9px] rounded-px-19 font-heading text-[18px] font-bold',
        )}
      >
        الترقية للسنوية
        <ForwardIcon size={20} />
      </a>
    </div>
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
