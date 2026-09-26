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

/** ChildProfile's «مرحلتك» path (52px circles) with the plan progress bar under it. */
export function GrowthPath({ stage, pct }: { stage: Stage; pct: number }) {
  const at = ORDER.indexOf(stage);
  return (
    <>
      <ol
        className="m-0 flex list-none items-start gap-[6px] p-0 [direction:ltr]"
        aria-label={`مرحلتك: ${LABEL[stage]}`}
      >
        {ORDER.map((s, i) => {
          const current = i === at;
          const passed = i < at;
          return (
            <li
              key={s}
              aria-current={current ? 'step' : undefined}
              className="flex grow basis-0 flex-col items-center gap-[8px]"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'flex h-[52px] w-[52px] items-center justify-center rounded-full',
                  current
                    ? 'border-[2.5px] border-gold bg-gold-tint'
                    : passed
                      ? 'bg-green-tint'
                      : 'bg-border-soft',
                )}
              >
                <Art stage={s} on={i <= at} size={s === 'seed' ? 28 : 30} />
              </span>
              <span
                className={cx(
                  'text-[12.5px] font-extrabold',
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
        className="h-[9px] overflow-hidden rounded-px-5 bg-border [direction:ltr]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="من خطة السنة"
      >
        <span className="block h-[9px] rounded-px-5 bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}
