// بذرة ← غَرْسة ← شجرة (seed on the right in RTL — drawn LTR like the frames).
// Passed stages: green tint; the current stage: gold ring; later stages: grey.
import type { Stage } from '../../data/stats';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';

const ORDER: Stage[] = ['seed', 'sprout', 'tree'];
const LABEL: Record<Stage, string> = { seed: 'بذرة', sprout: 'غَرْسة', tree: 'شجرة' };

function Art({ stage, on, size }: { stage: Stage; on: boolean; size: number }) {
  const stem = on ? C.deepGreen : C.textSubtle;
  if (stage === 'seed') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="14" rx="6" ry="7.5" fill={on ? C.primary : C.voiceBarOff} />
        <path d="M12 9 C12 6 13.5 4 16 3.5" stroke={stem} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (stage === 'sprout') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 21 V11" stroke={stem} strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M12 15 C8 15 5.5 12.5 5.5 8.5 C9.5 8.5 12 11 12 15 Z"
          fill={on ? C.primary : C.voiceBarOff}
        />
        <path
          d="M12 13 C16 13 18.5 10.5 18.5 6.5 C14.5 6.5 12 9 12 13 Z"
          fill={on ? C.softGreen : C.voiceBarOff}
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 21 V13" stroke={stem} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="6" fill={on ? C.primary : C.voiceBarOff} />
    </svg>
  );
}

/**
 * The stage path with the plan progress bar under it. `size`: ChildProfile's
 * 52px circles, or the web dashboard's 74px (ParentWebDash).
 */
export function GrowthPath({ stage, pct, size = 52 }: { stage: Stage; pct: number; size?: 52 | 74 }) {
  const at = ORDER.indexOf(stage);
  const big = size === 74;
  return (
    <>
      <ol
        className={cx('m-0 flex list-none items-start p-0 [direction:ltr]', big ? 'gap-[10px]' : 'gap-[6px]')}
        aria-label={`مرحلتك: ${LABEL[stage]}`}
      >
        {ORDER.map((s, i) => {
          const current = i === at;
          const passed = i < at;
          return (
            <li
              key={s}
              aria-current={current ? 'step' : undefined}
              className={cx('flex grow basis-0 flex-col items-center', big ? 'gap-[10px]' : 'gap-[8px]')}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex items-center justify-center rounded-full',
                  big ? 'h-[74px] w-[74px]' : 'h-[52px] w-[52px]',
                  current
                    ? 'border-[2.5px] border-gold bg-gold-tint'
                    : passed
                      ? 'bg-green-tint'
                      : 'bg-border-soft',
                )}
              >
                <Art stage={s} on={i <= at} size={big ? (s === 'seed' ? 34 : 38) : s === 'seed' ? 28 : 30} />
              </span>
              <span
                className={cx(
                  big ? 'text-[14px] font-extrabold' : 'text-[12.5px] font-extrabold',
                  current ? 'text-warning-text' : passed ? 'text-deep-green' : 'text-text-subtle',
                )}
              >
                {LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
      <div
        className={cx('overflow-hidden rounded-px-5 bg-border [direction:ltr]', big ? 'h-[10px]' : 'h-[9px]')}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="من الباقة التجريبية"
      >
        <span
          className={cx('block rounded-px-5 bg-primary', big ? 'h-[10px]' : 'h-[9px]')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );
}
