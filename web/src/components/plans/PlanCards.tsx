// The three plans in ONE row (RTL: the pilot first, on the right → monthly →
// yearly) — shared by the landing pricing section and the parent plans page so
// they never drift. A grid of three equal columns (gap 24px, ≤1100px, centered)
// whenever its container is ≥900px wide (a container query, so the parent page's
// sidebar is accounted for); narrower → stacked, pilot first. One internal layout
// (badge, title, price, tag pill, features, button at the bottom); equal heights.
// The copy follows the landing language (src/i18n); the parent page has no provider,
// so it stays Arabic. LTR mirrors the row (the pilot on the left).
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { pilotCopy } from '../../content/pilot';
import { ANNUAL_MONTHLY_UNDER, PRICE_SAR } from '../../content/plans';
import { fill, formatNumber, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { PILOT_BUTTON } from './pilotButton';
import { PlanList } from '../landing/shared';

export function PlanCards({ pilotAction }: { pilotAction: React.ReactNode }) {
  const { lang, m } = useI18n();
  const p = m.plans;
  const pilot = pilotCopy(lang);
  return (
    <div className="@container w-full">
      <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 justify-items-center gap-[24px] @min-[900px]:grid-cols-[repeat(3,minmax(0,1fr))] @min-[900px]:justify-items-stretch">
        <PlanCard
          featured
          badge={p.available}
          title={pilot.name}
          price={pilot.price}
          tag={pilot.tag}
          items={pilot.items}
          extra={
            <ol className="m-0 flex flex-col gap-[4px] ps-[18px] text-[13px] leading-[1.7] text-text-muted">
              {pilot.days.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ol>
          }
          action={pilotAction}
        />
        <PlanCard
          badge={p.soon}
          title={p.monthly.name}
          price={formatNumber(lang, PRICE_SAR.monthly)}
          per={p.monthly.per}
          tag={p.monthly.tag}
          items={p.monthly.items}
          action={<SoonButton label={p.soon} />}
        />
        <PlanCard
          badge={p.soon}
          title={p.annual.name}
          price={formatNumber(lang, PRICE_SAR.annual)}
          per={p.annual.per}
          tag={fill(lang, p.annual.tag, { n: ANNUAL_MONTHLY_UNDER })}
          items={p.annual.items}
          action={<SoonButton label={p.soon} />}
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
        'relative flex w-full max-w-[360px] min-w-0 flex-col gap-[14px] rounded-px-28 bg-surface px-[22px] pt-[32px] pb-[22px] @min-[900px]:max-w-none',
        featured
          ? 'border-[1.5px] border-primary shadow-primary-16-34-12 ring-1 ring-primary'
          : 'border-[1.5px] border-border opacity-80',
      )}
    >
      <span
        className={cx(
          'absolute start-[24px] -top-[14px] rounded-pill px-[15px] py-[6px] text-[12.5px] font-extrabold',
          featured ? 'bg-primary text-surface' : 'bg-gold-tint text-warning-text',
        )}
      >
        {badge}
      </span>
      <h3 className="m-0 font-heading text-[22px] leading-[1.4] font-bold">{title}</h3>
      <span className="flex min-h-[40px] flex-wrap items-baseline gap-x-[8px] gap-y-[2px]">
        <span
          className={cx(
            'font-heading text-[40px] leading-[1] font-extrabold',
            featured ? 'text-deep-green' : 'text-text-dark',
          )}
        >
          {price}
        </span>
        {per && <span className="text-[15px] font-bold text-text-muted">{per}</span>}
      </span>
      {/* Wraps neatly in a narrow column (rounded box, not a stretched pill). */}
      <span className="max-w-full self-start rounded-px-14 bg-gold-tint px-[13px] py-[6px] text-[13px] leading-[1.6] font-bold text-warning-text">
        {tag}
      </span>
      <span className="h-[1px] bg-border" aria-hidden="true" />
      <PlanList items={items} text="text-[15px]" gap="gap-[10px]" />
      {extra}
      <div className="mt-auto flex flex-col pt-[6px]">{action}</div>
    </section>
  );
}

/** Not on sale yet: a disabled ghost button. */
function SoonButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex h-[54px] w-full cursor-not-allowed items-center justify-center rounded-px-20 border-[1.5px] border-input-border bg-transparent font-heading text-[17px] font-bold text-text-muted"
    >
      {label}
    </button>
  );
}

/** Landing: «ابدأ مجانًا» → sign up (signing up starts the free pilot). */
export function PilotSignupLink() {
  const { m } = useI18n();
  return (
    <Link to={paths.signup} className={PILOT_BUTTON}>
      {m.plans.pilot.cta}
    </Link>
  );
}
