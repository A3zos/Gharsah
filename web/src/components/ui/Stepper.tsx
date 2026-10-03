import { Fragment } from 'react';

import { formatNumber, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { C } from './color';

/** The phone frames' step pills (AddChild → Schedule → AvatarPicker). `current` is 0-based. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const { lang, m } = useI18n();
  return (
    <ol aria-label={m.parent.stepper.label} className="m-0 flex list-none items-center gap-[6px] p-0">
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && <li aria-hidden="true" className="h-[2px] grow rounded-px-2 bg-border-strong" />}
            <li
              aria-current={on ? 'step' : undefined}
              className={cx(
                'flex h-[38px] shrink-0 items-center gap-[7px] rounded-px-13 px-[12px] text-[12.5px] font-bold',
                on ? 'bg-green-tint text-deep-green' : 'bg-border-soft text-text-muted',
              )}
            >
              {done ? (
                <span
                  className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full bg-primary"
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12.5 L10 17.5 L19 7"
                      stroke={C.surface}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : (
                <span
                  className={cx(
                    'flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-extrabold',
                    on ? 'bg-deep-green text-surface' : 'bg-border-strong text-text-muted',
                  )}
                >
                  {formatNumber(lang, i + 1)}
                </span>
              )}
              {label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** ParentWebAddChild's step bar (38px circles, gold = current). */
export function StepperWide({ steps, current }: { steps: string[]; current: number }) {
  const { lang, m } = useI18n();
  return (
    <ol
      aria-label={m.parent.stepper.label}
      className="m-0 flex list-none items-center gap-[28px] rounded-px-26 bg-surface px-[28px] py-[20px] shadow-dark-12-26-4"
    >
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && <li aria-hidden="true" className="h-[2px] grow bg-border" />}
            <li aria-current={on ? 'step' : undefined} className="flex items-center gap-[11px]">
              <span
                className={cx(
                  'flex h-[38px] w-[38px] items-center justify-center rounded-full font-heading text-[16px] font-extrabold',
                  on
                    ? 'bg-gold text-on-gold'
                    : done
                      ? 'bg-primary text-surface'
                      : 'border-[1.5px] border-input-border bg-surface text-text-subtle',
                )}
              >
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12.5 L10 17.5 L19 7"
                      stroke={C.surface}
                      strokeWidth="3.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  formatNumber(lang, i + 1)
                )}
              </span>
              <span
                className={cx(
                  'text-[15.5px] font-extrabold',
                  on ? 'text-warning-text' : done ? 'text-deep-green' : 'text-text-subtle',
                )}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
