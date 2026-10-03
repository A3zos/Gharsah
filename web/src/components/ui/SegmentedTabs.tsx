import { useRef } from 'react';

import { useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: (selected: boolean) => React.ReactNode;
}

/** The pill tab track (03 «ولي الأمر / الطفل»). Arrow keys move between tabs. */
export function SegmentedTabs<T extends string>({
  segments,
  value,
  onChange,
  label,
  idPrefix,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { dir } = useI18n();
  const onKey = (e: React.KeyboardEvent, i: number) => {
    // The arrow pointing along the reading direction moves to the next tab (RTL: ArrowLeft).
    const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const prev = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step = e.key === fwd ? 1 : e.key === prev ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + segments.length) % segments.length;
    onChange(segments[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-[6px] rounded-tab-track bg-border-soft p-[5px]"
    >
      {segments.map((s, i) => {
        const selected = s.value === value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-tab-${s.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${s.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(s.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              'flex h-[52px] grow items-center justify-center gap-[8px] rounded-tab border-0 font-body text-[15px] font-extrabold',
              selected ? 'bg-surface text-deep-green shadow-tab' : 'bg-transparent text-text-muted',
            )}
          >
            {s.icon?.(selected)}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
