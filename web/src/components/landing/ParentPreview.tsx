// «لوليّ الأمر» on the landing: the copy + feature rows (ParentFeatures) and a live preview
// of the parent dashboard (ParentPreview) — one card in a light browser frame, three views
// (overview / today's lesson / the project) that switch every 5 s with a cross-fade. All names and numbers in the preview are SAMPLE data (no real child).
// The words follow the landing language (src/i18n → parents).
import { useEffect, useRef, useState } from 'react';

import { PILOT_MAX_CHILDREN } from '../../content/plans';
import { fill, formatNumber, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';
import { CheckIcon } from '../ui/icons';
import { HOW_STEPS, VoiceNote } from './shared';

const VIEWS = [{ key: 'overview' }, { key: 'today' }, { key: 'project' }] as const;
type ViewKey = (typeof VIEWS)[number]['key'];
const VIEW_MS = 5000;

const svg = (s: number, children: React.ReactNode) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {children}
  </svg>
);

/** Small line icons for the stat tiles and the feature rows. */
const ICONS = {
  book: (s: number, c: string) =>
    svg(
      s,
      <>
        <path
          d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
          stroke={c}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path d="M12 5.8 V18.8" stroke={c} strokeWidth="1.9" />
      </>,
    ),
  sparkle: (s: number, c: string) =>
    svg(
      s,
      <path
        d="M12 3 L13.9 9.1 L20 11 L13.9 12.9 L12 19 L10.1 12.9 L4 11 L10.1 9.1 Z"
        stroke={c}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />,
    ),
  chat: (s: number, c: string) =>
    svg(
      s,
      <path
        d="M5 5 H19 C20.1 5 21 5.9 21 7 V15 C21 16.1 20.1 17 19 17 H11 L6.5 20.5 V17 H5 C3.9 17 3 16.1 3 15 V7 C3 5.9 3.9 5 5 5 Z"
        stroke={c}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />,
    ),
  sprout: (s: number, c: string) =>
    svg(
      s,
      <>
        <path d="M12 21 V11" stroke={c} strokeWidth="1.9" strokeLinecap="round" />
        <path d="M12 14 C8 14 5.5 11.5 5.5 7.5 C9.5 7.5 12 10 12 14 Z" stroke={c} strokeWidth="1.9" />
        <path d="M12 11.5 C16 11.5 18.5 9 18.5 5 C14.5 5 12 7.5 12 11.5 Z" stroke={c} strokeWidth="1.9" />
      </>,
    ),
  report: (s: number, c: string) =>
    svg(
      s,
      <>
        <rect x="5" y="4" width="14" height="17" rx="2.5" stroke={c} strokeWidth="1.9" />
        <path d="M9 3 H15 V6 H9 Z" stroke={c} strokeWidth="1.9" strokeLinejoin="round" />
        <path
          d="M8.5 11 H15.5 M8.5 14.5 H15.5 M8.5 18 H12.5"
          stroke={c}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>,
    ),
  mic: (s: number, c: string) =>
    svg(
      s,
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" stroke={c} strokeWidth="1.9" />
        <path
          d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
          stroke={c}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </>,
    ),
  children: (s: number, c: string) =>
    svg(
      s,
      <>
        <circle cx="9" cy="8" r="3.2" stroke={c} strokeWidth="1.9" />
        <circle cx="17" cy="9.5" r="2.4" stroke={c} strokeWidth="1.9" />
        <path
          d="M3.5 19.5 C3.5 15.9 6 13.5 9 13.5 C12 13.5 14.5 15.9 14.5 19.5"
          stroke={c}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path d="M15 14.2 C17.9 14 20.5 15.9 20.5 19.5" stroke={c} strokeWidth="1.9" strokeLinecap="round" />
      </>,
    ),
};

// ---- the copy on the text side ---------------------------------------------------------

const FEATURES = [
  {
    icon: ICONS.report,
    tint: 'bg-green-tint',
    color: C.deepGreen,
  },
  {
    icon: ICONS.mic,
    tint: 'bg-gold-tint',
    color: C.warningText,
  },
  {
    icon: ICONS.children,
    tint: 'bg-sky-tint',
    color: C.skyText,
  },
];

/** «لوليّ الأمر»: the paragraph and the three feature rows (round tinted icon + title + line). */
export function ParentFeatures({ desktop }: { desktop?: boolean }) {
  const { lang, m } = useI18n();
  return (
    <>
      <p
        className={cx(
          'm-0 text-text-muted',
          desktop ? 'max-w-[500px] text-[17px] leading-[1.95]' : 'text-center text-[15px] leading-[1.9]',
        )}
      >
        {m.parents.body}
      </p>
      <ul className={cx('m-0 flex list-none flex-col p-0', desktop ? 'gap-[16px] pt-[4px]' : 'gap-[14px]')}>
        {FEATURES.map((f, i) => (
          <li key={i} className="flex items-center gap-[14px]">
            <span
              className={cx(
                'flex shrink-0 items-center justify-center rounded-full',
                f.tint,
                desktop ? 'h-[46px] w-[46px]' : 'h-[42px] w-[42px]',
              )}
            >
              {f.icon(desktop ? 22 : 20, f.color)}
            </span>
            <span className="flex flex-col gap-[1px]">
              <span className={cx('font-extrabold text-text-dark', desktop ? 'text-[16px]' : 'text-[15px]')}>
                {m.parents.features[i]!.title}
              </span>
              <span className={cx('text-text-muted', desktop ? 'text-[14.5px]' : 'text-[13.5px]')}>
                {/* the third row: the pilot plan's limit (content/plans.ts) — the plan the landing offers today */}
                {fill(lang, m.parents.features[i]!.text, { n: PILOT_MAX_CHILDREN })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- the preview (sample data only) ----------------------------------------------------

const COUNTS = [
  { n: 8, label: 'surahs', color: 'text-deep-green', icon: ICONS.book, c: C.deepGreen },
  { n: 64, label: 'ayat', color: 'text-sky-text', icon: ICONS.sparkle, c: C.skyText },
  { n: 12, label: 'hadith', color: 'text-berry-deep', icon: ICONS.chat, c: C.berryDeep },
  { n: 9, label: 'projects', color: 'text-warning-text', icon: ICONS.sprout, c: C.warningText },
] as const;
const PLAN_PCT = 52;
const HADITH_STEP = HOW_STEPS.find((s) => s.key === 'hadith')!;

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/** True once the element has been at least 40% on screen (and stays true). */
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // no IntersectionObserver (old browsers, tests): treat it as seen right away
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== 'function');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

/** Counts 0 → `to` over ~0.9 s each time `run` turns true (no animation under reduced motion). */
function useCountUp(to: number, run: boolean, reduce: boolean): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduce || !run) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setV(0); // so the next run starts from 0, not a flash of the final number
    };
  }, [to, run, reduce]);
  if (reduce) return to;
  return run ? v : 0;
}

const STAGES = [
  {
    label: 'seed',
    ring: 'bg-green-tint',
    text: 'text-deep-green',
    art: (s: number) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="14" rx="6" ry="7.5" fill={C.primary} />
        <path d="M12 9 C12 6 13.5 4 16 3.5" stroke={C.deepGreen} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'sapling',
    ring: 'bg-gold-tint border-[2px] border-gold',
    text: 'text-warning-text',
    art: (s: number) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 21 V11" stroke={C.deepGreen} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 15 C8 15 5.5 12.5 5.5 8.5 C9.5 8.5 12 11 12 15 Z" fill={C.primary} />
        <path d="M12 13 C16 13 18.5 10.5 18.5 6.5 C14.5 6.5 12 9 12 13 Z" fill={C.softGreen} />
      </svg>
    ),
  },
  {
    label: 'tree',
    ring: 'bg-border-soft',
    text: 'text-text-subtle',
    art: (s: number) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 21 V13" stroke={C.textSubtle} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="8" r="6" fill={C.voiceBarOff} />
      </svg>
    ),
  },
] as const;

/** A cream tile inside the white frame. */
const TILE = 'rounded-px-18 bg-background';

function Overview({ desktop, run, reduce }: { desktop?: boolean; run: boolean; reduce: boolean }) {
  const { lang, m } = useI18n();
  const t = m.parents.preview;
  const values = [
    useCountUp(COUNTS[0]!.n, run, reduce),
    useCountUp(COUNTS[1]!.n, run, reduce),
    useCountUp(COUNTS[2]!.n, run, reduce),
    useCountUp(COUNTS[3]!.n, run, reduce),
  ];
  const barOn = reduce || run;
  return (
    <div className="flex flex-col gap-[12px]">
      <div
        className={cx(
          TILE,
          'flex flex-col gap-[10px]',
          desktop ? 'px-[18px] py-[12px]' : 'px-[14px] py-[12px]',
        )}
      >
        <span className="flex items-center justify-between">
          <span className={cx('font-extrabold text-text-muted', desktop ? 'text-[13.5px]' : 'text-[12.5px]')}>
            {t.growth}
          </span>
          <span className="rounded-pill bg-green-tint px-[9px] py-[2px] font-heading text-[13px] font-extrabold text-deep-green">
            {fill(lang, t.percent, { n: PLAN_PCT })}
          </span>
        </span>
        <div className={cx('flex items-start [direction:ltr]', desktop ? 'gap-[6px]' : 'gap-[4px]')}>
          {STAGES.map((s, i) => (
            <div key={s.label} className="flex grow basis-0 flex-col items-center gap-[6px]">
              <span
                className={cx(
                  'flex items-center justify-center rounded-full',
                  desktop ? 'h-[42px] w-[42px]' : 'h-[38px] w-[38px]',
                  s.ring,
                )}
                aria-hidden="true"
              >
                {s.art((desktop ? 22 : 19) + (i === 0 ? 0 : 2))}
              </span>
              <span className={cx('font-extrabold', desktop ? 'text-[12.5px]' : 'text-[11.5px]', s.text)}>
                {t.stages[s.label]}
              </span>
            </div>
          ))}
        </div>
        <div className="h-[12px] overflow-hidden rounded-pill bg-border [direction:ltr]">
          <span
            className="block h-[12px] rounded-pill bg-primary transition-[width] duration-[1100ms] ease-out"
            style={{ width: barOn ? `${PLAN_PCT}%` : '0%' }}
          />
        </div>
      </div>
      <div className={cx('grid grid-cols-4', desktop ? 'gap-[10px]' : 'gap-[7px]')}>
        {COUNTS.map((c, i) => (
          <div
            key={c.label}
            className={cx(
              TILE,
              'flex flex-col items-center',
              desktop ? 'gap-[1px] py-[9px]' : 'gap-[1px] py-[8px]',
            )}
          >
            {c.icon(desktop ? 18 : 16, c.c)}
            <span
              className={cx(
                'font-heading leading-[1.3] font-extrabold',
                desktop ? 'text-[30px]' : 'text-[24px]',
                c.color,
              )}
            >
              {formatNumber(lang, values[i]!)}
            </span>
            <span className={cx('font-bold text-text-muted', desktop ? 'text-[14px]' : 'text-[12.5px]')}>
              {t.stats[c.label]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cx(
        TILE,
        'flex h-[52px] items-center gap-[10px] px-[14px] text-[15px] font-bold text-text-dark',
      )}
    >
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-green-tint">
        <CheckIcon size={14} strokeWidth={3.2} />
      </span>
      {children}
    </span>
  );
}

function Today() {
  const { lang, m } = useI18n();
  const t = m.parents.preview;
  return (
    <div className="flex flex-col gap-[12px]">
      <Done>{fill(lang, t.todaySurah, { n: 4 })}</Done>
      <Done>{t.todayHadith}</Done>
      <span className="flex flex-wrap items-center gap-[8px] whitespace-nowrap">
        <span className="rounded-pill bg-background px-[12px] py-[6px] text-[13px] font-bold text-text-muted">
          {fill(lang, t.duration, { n: 12 })}
        </span>
        <span className="rounded-pill bg-green-tint px-[12px] py-[6px] text-[13px] font-extrabold text-deep-green">
          {t.confident}
        </span>
      </span>
      <span className="flex w-full flex-col gap-[3px] rounded-px-18 border-[1.5px] border-gold-border bg-gold-tint px-[14px] py-[10px]">
        <span className="text-[12px] font-extrabold text-warning-text">{t.noteLabel}</span>
        <span className="text-[14.5px] leading-[1.7] font-bold text-on-gold">{t.note}</span>
      </span>
    </div>
  );
}

function Project({ playing }: { playing: boolean }) {
  const { m } = useI18n();
  const t = m.parents.preview;
  return (
    <div className={cx(TILE, 'flex flex-col gap-[12px] px-[16px] py-[14px]')}>
      <span className="self-start rounded-pill bg-gold px-[12px] py-[4px] text-[12.5px] font-extrabold text-on-gold">
        {t.weekProject}
      </span>
      <span className="font-heading text-[18px] leading-[1.5] font-bold text-text-dark">
        {t.projectTopic} · <span className="text-text-muted">{t.projectDetail}</span>
      </span>
      <span className="flex items-center gap-[6px] self-start rounded-pill bg-green-tint px-[11px] py-[5px] text-[13px] font-extrabold text-deep-green">
        {t.toldByVoice}
        <CheckIcon size={13} strokeWidth={3.2} />
      </span>
      <VoiceNote
        step={HADITH_STEP}
        line={{ from: 'child', text: t.voiceCaption, sec: 6 }}
        playing={playing}
      />
    </div>
  );
}

/** The parent-dashboard preview (sample data) in a light browser frame; three views, every 5 s. */
export function ParentPreview({ desktop }: { desktop?: boolean }) {
  const { lang, m } = useI18n();
  const t = m.parents.preview;
  const reduce = useReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const [view, setView] = useState<ViewKey>('overview');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || !seen || paused) return;
    // keyed on `view`, so a click restarts the 5 s
    const t = setTimeout(() => {
      const i = VIEWS.findIndex((v) => v.key === view);
      setView(VIEWS[(i + 1) % VIEWS.length]!.key);
    }, VIEW_MS);
    return () => clearTimeout(t);
  }, [reduce, seen, paused, view]);

  const id = desktop ? 'pp-d' : 'pp-m';
  return (
    <div
      ref={ref}
      aria-label={t.label}
      role="region"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      className="w-full max-w-[520px] overflow-hidden rounded-px-28 border border-border bg-surface shadow-dark-30-70-10"
    >
      {/* browser bar */}
      <div
        className="flex items-center gap-[12px] border-b border-b-border-soft bg-background/60 px-[16px] py-[10px]"
        dir="ltr"
      >
        <span className="flex gap-[6px]" aria-hidden="true">
          <span className="h-[10px] w-[10px] rounded-full bg-berry/60" />
          <span className="h-[10px] w-[10px] rounded-full bg-gold/70" />
          <span className="h-[10px] w-[10px] rounded-full bg-primary/60" />
        </span>
        <span className="mx-auto truncate rounded-pill bg-surface px-[14px] py-[3px] text-[12px] font-bold text-text-subtle">
          gharsah.pages.dev/parent
        </span>
        <span className="w-[42px]" aria-hidden="true" />
      </div>

      <div className={cx('flex flex-col', desktop ? 'gap-[16px] p-[22px]' : 'gap-[14px] p-[16px]')}>
        <div className="flex items-center gap-[12px]">
          <span
            className={cx(
              'shrink-0 overflow-hidden rounded-full bg-green-tint',
              desktop ? 'h-[56px] w-[56px]' : 'h-[50px] w-[50px]',
            )}
          >
            <img
              src="/avatars/child-boy-1-256.webp"
              alt=""
              loading="lazy"
              className="h-full w-full scale-[1.15] object-cover [object-position:50%_25%]"
            />
          </span>
          <span className="flex min-w-0 grow flex-col gap-[2px]">
            <span className={cx('font-extrabold', desktop ? 'text-[17px]' : 'text-[15.5px]')}>{t.name}</span>
            <span className={cx('text-text-muted', desktop ? 'text-[13px]' : 'text-[12.5px]')}>
              {fill(lang, t.meta, { age: 10 })}
            </span>
          </span>
          <span
            className={cx(
              'shrink-0 rounded-pill bg-gold-tint font-extrabold text-warning-text',
              desktop ? 'px-[12px] py-[6px] text-[12.5px]' : 'px-[10px] py-[5px] text-[11.5px]',
            )}
          >
            {fill(lang, t.streak, { n: 5 })}
          </span>
        </div>

        {/* segmented control: one track, equal segments, the active one filled */}
        <div
          role="tablist"
          aria-label={t.tabsLabel}
          className="grid grid-cols-3 gap-[2px] rounded-pill bg-background p-[4px]"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              id={`${id}-tab-${v.key}`}
              aria-selected={v.key === view}
              aria-controls={`${id}-panel-${v.key}`}
              onClick={() => setView(v.key)}
              className={cx(
                'cursor-pointer rounded-pill border-0 py-[7px] font-extrabold whitespace-nowrap transition-colors duration-300',
                desktop ? 'text-[13px]' : 'text-[12px]',
                v.key === view
                  ? 'bg-deep-green text-surface shadow-soft'
                  : 'bg-transparent text-text-muted hover:text-text-dark',
              )}
            >
              {t.tabs[v.key]}
            </button>
          ))}
        </div>

        {/* the three views share one grid cell: its height is the tallest view's, so tabs never jump */}
        <div className="grid">
          {VIEWS.map((v) => {
            const on = v.key === view;
            return (
              <div
                key={v.key}
                role="tabpanel"
                id={`${id}-panel-${v.key}`}
                aria-labelledby={`${id}-tab-${v.key}`}
                aria-hidden={!on}
                inert={!on}
                className={cx(
                  'transition-opacity duration-[450ms] ease-in-out [grid-area:1/1]',
                  on ? 'opacity-100' : 'opacity-0',
                )}
              >
                {v.key === 'overview' && <Overview desktop={desktop} run={seen && on} reduce={reduce} />}
                {v.key === 'today' && <Today />}
                {v.key === 'project' && <Project playing={seen && on && !reduce} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
