// The landing hero's phone: a modern phone showing our ACTUAL live lesson (the call
// screen's pill + timer, the sprite teacher talking, the ayah card from the
// verified Tanzil text, the listening mic), with two floating story cards. Purely
// decorative (aria-hidden). Desktop: tilted; phones: upright and scaled down.
import { useEffect, useState } from 'react';

import { verifiedAyah } from '../../content/verified';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { TEACHER_NAME, teacherFrameSrc, type TeacherFrame } from '../child/teacherCharacter';
import { C } from '../ui/color';
import { CheckIcon, MicIcon } from '../ui/icons';

// Al-Ikhlas 112:1 (being recited) and 112:2 (next, dimmed) — from the verified asset.
const AYAT = [1, 2].map((n) => ({ n, text: verifiedAyah(112, n).text }));

// A talking loop at ~8 fps: idle / mouth-small / mouth-open, a blink every few seconds.
const TALK: readonly TeacherFrame[] = [
  'idle',
  'mouth-small',
  'mouth-open',
  'mouth-small',
  'idle',
  'mouth-open',
  'mouth-small',
  'idle',
  'idle',
  'mouth-small',
  'mouth-open',
  'mouth-open',
  'mouth-small',
  'idle',
  'idle',
  'idle',
];
const SHOWN: readonly TeacherFrame[] = ['idle', 'mouth-small', 'mouth-open', 'blink'];
const FRAME_MS = 125;
const BLINK_EVERY = 30; // frames (~3.75 s)

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
  const frame: TeacherFrame = reduce
    ? 'idle'
    : tick % BLINK_EVERY === BLINK_EVERY - 1
      ? 'blink'
      : TALK[tick % TALK.length]!;
  return (
    <div className="relative h-[228px] w-full shrink-0">
      <span className="absolute top-[18px] left-1/2 h-[204px] w-[204px] -translate-x-1/2 rounded-full bg-green-tint" />
      {/* all frames stacked, only one visible — no flicker while switching */}
      {SHOWN.map((f) => (
        <img
          key={f}
          src={teacherFrameSrc('boy', f)}
          alt=""
          draggable={false}
          className={cx(
            'absolute bottom-0 left-1/2 h-[228px] w-[174px] -translate-x-1/2 object-cover object-top',
            f === frame ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {/* the talking glow */}
      {!reduce && (
        <span className="absolute top-[34px] left-1/2 h-[172px] w-[172px] -translate-x-1/2 animate-[gh-pulse_2.4s_ease-in-out_infinite] rounded-full" />
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

function CallScreen() {
  return (
    <div className="flex h-full flex-col bg-background">
      <StatusBar />
      <div className="flex grow flex-col items-center gap-[10px] px-[14px] pt-[10px] pb-[16px]">
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
        {/* the ayah card (SurahCard): the recited ayah highlighted, the next one dimmed */}
        <div className="flex w-full flex-col gap-[2px] rounded-px-24 border-[2px] border-primary bg-surface px-[12px] pt-[8px] pb-[10px] shadow-lesson-ayah-card">
          <span className="text-center text-[12px] font-bold text-text-muted">سورة الإخلاص</span>
          <p
            dir="rtl"
            className="m-0 flex flex-col items-start font-ayah text-[19px] leading-[2] text-text-dark"
          >
            {AYAT.map((a) => {
              const words = a.text.split(' ');
              const last = words.pop();
              return (
                <span
                  key={a.n}
                  className={cx(
                    'rounded-px-10 px-[7px] py-[1px]',
                    a.n === 1 ? 'bg-green-tint text-deep-green' : 'opacity-45',
                  )}
                >
                  {words.join(' ')}{' '}
                  <span className="whitespace-nowrap">
                    {last}
                    <span className="text-ayah-bracket">
                      {' '}﴿{toArabicDigits(a.n)}﴾
                    </span>
                  </span>
                </span>
              );
            })}
          </p>
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

/** The hero phone. `desktop`: 340×700 with a slight 3D tilt; phones: upright, scaled to ~300 wide. */
export function LivePhone({ desktop }: { desktop?: boolean }) {
  const phone = (
    <div
      className={cx(
        'relative h-[700px] w-[340px] rounded-px-44 bg-text-dark p-[10px] shadow-phone-mock',
        desktop && '[transform:perspective(1800px)_rotateY(8deg)_rotateZ(-4deg)]',
      )}
    >
      {/* side buttons */}
      <span className="absolute top-[150px] -left-[3px] h-[56px] w-[3px] rounded-l-px-3 bg-text-dark" />
      <span className="absolute top-[220px] -left-[3px] h-[56px] w-[3px] rounded-l-px-3 bg-text-dark" />
      <span className="absolute top-[180px] -right-[3px] h-[86px] w-[3px] rounded-r-px-3 bg-text-dark" />
      <div className="relative h-full overflow-hidden rounded-px-34">
        <CallScreen />
        {/* dynamic island */}
        <span className="absolute top-[9px] left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-pill bg-text-dark" />
      </div>
      <FloatCard
        className={cx(
          'top-[96px] animate-[gh-float-2_4.6s_ease-in-out_infinite]',
          desktop ? '-right-[46px]' : '-right-[14px]',
        )}
      >
        <span className="text-[18px]">⭐</span>
        <span className="flex flex-col">
          <span className="font-heading text-[15px] font-extrabold text-deep-green">
            +{toArabicDigits(1)} نجمة
          </span>
          <span className="text-[12px] font-bold text-text-muted">أحسنت!</span>
        </span>
      </FloatCard>
      <FloatCard
        className={cx(
          'bottom-[110px] animate-[gh-float-3_5.2s_ease-in-out_.8s_infinite]',
          desktop ? '-left-[58px]' : '-left-[14px]',
        )}
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
  if (desktop)
    return (
      <div aria-hidden="true" className="shrink-0 px-[40px]">
        {phone}
      </div>
    );
  // phones: the same phone, upright, scaled to fit under the hero text
  return (
    <div aria-hidden="true" className="relative mx-auto h-[616px] w-[300px]">
      <div className="absolute top-0 left-1/2 origin-top -translate-x-1/2 scale-[0.88]">{phone}</div>
    </div>
  );
}
