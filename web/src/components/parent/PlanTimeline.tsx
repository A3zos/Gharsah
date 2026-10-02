// The child's current plan as a timeline (data/planProgress.ts): each step with its
// state — مكتمل (check + date) / اليوم (pulsing) / فاته (amber) / مقفل («يُفتح غدًا»),
// joined by a line that is green up to the current step — then the progress bar and
// sentence. Horizontal on desktop, vertical on phones; RTL (step 1 on the right / top).
// TODO(design): no designed plan timeline yet.
import type { PlanProgress, TimelineStep } from '../../data/planProgress';
import { planSentence } from '../../data/planProgress';
import { STAGE_LABEL, type Stage } from '../../data/stats';
import { cx } from '../../lib/cx';
import { hijriDayMonth } from '../../lib/dates';
import { CheckIcon } from '../ui/icons';
import { C } from '../ui/color';

export function PlanTimeline({
  progress: p,
  vertical = false,
  unscored = [],
  compact = false,
}: {
  progress: PlanProgress;
  vertical?: boolean;
  /** Steps whose hadith question was answered on the device only — «لم يُقيَّم». */
  unscored?: readonly string[];
  /** The children page: no bar/sentence (the card shows its own). */
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[16px]">
      <ol
        aria-label={`خطة ${p.plan.name}`}
        className={cx('m-0 list-none p-0', vertical ? 'flex flex-col gap-[14px]' : 'grid gap-[8px]')}
        style={vertical ? undefined : { gridTemplateColumns: `repeat(${p.steps.length}, minmax(0, 1fr))` }}
      >
        {p.steps.map((s, i) => (
          <Step
            key={s.id}
            step={s}
            vertical={vertical}
            // the line to the next step is green once this one is done
            line={i < p.steps.length - 1 ? (s.state === 'done' ? 'on' : 'off') : null}
            unscored={unscored.includes(s.id)}
            compact={compact}
          />
        ))}
      </ol>
      {!compact && <PlanBar progress={p} />}
    </div>
  );
}

/** The bar + «أتمّ ١ من ٣ أيام (٣٣٪) من الباقة التجريبية». */
export function PlanBar({ progress: p }: { progress: PlanProgress }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <div
        className="h-[9px] overflow-hidden rounded-px-5 bg-border-soft"
        role="progressbar"
        aria-valuenow={p.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`من ${p.plan.name}`}
      >
        <span
          className="block h-[9px] rounded-px-5 bg-primary transition-[width] duration-500"
          style={{ width: `${p.pct}%` }}
        />
      </div>
      <span className="text-[13.5px] font-bold text-text-muted">{planSentence(p)}</span>
    </div>
  );
}

/** بذرة / غَرْسة / شجرة — a small badge next to the child's name. */
export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="shrink-0 rounded-pill bg-green-tint px-[11px] py-[4px] text-[12px] font-extrabold text-deep-green">
      {STAGE_LABEL[stage]}
    </span>
  );
}

const STATE_TEXT: Record<TimelineStep['state'], string> = {
  done: 'مكتمل',
  today: 'اليوم',
  missed: 'فاته يوم — متاح الآن',
  locked: 'مقفل',
};

function Step({
  step: s,
  vertical,
  line,
  unscored,
  compact,
}: {
  step: TimelineStep;
  vertical: boolean;
  line: 'on' | 'off' | null;
  unscored: boolean;
  compact: boolean;
}) {
  const label =
    s.state === 'done' && s.doneAt
      ? `مكتمل · ${hijriDayMonth(s.doneAt)}`
      : s.state === 'locked' && s.tomorrow
        ? 'يُفتح غدًا'
        : STATE_TEXT[s.state];
  const ink =
    s.state === 'done'
      ? 'text-deep-green'
      : s.state === 'today'
        ? 'text-primary'
        : s.state === 'missed'
          ? 'text-warning-text'
          : 'text-text-muted';
  const text = (
    <span className={cx('flex min-w-0 flex-col gap-[2px]', !vertical && 'items-center text-center')}>
      <span className={cx('font-extrabold', compact ? 'text-[13px]' : 'text-[14.5px]')}>{s.title}</span>
      <span className={cx('text-text-muted', compact ? 'text-[11.5px]' : 'text-[12.5px]', 'leading-[1.6]')}>
        {s.detail}
      </span>
      <span className={cx('font-extrabold', compact ? 'text-[11.5px]' : 'text-[12.5px]', ink)}>{label}</span>
      {unscored && <span className="text-[11.5px] font-bold text-warning-text">سؤال الحديث: لم يُقيَّم</span>}
    </span>
  );
  return (
    <li
      aria-current={s.state === 'today' || s.state === 'missed' ? 'step' : undefined}
      className={cx(
        'relative flex rounded-px-18',
        vertical
          ? 'items-start gap-[12px] px-[10px] py-[10px]'
          : 'flex-col items-center gap-[8px] px-[4px] py-[8px]',
        s.state === 'today' && 'bg-green-tint',
        s.state === 'missed' && 'bg-gold-tint',
      )}
    >
      {line && (
        // to the next step: left in a row (RTL), down in a column
        <span
          aria-hidden="true"
          className={cx(
            'absolute rounded-full',
            line === 'on' ? 'bg-primary' : 'bg-border',
            vertical
              ? 'top-[47px] right-[25.5px] h-[calc(100%-26px)] w-[3px]'
              : 'top-[23.5px] right-[calc(50%+20px)] h-[3px] w-[calc(100%-32px)]',
          )}
        />
      )}
      <Dot state={s.state} />
      {text}
    </li>
  );
}

function Dot({ state }: { state: TimelineStep['state'] }) {
  const box = 'relative z-1 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full';
  if (state === 'done')
    return (
      <span className={cx(box, 'bg-primary')} aria-hidden="true">
        <CheckIcon size={17} color="surface" strokeWidth={3.4} />
      </span>
    );
  if (state === 'today')
    return (
      <span className={cx(box, 'border-[2.5px] border-primary bg-surface')} aria-hidden="true">
        <span className="absolute h-[12px] w-[12px] animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
        <span className="h-[12px] w-[12px] rounded-full bg-primary" />
      </span>
    );
  if (state === 'missed')
    return (
      <span
        className={cx(
          box,
          'border-[2px] border-gold bg-surface font-heading text-[17px] font-extrabold text-warning-text',
        )}
        aria-hidden="true"
      >
        !
      </span>
    );
  return (
    <span className={cx(box, 'bg-border-soft')} aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill={C.stageOffStem} />
        <path
          d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
          stroke={C.stageOffStem}
          strokeWidth="2.2"
        />
      </svg>
    </span>
  );
}
