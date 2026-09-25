import { Link } from 'react-router';

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
import { hijriDate } from '../../lib/dates';
import type { Route } from './+types/plans';

export const meta: Route.MetaFunction = () => [{ title: 'الباقات — غَرْسة' }];

const PRICE = { annual: '١١٩', monthly: '٢٩' } as const;
const FEATURES = ['حصة يومية كاملة', 'أبناء بلا حدّ', 'لوحة متابعة وتسجيلات المشاريع'];

/**
 * design/v2 ParentWebPlans (desktop) / Packages (phone). The web never sells:
 * Google Play Billing lives in the Android app (CLAUDE.md §3), so every buy /
 * renew button says «… من التطبيق» and points to the app download.
 */
export default function PlansRoute() {
  const { children, subscription } = useParentData();
  const sub = subscription && isSubscribed(subscription) ? subscription : null;
  const count = children?.length ?? 0;
  return (
    <ParentPage
      tab="plans"
      desktop={<Desktop sub={sub} count={count} />}
      mobile={<Mobile sub={sub} count={count} />}
      mobileDecor={false}
    />
  );
}

function PlayBadgeSmall() {
  return (
    <a
      href="#get-app"
      className="flex h-[54px] shrink-0 items-center gap-[11px] rounded-px-17 bg-text-dark px-[22px] text-surface no-underline hover:text-surface"
    >
      <PlayGlyph />
      <span className="flex flex-col gap-[1px] leading-[1.25]">
        <span className="text-[11px] text-voice-bar-off">حمّل التطبيق من</span>
        <span className="text-[16px] font-extrabold" dir="ltr">
          Google Play
        </span>
      </span>
    </a>
  );
}

function Features({ size = 15 }: { size?: number }) {
  return (
    <>
      <div className="h-[1px] bg-border" />
      <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-[10px]" style={{ fontSize: size }}>
            <CheckIcon size={19} />
            {f}
          </li>
        ))}
      </ul>
    </>
  );
}

function Desktop({ sub, count }: { sub: Subscription | null; count: number }) {
  return (
    <div className="flex grow flex-col gap-[24px]">
      <DesktopHeader
        title="الباقات"
        subtitle="اشتراك واحد يكفي جميع أبنائك · الدفع والإلغاء عبر Google Play"
      />
      <div className="flex items-center gap-[18px] rounded-px-24 border-[1.5px] border-gold-border bg-gold-tint px-[24px] py-[18px]">
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
        <PlayBadgeSmall />
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
                  تجربة مرنة · تلغيها متى شئت
                </span>
              )}
              <Features />
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
                  <PlayGlyph color="textDark" />
                  اشترك من التطبيق
                </a>
              )}
            </div>
          );
        })}
      </div>
      <div id="get-app" className="flex grow items-end gap-[20px]">
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

function SmallCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={C.greenTint} />
      <path
        d="M7 12.5 L10.5 16 L17 8.5"
        stroke={C.deepGreen}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Mobile({ sub, count }: { sub: Subscription | null; count: number }) {
  return (
    <div className="flex flex-col gap-[22px] pt-[4px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <SproutBadge size={40} />
          <h1 className="m-0 font-heading text-[26px] leading-[1.5] font-bold">الباقات</h1>
        </div>
        <SettingsButton />
      </div>
      {/* TODO(design): no designed "no subscription yet" hero; the card only shows with an active plan. */}
      {sub && (
        <div className="relative flex flex-col gap-[16px] overflow-hidden rounded-px-28 bg-deep-green px-[20px] pt-[22px] pb-[20px]">
          <div
            aria-hidden="true"
            className="absolute -top-[40px] -left-[30px] h-[150px] w-[150px] rounded-full bg-hero-circle"
          />
          <div className="flex items-center justify-between">
            <span className="font-heading text-[19px] leading-[1.5] font-bold text-surface">
              باقتك الحالية — {PLAN_LABEL[sub.plan]}
            </span>
            <span className="rounded-pill bg-gold px-[12px] py-[5px] text-[12px] font-extrabold text-on-gold">
              نشطة
            </span>
          </div>
          <div className="flex items-baseline gap-[8px]">
            <span className="font-heading text-[46px] leading-[1.1] font-extrabold text-gold">
              {toArabicDigits(daysLeft(sub))}
            </span>
            <span className="text-[15px] font-medium text-on-deep-green-muted">يومًا متبقية</span>
          </div>
          <div className="flex flex-col gap-[8px]">
            <div className="h-[10px] overflow-hidden rounded-px-6 bg-hero-track">
              <div
                className="h-full rounded-px-6 bg-gold"
                style={{ width: `${Math.round(remainingFraction(sub) * 100)}%` }}
              />
            </div>
            <span className="text-[12.5px] text-on-deep-green-muted">
              تنتهي في {hijriDate(sub.expiresAt)} — ثم تتجدد تلقائيًا عبر Google Play
            </span>
          </div>
          <a
            href="#m-get-app"
            className={buttonClass(
              'gold',
              'custom',
              'h-[52px] gap-[9px] rounded-px-18 text-[16px] font-extrabold',
            )}
          >
            <PlayGlyph color="onGold" />
            جدّد من التطبيق
          </a>
        </div>
      )}
      <div className="flex flex-col gap-[14px]">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 font-heading text-[20px] leading-[1.5] font-bold">
            {sub ? 'تغيير الباقة' : 'اختر باقة'}
          </h2>
          <span className="text-[12.5px] text-text-muted">الدفع عبر Google Play</span>
        </div>
        <div className="relative flex flex-col gap-[14px] rounded-px-26 border-[2px] border-primary bg-surface px-[18px] pt-[22px] pb-[18px] shadow-plan-card">
          <span className="absolute -top-[13px] right-[20px] rounded-pill bg-gold px-[14px] py-[6px] text-[12px] font-extrabold text-on-gold">
            الأفضل قيمة
          </span>
          <div className="flex items-start justify-between gap-[12px]">
            <div className="flex flex-col gap-[4px]">
              <span className="font-heading text-[19px] leading-[1.5] font-bold">سنوية</span>
              <span className="text-[12.5px] text-text-muted">≈ ١٠ ريال شهريًا · وفّر ٦٦٪</span>
            </div>
            <div className="flex items-baseline gap-[4px]">
              <span className="font-heading text-[30px] leading-[1.2] font-extrabold text-deep-green">
                ١١٩
              </span>
              <span className="text-[13px] font-bold text-text-muted">ريال / سنة</span>
            </div>
          </div>
          <div className="flex flex-col gap-[9px]">
            {['أبناء غير محدودين على الحساب', 'تقارير الإنجازات الكاملة'].map((t) => (
              <div key={t} className="flex items-center gap-[9px]">
                <SmallCheck />
                <span className="text-[13.5px] text-text-dark">{t}</span>
              </div>
            ))}
          </div>
          {sub?.plan === 'annual' ? (
            <span className="flex h-[50px] items-center justify-center rounded-px-17 bg-green-tint text-[16px] font-bold text-deep-green">
              باقتك الحالية
            </span>
          ) : (
            <a
              href="#m-get-app"
              className={buttonClass(
                'primary',
                'custom',
                'h-[50px] gap-[9px] rounded-px-17 text-[16px] font-bold',
              )}
            >
              <PlayGlyph />
              اشترك من التطبيق
            </a>
          )}
        </div>
        <div className="flex items-center justify-between gap-[12px] rounded-px-26 border-[1.5px] border-border bg-surface p-[18px]">
          <div className="flex flex-col gap-[4px]">
            <span className="font-heading text-[18px] leading-[1.5] font-bold">شهرية</span>
            <div className="flex items-baseline gap-[4px]">
              <span className="font-heading text-[24px] leading-[1.2] font-extrabold text-text-dark">٢٩</span>
              <span className="text-[12.5px] font-bold text-text-muted">ريال / شهر</span>
            </div>
          </div>
          {sub?.plan === 'monthly' ? (
            <span className="flex h-[48px] items-center rounded-px-16 bg-green-tint px-[18px] text-[14px] font-bold text-deep-green">
              باقتك الحالية
            </span>
          ) : (
            <a
              href="#m-get-app"
              className="flex h-[48px] items-center justify-center rounded-px-16 border-[1.5px] border-deep-green bg-surface px-[14px] text-[13.5px] font-bold whitespace-nowrap text-deep-green no-underline"
            >
              اشترك من التطبيق
            </a>
          )}
        </div>
      </div>
      <Link
        to={paths.parent.addChild}
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
          <span className="text-[12.5px] text-text-muted">{childrenCount(count)} · رموز الربط والإدارة</span>
        </span>
        <ForwardIcon size={20} color="deepGreen" strokeWidth={2.3} />
      </Link>
      <div
        id="m-get-app"
        className="flex items-start gap-[12px] rounded-px-20 bg-border-soft px-[16px] py-[15px]"
      >
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
            الشراء غير متاح في المتصفح — حمّل التطبيق على جوالك لإكمال الاشتراك. لا نطلب بيانات بطاقة، ويمكنك
            الإلغاء في أي وقت من إعدادات الاشتراكات في Play.
          </span>
        </div>
      </div>
    </div>
  );
}
