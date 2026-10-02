// The three plans, side by side (RTL: the pilot first, on the right → monthly →
// yearly) — shared by the landing pricing section and the parent plans page so
// they never drift. Equal widths (≤360px) and heights, one internal layout
// (badge, title, price, tag pill, features, button at the bottom). The row needs
// ~720px of its container (a container query, so the parent page's sidebar is
// accounted for); narrower → stacked, pilot first.
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { PILOT_CTA, PILOT_DAYS, PILOT_ITEMS, PILOT_NAME, PILOT_PRICE } from '../../content/pilot';
import { PLANS, PRICE } from '../../content/plans';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { PILOT_BUTTON } from './pilotButton';
import { PlanList } from '../landing/shared';

export function PlanCards({ pilotAction }: { pilotAction: React.ReactNode }) {
  return (
    <div className="@container w-full">
      <div className="mx-auto flex w-full flex-col items-center gap-[24px] @min-[720px]:flex-row @min-[720px]:items-stretch @min-[720px]:justify-center">
        <PlanCard
          featured
          badge="متاحة الآن"
          title={PILOT_NAME}
          price={PILOT_PRICE}
          tag={`${toArabicDigits(PILOT_DAYS.length)} أيام — يومًا بعد يوم`}
          items={PILOT_ITEMS}
          extra={
            <ol className="m-0 flex flex-col gap-[4px] ps-[18px] text-[13px] leading-[1.7] text-text-muted">
              {PILOT_DAYS.map((d) => (
                <li key={d.lessonId}>
                  اليوم {toArabicDigits(d.day)}: سورة {d.surahName} + {d.hadithTitle}
                </li>
              ))}
            </ol>
          }
          action={pilotAction}
        />
        <PlanCard
          badge="قريبًا"
          title="الباقة الشهرية"
          price={PRICE.monthly}
          per="ريال / شهر"
          tag="تجربة مرنة للبداية"
          items={PLANS.monthly}
          action={<SoonButton />}
        />
        <PlanCard
          badge="قريبًا"
          title="الباقة السنوية"
          price={PRICE.annual}
          per="ريال / سنة"
          tag="أقل من ١٠ ريالات في الشهر"
          items={PLANS.annual}
          action={<SoonButton />}
        />
      </div>
    </div>
  );
}

function PlanCard({
  featured = false,
  badge,
  title,
  price,
  per,
  tag,
  items,
  extra,
  action,
}: {
  featured?: boolean;
  badge: string;
  title: string;
  price: string;
  per?: string;
  tag: string;
  items: readonly string[];
  extra?: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      aria-disabled={featured ? undefined : true}
      className={cx(
        'relative flex w-full max-w-[360px] min-w-0 flex-col gap-[14px] rounded-px-28 bg-surface px-[24px] pt-[32px] pb-[24px] @min-[720px]:flex-1 @min-[720px]:basis-0',
        featured
          ? 'border-[1.5px] border-primary shadow-primary-16-34-12 ring-1 ring-primary'
          : 'border-[1.5px] border-border opacity-80',
      )}
    >
      <span
        className={cx(
          'absolute -top-[14px] right-[24px] rounded-pill px-[15px] py-[6px] text-[12.5px] font-extrabold',
          featured ? 'bg-primary text-surface' : 'bg-gold-tint text-warning-text',
        )}
      >
        {badge}
      </span>
      <h3 className="m-0 font-heading text-[22px] leading-[1.4] font-bold">{title}</h3>
      <span className="flex min-h-[46px] items-baseline gap-[8px]">
        <span
          className={cx(
            'font-heading text-[46px] leading-[1] font-extrabold',
            featured ? 'text-deep-green' : 'text-text-dark',
          )}
        >
          {price}
        </span>
        {per && <span className="text-[15px] font-bold text-text-muted">{per}</span>}
      </span>
      <span className="self-start rounded-pill bg-gold-tint px-[13px] py-[7px] text-[13px] font-bold text-warning-text">
        {tag}
      </span>
      <span className="h-[1px] bg-border" aria-hidden="true" />
      <PlanList items={items} text="text-[14.5px]" gap="gap-[10px]" />
      {extra}
      <div className="mt-auto flex flex-col pt-[6px]">{action}</div>
    </section>
  );
}

/** Not on sale yet: a disabled ghost button. */
function SoonButton() {
  return (
    <button
      type="button"
      disabled
      className="flex h-[54px] w-full cursor-not-allowed items-center justify-center rounded-px-20 border-[1.5px] border-input-border bg-transparent font-heading text-[17px] font-bold text-text-muted"
    >
      قريبًا
    </button>
  );
}

/** Landing: «ابدأ مجانًا» → sign up (signing up starts the free pilot). */
export function PilotSignupLink() {
  return (
    <Link to={paths.signup} className={PILOT_BUTTON}>
      {PILOT_CTA}
    </Link>
  );
}
