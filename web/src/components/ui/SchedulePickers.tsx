// Schedule controls of design/v2 Schedule / ScheduleCustom (and the ParentWebAddChild panel).
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { DURATIONS, formatTime, WEEK_DAYS, type WeekDay } from '../../data/children';
import { C } from './color';

/** «٤ أيام مختارة» / «يوم واحد مختار» / «يومان مختاران» / «لم تختر أيامًا بعد». */
export function daysCountText(n: number): string {
  if (n === 0) return 'لم تختر أيامًا بعد';
  if (n === 1) return 'يوم واحد مختار';
  if (n === 2) return 'يومان مختاران';
  return `${toArabicDigits(n)} أيام مختارة`;
}

/** ParentWebAddChild's one-letter day names. */
const LETTER: Record<WeekDay, string> = {
  sat: 'س',
  sun: 'ح',
  mon: 'ن',
  tue: 'ث',
  wed: 'ر',
  thu: 'خ',
  fri: 'ج',
};

/** Seven day toggles (46px circles; `wide` = the desktop's 58px letter circles). */
export function DayPicker({
  days,
  onToggle,
  wide,
  disabled,
}: {
  days: WeekDay[];
  onToggle: (d: WeekDay) => void;
  wide?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="أيام الحصص"
      className={cx('flex', wide ? 'gap-[8px]' : 'justify-between gap-[4px]')}
    >
      {WEEK_DAYS.map((d) => {
        const on = days.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            disabled={disabled}
            aria-label={d.label}
            aria-pressed={on}
            onClick={() => onToggle(d.id)}
            className={cx(
              'flex shrink-0 flex-col items-center justify-center rounded-full p-0 font-body',
              wide ? 'h-[58px] w-[58px] text-[15px] font-extrabold' : 'h-[46px] w-[46px] gap-[1px]',
              on
                ? wide
                  ? 'border-0 bg-primary text-surface'
                  : 'border-[2px] border-deep-green bg-deep-green text-surface'
                : wide
                  ? 'border-[1.5px] border-input-border bg-surface text-text-subtle'
                  : 'border-[1.5px] border-input-border bg-surface text-text-dark',
            )}
          >
            {wide ? (
              LETTER[d.id]
            ) : (
              <>
                {on && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12.5 L10 17.5 L19 7"
                      stroke={C.surface}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="text-[10.5px] leading-[1.2] font-bold">{d.short}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ClockGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" stroke={C.deepGreen} strokeWidth="1.9" />
      <path
        d="M12 7.6 V12 L15 13.8"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The time card with −/+ (quarter-hour steps). */
export function TimeStepper({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const btn =
    'flex h-[44px] w-[44px] items-center justify-center rounded-px-15 border-[1.5px] border-input-border bg-background';
  return (
    <div className="flex items-center gap-[12px] rounded-px-22 border-[1.5px] border-border bg-surface px-[14px] py-[12px]">
      <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 bg-green-tint">
        <ClockGlyph />
      </span>
      <output
        aria-live="polite"
        className="grow font-heading text-[26px] leading-[1.4] font-bold text-text-dark"
      >
        {formatTime(minutes)}
      </output>
      <div className="flex shrink-0 gap-[8px]">
        <button
          type="button"
          className={btn}
          onClick={() => onChange((minutes + 1425) % 1440)}
          aria-label="تقديم الوقت ربع ساعة"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 12 H18" stroke={C.textDark} strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => onChange((minutes + 15) % 1440)}
          aria-label="تأخير الوقت ربع ساعة"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 6 V18 M6 12 H18" stroke={C.textDark} strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** A row of equal choice chips (duration, age). */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  label,
  render,
  className,
  ariaFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  render: (v: T) => React.ReactNode;
  className: string;
  ariaFor?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-[10px]">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={ariaFor?.(o)}
            onClick={() => onChange(o)}
            className={cx(
              'grow',
              className,
              on
                ? 'border-[2px] border-deep-green bg-green-tint text-deep-green'
                : 'border-[1.5px] border-input-border bg-surface text-text-dark',
            )}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

export function DurationChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (d: (typeof DURATIONS)[number]) => void;
}) {
  return (
    <ChoiceChips
      label="الحدّ الأقصى للحصة اليومية"
      options={DURATIONS}
      value={value as (typeof DURATIONS)[number]}
      onChange={onChange}
      render={(n) => `${toArabicDigits(n)} دقيقة`}
      className="h-[54px] rounded-px-18 font-body text-[15px] font-bold"
    />
  );
}
