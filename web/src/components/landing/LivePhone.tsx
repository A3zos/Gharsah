// The landing hero's phone: a modern phone showing our ACTUAL live lesson (the call
// screen's pill + timer, the sprite teacher talking, the current ayah from the
// verified Tanzil text, the listening mic), with a floating parent notification.
// Purely decorative (aria-hidden). Always upright; scaled down on phones.
import { useEffect, useRef, useState } from 'react';

import { verifiedAyah } from '../../content/verified';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { TEACHER_NAME, teacherFrameSrc, type TeacherFrame } from '../child/teacherCharacter';
import { C } from '../ui/color';
import { CheckIcon, MicIcon } from '../ui/icons';

// Al-Ikhlas 112:1, the ayah being recited — from the verified asset.
const AYAH = verifiedAyah(112, 1);

// The talking loop at 8 fps: idle → mouth-small → mouth-open → mouth-small for ~2.5 s,
// then a ~1 s pause with a blink in the middle, and again.
const TALK_CYCLE: readonly TeacherFrame[] = ['idle', 'mouth-small', 'mouth-open', 'mouth-small'];
const LOOP: readonly TeacherFrame[] = [
  ...Array.from({ length: 5 }, () => TALK_CYCLE).flat(),
  'idle',
  'idle',
  'idle',
  'blink',
  'idle',
  'idle',
  'idle',
  'idle',
];
const SHOWN: readonly TeacherFrame[] = ['idle', 'mouth-small', 'mouth-open', 'blink'];
const FRAME_MS = 125;

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

function TalkingTeacher() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setTick((n) => n + 1), FRAME_MS);
    return () => clearInterval(t);
  }, [reduce]);
  const frame: TeacherFrame = reduce ? 'idle' : LOOP[tick % LOOP.length]!;
  return (
    <div className="relative h-[300px] w-full shrink-0">
      <span className="absolute top-[26px] left-1/2 h-[268px] w-[268px] -translate-x-1/2 rounded-full bg-green-tint" />
      {/* all frames stacked, only one visible — no flicker while switching */}
      {SHOWN.map((f) => (
        <img
          key={f}
          src={teacherFrameSrc('boy', f)}
          alt=""
          loading="eager"
          draggable={false}
          className={cx(
            'absolute bottom-0 left-1/2 h-[300px] w-[230px] -translate-x-1/2 object-cover object-top',
            f === frame ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {/* the talking glow */}
      {!reduce && (
        <span className="absolute top-[46px] left-1/2 h-[228px] w-[228px] -translate-x-1/2 animate-[gh-pulse_2.4s_ease-in-out_infinite] rounded-full" />
      )}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="relative flex h-[34px] shrink-0 items-center justify-between px-[26px] pt-[8px]">
      <span className="font-heading text-[14px] font-bold text-text-dark">
        {toArabicDigits(9)}:{toArabicDigits(41)}
      </span>
      <span className="flex items-center gap-[5px]" dir="ltr">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 4.4}
              y={8 - i * 2.4}
              width="3"
              height={3 + i * 2.4}
              rx="1"
              fill={C.textDark}
            />
          ))}
        </svg>
        <svg width="15" height="11" viewBox="0 0 24 18" fill="none">
          <path d="M12 16 L15 12.6 C13.3 11.1 10.7 11.1 9 12.6 Z" fill={C.textDark} />
          <path d="M5.2 8.4 C9 5 15 5 18.8 8.4" stroke={C.textDark} strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M1.6 4.6 C7.6 -0.6 16.4 -0.6 22.4 4.6"
            stroke={C.textDark}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect
            x="0.75"
            y="0.75"
            width="21"
            height="10.5"
            rx="3"
            stroke={C.textDark}
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <rect x="2.5" y="2.5" width="15" height="7" rx="1.6" fill={C.textDark} />
          <rect x="23" y="4" width="1.6" height="4" rx="0.8" fill={C.textDark} fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

const AYAH_PX = 24;

/** «قُلْ هُوَ ٱللَّهُ أَحَدٌ ﴿١﴾» centered on one row; the font shrinks if the row is too wide. */
function AyahLine() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [px, setPx] = useState(AYAH_PX);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = `${AYAH_PX}px`;
      const ratio = el.clientWidth / el.scrollWidth;
      setPx(ratio < 1 ? Math.floor(AYAH_PX * ratio * 10) / 10 : AYAH_PX);
    };
    fit();
    void document.fonts?.ready.then(fit);
  }, []);
  return (
    <p
      ref={ref}
      dir="rtl"
      style={{ fontSize: px }}
      className="m-0 w-full overflow-hidden text-center font-ayah leading-[1.9] whitespace-nowrap text-text-dark"
    >
      {AYAH.text}
      <span className="text-ayah-bracket"> ﴿{toArabicDigits(1)}﴾</span>
    </p>
  );
}

function CallScreen() {
  return (
    <div className="flex h-full flex-col bg-background">
      <StatusBar />
      <div className="flex grow flex-col items-center gap-[10px] px-[14px] pt-[10px] pb-[28px]">
        {/* LiveHeader */}
        <div className="flex w-full items-center gap-[8px]">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-berry-border bg-berry-tint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={C.berryDeep}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="flex grow items-center justify-center gap-[7px]">
            <span className="flex items-center gap-[5px] rounded-pill border border-berry-border bg-surface px-[11px] py-[4px]">
              <span className="h-[7px] w-[7px] animate-[gh-blink_1.4s_ease-in-out_infinite] rounded-full bg-berry" />
              <span className="text-[13px] font-extrabold text-berry-deep">مباشر</span>
            </span>
            <span dir="ltr" className="font-heading text-[13px] font-bold text-text-muted">
              {toArabicDigits('02')}:{toArabicDigits(14)}
            </span>
          </span>
          <span className="w-[34px] shrink-0" />
        </div>
        <TalkingTeacher />
        <span className="-mt-[4px] rounded-pill bg-green-tint px-[12px] py-[3px] text-[13px] font-extrabold text-deep-green">
          {TEACHER_NAME.boy}
        </span>
        {/* the ayah card: the current ayah on ONE line (scaled down to fit, never wrapped) */}
        <div className="flex w-full flex-col items-center gap-[4px] rounded-px-24 border-[2px] border-primary bg-surface px-[12px] pt-[14px] pb-[14px] shadow-lesson-ayah-card">
          <AyahLine />
          <span className="text-[12px] font-bold text-text-muted">
            سورة الإخلاص · الآية {toArabicDigits(1)}
          </span>
        </div>
        {/* the listening mic (brand green) */}
        <div className="mt-auto flex flex-col items-center gap-[6px]">
          <span className="relative flex h-[64px] w-[64px] items-center justify-center rounded-full bg-primary shadow-lesson-home-button">
            <span className="absolute inset-0 animate-[gh-pulse_2s_ease-in-out_infinite] rounded-full motion-reduce:animate-none" />
            <MicIcon size={26} />
          </span>
          <span className="text-[13px] font-bold text-text-muted">أنا أسمعك…</span>
        </div>
      </div>
    </div>
  );
}

function FloatCard({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'absolute z-3 flex items-center gap-[9px] rounded-px-18 border-[1.5px] border-border bg-surface px-[13px] py-[10px] whitespace-nowrap shadow-dark-14-28-8 motion-reduce:animate-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

// The phone is laid out at 323×700 (a real ~9:19.5 phone) and scaled as one piece to
// its box's height, so the teacher, card, mic and the parent card all shrink together.
const BASE_H = 700;

/** Scales the 323×700 phone to the height of `box` (sized in CSS). */
function useFitScale(fallback: number) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(fallback);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientHeight / BASE_H);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, scale };
}

/**
 * The hero phone, perfectly upright. Desktop: min(600px, 78vh) tall (~277×600);
 * phones: under the hero text, at most 520px tall.
 */
export function LivePhone({ desktop }: { desktop?: boolean }) {
  const { box, scale } = useFitScale((desktop ? 600 : 520) / BASE_H);
  const phone = (
    <div className="relative h-[700px] w-[323px] rounded-px-44 bg-text-dark p-[10px] shadow-phone-mock">
      {/* side buttons */}
      <span className="absolute top-[150px] -left-[3px] h-[56px] w-[3px] rounded-l-px-3 bg-text-dark" />
      <span className="absolute top-[220px] -left-[3px] h-[56px] w-[3px] rounded-l-px-3 bg-text-dark" />
      <span className="absolute top-[180px] -right-[3px] h-[86px] w-[3px] rounded-r-px-3 bg-text-dark" />
      <div className="relative h-full overflow-hidden rounded-px-34">
        <CallScreen />
        {/* dynamic island */}
        <span className="absolute top-[9px] left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-pill bg-text-dark" />
      </div>
      {/* overlaps the lower-left corner, beside the mic — never over the ayah or the mic */}
      <FloatCard
        className="bottom-[22px] -left-[56px] animate-[gh-float-3_5.2s_ease-in-out_.8s_infinite]"
      >
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary">
          <CheckIcon size={15} color="surface" strokeWidth={3.2} />
        </span>
        <span className="flex flex-col">
          <span className="text-[11.5px] font-bold text-text-muted">ولي الأمر</span>
          <span className="text-[13.5px] font-extrabold text-text-dark">
            بدر أتمّ اليوم {toArabicDigits(1)} ✓
          </span>
        </span>
      </FloatCard>
    </div>
  );
  return (
    <div aria-hidden="true" className={cx('shrink-0', desktop ? 'px-[40px]' : 'mx-auto')}>
      <div
        ref={box}
        className={cx('relative aspect-[323/700]', desktop ? 'h-[min(600px,78vh)]' : 'h-[min(520px,78svh)]')}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
          {phone}
        </div>
      </div>
    </div>
  );
}
