// The pilot plan on the parent dashboard: «الباقة التجريبية · مجانًا», the child's
// progress (days done out of 3) and the three days — each day's surah + hadith,
// marked done / today / later. TODO(design): no designed pilot card yet.
import { PILOT_DAYS, PILOT_NAME, PILOT_PRICE } from '../../content/pilot';
import type { ChildProfile } from '../../data/children';
import { pilotPct } from '../../data/stats';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';

export function PilotPlanCard({ child }: { child: ChildProfile }) {
  const done = Math.min(PILOT_DAYS.length, child.pilotDaysDone);
  const pct = pilotPct(done);
  return (
    <section
      aria-label={PILOT_NAME}
      className="flex flex-col gap-[14px] rounded-px-24 border-[1.5px] border-border bg-surface px-[20px] py-[18px]"
    >
      <div className="flex items-center justify-between gap-[10px]">
        <h2 className="m-0 font-heading text-[19px] leading-[1.4] font-bold">{PILOT_NAME}</h2>
        <span className="rounded-pill bg-green-tint px-[13px] py-[6px] text-[13px] font-extrabold text-deep-green">
          {PILOT_PRICE}
        </span>
      </div>
      <div className="flex flex-col gap-[7px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <span className="text-[13.5px] font-bold text-text-muted">
            أنجز {toArabicDigits(done)} من {toArabicDigits(PILOT_DAYS.length)} أيام
          </span>
          <span className="font-heading text-[16px] font-extrabold text-deep-green">
            {toArabicDigits(pct)}٪
          </span>
        </div>
        <div
          className="h-[9px] overflow-hidden rounded-px-5 bg-border-soft"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={PILOT_DAYS.length}
          aria-label="أيام الباقة التجريبية"
        >
          <span className="block h-[9px] rounded-px-5 bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="m-0 flex list-none flex-col gap-[8px] p-0">
        {PILOT_DAYS.map((d, i) => {
          const state = i < done ? 'done' : i === done ? 'today' : 'later';
          return (
            <li
              key={d.lessonId}
              className={cx(
                'flex items-center gap-[11px] rounded-px-18 px-[12px] py-[10px]',
                state === 'today' ? 'bg-gold-tint' : 'bg-background',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-heading text-[15px] font-extrabold',
                  state === 'done' ? 'bg-primary text-surface' : 'bg-surface text-text-muted',
                )}
              >
                {state === 'done' ? '✓' : toArabicDigits(d.day)}
              </span>
              <span className="flex min-w-0 grow flex-col gap-[2px]">
                <span className="text-[14.5px] font-extrabold">
                  اليوم {toArabicDigits(d.day)}: سورة {d.surahName}
                </span>
                <span className="text-[13px] text-text-muted">{d.hadithTitle}</span>
              </span>
              <span
                className={cx(
                  'shrink-0 text-[12.5px] font-extrabold',
                  state === 'done'
                    ? 'text-deep-green'
                    : state === 'today'
                      ? 'text-warning-text'
                      : 'text-text-muted',
                )}
              >
                {state === 'done' ? 'مكتمل' : state === 'today' ? 'الحالي' : 'لاحقًا'}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
