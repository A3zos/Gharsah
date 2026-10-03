import { useRef } from 'react';

import { cx } from '../../lib/cx';
import { normalizeDigit } from '../../lib/arabicDigits';
import { fill, useI18n } from '../../i18n/i18n';

export const CODE_LENGTH = 6;

/**
 * The six pairing-code cells (03 child tab). Shows Arabic-Indic digits, accepts
 * any digit keyboard, auto-advances, Backspace goes back, paste fills all cells.
 * `value` is six Arabic-Indic digits or '' per cell.
 */
export function CodeInput({
  value,
  onChange,
  invalid,
  disabled,
  label,
  onComplete,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  disabled?: boolean;
  label: string;
  onComplete?: (cells: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const { lang, m } = useI18n();
  const focus = (i: number) => refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();

  const setFrom = (start: number, digits: string[]) => {
    const next = [...value];
    let i = start;
    for (const d of digits) {
      if (i >= CODE_LENGTH) break;
      next[i++] = d;
    }
    onChange(next);
    focus(i);
    if (next.every(Boolean)) onComplete?.(next);
  };

  return (
    <div className="flex justify-center gap-[8px] [direction:ltr]">
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={i === 0 ? 'code-cell-1' : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={CODE_LENGTH}
          disabled={disabled}
          aria-label={fill(lang, m.common.codeCell, {
            ordinal: m.common.ordinals[i] ?? String(i + 1),
            label,
          })}
          aria-invalid={invalid || undefined}
          value={value[i] ?? ''}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = [...e.currentTarget.value].map(normalizeDigit).filter((d): d is string => !!d);
            if (!digits.length) {
              const next = [...value];
              next[i] = '';
              onChange(next);
              return;
            }
            // Typing over a filled cell: keep the newest digit; paste: spread them.
            setFrom(i, digits.length > 1 && value[i] ? digits.slice(1) : digits);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              e.preventDefault();
              const next = [...value];
              next[i - 1] = '';
              onChange(next);
              focus(i - 1);
            } else if (e.key === 'ArrowLeft') focus(i - 1);
            else if (e.key === 'ArrowRight') focus(i + 1);
          }}
          onPaste={(e) => {
            const digits = [...e.clipboardData.getData('text')]
              .map(normalizeDigit)
              .filter((d): d is string => !!d);
            if (!digits.length) return;
            e.preventDefault();
            setFrom(0, digits.slice(0, CODE_LENGTH));
          }}
          className={cx(
            'h-[64px] w-[46px] rounded-code-cell border-[1.5px] bg-surface text-center font-heading text-[26px] font-extrabold text-deep-green',
            invalid ? 'border-berry' : 'border-input-border',
          )}
        />
      ))}
    </div>
  );
}
