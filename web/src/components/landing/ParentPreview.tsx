// «ماذا يرى وليّ الأمر»: a live preview of the parent dashboard on the landing — one card,
// four views (overview / today's lesson / the project / his questions) that switch every
// 5 s with a cross-fade. All names and numbers are SAMPLE data (no real child).
import { useEffect, useRef, useState } from 'react';

import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';
import { CheckIcon } from '../ui/icons';
import { HOW_STEPS, VoiceNote } from './shared';

const VIEWS = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'today', label: 'حصة اليوم' },
  { key: 'project', label: 'المشروع' },
  { key: 'questions', label: 'أسئلته' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];
const VIEW_MS = 5000;

// Sample data only.
const COUNTS = [
  { n: 8, label: 'سور', color: 'text-deep-green' },
  { n: 64, label: 'آية', color: 'text-sky-text' },
  { n: 12, label: 'حديثًا', color: 'text-berry-deep' },
  { n: 9, label: 'مشاريع', color: 'text-warning-text' },
];
const PLAN_PCT = 52;
const QUESTIONS = [
  { q: 'ليش نصلي خمس صلوات في اليوم؟', when: 'أمس' },
  { q: 'ليش خلق الله النار؟', when: `قبل ${toArabicDigits(3)} أيام` },
];
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
    label: 'بذرة',
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
    label: 'غَرْسة',
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
    label: 'شجرة',
    ring: 'bg-border-soft',
    text: 'text-text-subtle',
    art: (s: number) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 21 V13" stroke={C.textSubtle} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="8" r="6" fill={C.voiceBarOff} />
      </svg>
    ),
  },
];

function Overview({ desktop, run, reduce }: { desktop?: boolean; run: boolean; reduce: boolean }) {
  const counts = COUNTS.map((c) => c.n);
  const values = [
    useCountUp(counts[0]!, run, reduce),
    useCountUp(counts[1]!, run, reduce),
    useCountUp(counts[2]!, run, reduce),
    useCountUp(counts[3]!, run, reduce),
  ];
  const barOn = reduce || run;
  return (
    <div className={cx('flex flex-col', desktop ? 'gap-[14px]' : 'gap-[12px]')}>
      <div
        className={cx(
          'flex flex-col bg-surface',
          desktop
            ? 'gap-[14px] rounded-px-22 px-[18px] py-[18px]'
            : 'gap-[12px] rounded-px-20 px-[14px] py-[14px]',
        )}
      >
        <span className={cx('font-extrabold text-text-muted', desktop ? 'text-[13.5px]' : 'text-[12.5px]')}>
          مسار النموّ
        </span>
        <div className={cx('flex items-start [direction:ltr]', desktop ? 'gap-[6px]' : 'gap-[4px]')}>
          {STAGES.map((s, i) => (
            <div
              key={s.label}
              className={cx('flex grow basis-0 flex-col items-center', desktop ? 'gap-[8px]' : 'gap-[6px]')}
            >
              <span
                className={cx(
                  'flex items-center justify-center rounded-full',
                  desktop ? 'h-[52px] w-[52px]' : 'h-[42px] w-[42px]',
                  s.ring,
                )}
                aria-hidden="true"
              >
                {s.art((desktop ? 26 : 21) + (i === 0 ? 0 : 2))}
              </span>
              <span className={cx('font-extrabold', desktop ? 'text-[12.5px]' : 'text-[11.5px]', s.text)}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-[8px] overflow-hidden rounded-px-4 bg-border [direction:ltr]">
          <span
            className="block h-[8px] rounded-px-4 bg-primary transition-[width] duration-[1100ms] ease-out"
            style={{ width: barOn ? `${PLAN_PCT}%` : '0%' }}
          />
        </div>
      </div>
      <div className={cx('flex', desktop ? 'gap-[10px]' : 'gap-[8px]')}>
        {COUNTS.map((c, i) => (
          <div
            key={c.label}
            className={cx(
              'flex grow basis-0 flex-col items-center bg-surface',
              desktop
                ? 'gap-[3px] rounded-px-18 px-[10px] py-[14px]'
                : 'gap-[2px] rounded-px-16 px-[6px] py-[12px]',
            )}
          >
            <span
              className={cx('font-heading font-extrabold', desktop ? 'text-[22px]' : 'text-[19px]', c.color)}
            >
              {toArabicDigits(values[i]!)}
            </span>
            <span className="text-[12px] font-bold text-text-muted">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-[9px] rounded-px-16 bg-surface px-[14px] py-[11px] text-[14.5px] font-bold text-text-dark">
      <span className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full bg-green-tint">
        <CheckIcon size={14} strokeWidth={3.2} />
      </span>
      {children}
    </span>
  );
}

function Today() {
  return (
    <div className="flex flex-col gap-[10px]">
      <Done>سورة الإخلاص · {toArabicDigits(4)} آيات</Done>
      <Done>حديث برّ الوالدين</Done>
      <span className="flex items-center gap-[8px]">
        <span className="rounded-pill bg-surface px-[12px] py-[6px] text-[13px] font-bold text-text-muted">
          مدة الحصة {toArabicDigits(12)} دقيقة
        </span>
        <span className="rounded-pill bg-green-tint px-[12px] py-[6px] text-[13px] font-extrabold text-deep-green">
          ردّد بثقة
        </span>
      </span>
      <span className="flex flex-col gap-[3px] rounded-px-16 border-[1.5px] border-gold-border bg-gold-tint px-[14px] py-[10px]">
        <span className="text-[12px] font-extrabold text-warning-text">ملاحظة المعلّم</span>
        <span className="text-[14.5px] leading-[1.7] font-bold text-on-gold">
          تفاعل رائع، وأحسن الاستماع للقارئ
        </span>
      </span>
    </div>
  );
}

function Project({ playing }: { playing: boolean }) {
  return (
    <div className="flex flex-col gap-[12px] rounded-px-18 bg-surface px-[16px] py-[14px]">
      <span className="self-start rounded-pill bg-gold px-[12px] py-[4px] text-[12.5px] font-extrabold text-on-gold">
        مشروع الأسبوع
      </span>
      <span className="font-heading text-[18px] leading-[1.5] font-bold text-text-dark">
        برّ الوالدين · <span className="text-text-muted">ساعد أمه في ترتيب البيت</span>
      </span>
      <span className="flex items-center gap-[6px] self-start rounded-pill bg-green-tint px-[11px] py-[5px] text-[13px] font-extrabold text-deep-green">
        حكاه بصوته
        <CheckIcon size={13} strokeWidth={3.2} />
      </span>
      <VoiceNote
        step={HADITH_STEP}
        line={{ from: 'child', text: 'ساعدت أمي في ترتيب البيت', sec: 6 }}
        playing={playing}
      />
    </div>
  );
}

function Questions() {
  return (
    <div className="flex flex-col gap-[10px]">
      {QUESTIONS.map((x) => (
        <span key={x.q} className="flex flex-col gap-[8px] rounded-px-16 bg-surface px-[14px] py-[12px]">
          <span className="text-[15px] leading-[1.6] font-bold text-text-dark">«{x.q}»</span>
          <span className="flex items-center gap-[8px]">
            <span className="flex items-center gap-[5px] rounded-pill bg-green-tint px-[10px] py-[4px] text-[12.5px] font-extrabold text-deep-green">
              أجابه المعلّم
              <CheckIcon size={12} strokeWidth={3.2} />
            </span>
            <span className="text-[12.5px] font-bold text-text-subtle">{x.when}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** The parent-dashboard preview card (sample data): four views that switch every 5 s. */
export function ParentPreview({ desktop }: { desktop?: boolean }) {
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
      aria-label="مثال للوحة المتابعة (بيانات توضيحية)"
      role="region"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      className={cx(
        'flex flex-col border-[1.5px] border-border bg-background',
        desktop ? 'gap-[18px] rounded-px-30 p-[26px]' : 'gap-[14px] rounded-px-26 p-[20px]',
      )}
    >
      <div className={cx('flex items-center', desktop ? 'gap-[14px]' : 'gap-[12px]')}>
        <img
          src="/avatars/child-boy-1-256.webp"
          alt=""
          loading="lazy"
          className={cx(
            'shrink-0 bg-green-tint object-cover [object-position:50%_20%]',
            desktop ? 'h-[54px] w-[54px] rounded-px-18' : 'h-[46px] w-[46px] rounded-px-16',
          )}
        />
        <span className={cx('flex grow flex-col', desktop ? 'gap-[3px]' : 'gap-[2px]')}>
          <span className={cx('font-extrabold', desktop ? 'text-[17px]' : 'text-[15.5px]')}>عبدالله</span>
          <span className={cx('text-text-muted', desktop ? 'text-[13px]' : 'text-[12.5px]')}>
            {toArabicDigits(10)} سنوات · خطة سنوية
          </span>
        </span>
        <span
          className={cx(
            'shrink-0 rounded-pill bg-gold-tint font-extrabold text-warning-text',
            desktop ? 'px-[13px] py-[7px] text-[12.5px]' : 'px-[11px] py-[6px] text-[11.5px]',
          )}
        >
          {toArabicDigits(5)} أيام متتالية
        </span>
      </div>

      <div
        role="tablist"
        aria-label="أقسام اللوحة"
        className={cx('flex flex-wrap', desktop ? 'gap-[6px]' : 'gap-[5px]')}
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
              'cursor-pointer rounded-pill border-[1.5px] font-extrabold transition-colors duration-300',
              desktop ? 'px-[13px] py-[6px] text-[13px]' : 'px-[9px] py-[5px] text-[12px]',
              v.key === view
                ? 'border-deep-green bg-deep-green text-surface'
                : 'border-border bg-surface text-text-muted hover:text-text-dark',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* all four views share one grid cell: the card keeps the tallest view's height */}
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
              {v.key === 'questions' && <Questions />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
