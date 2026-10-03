// The landing hero's phone: a modern phone showing our ACTUAL live lesson (the call
// screen's pills + timer, the sprite teacher talking, the listening mic). The screen
// alternates between the Quran lesson (the current ayah from the verified Tanzil text)
// and the Hadith lesson (topic only until the hadith is approved in content/).
// Decorative (aria-hidden). The phone itself never moves; scaled down on phones.
import { useEffect, useRef, useState } from 'react';

import hadithJson from '@content/hadith/hadith.json';

import { verifiedAyah } from '../../content/verified';
import { Hadith } from '../../lesson/hadith';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { TEACHER_NAME, teacherFrameSrc, type TeacherFrame } from '../child/teacherCharacter';
import { AyahNumber, Basmala, SurahBanner } from '../lesson/Mushaf';
import { C } from '../ui/color';
import { MicIcon } from '../ui/icons';

// Al-Ikhlas 112:1, the ayah being recited — from the verified asset.
const AYAH = verifiedAyah(112, 1);

// The برّ الوالدين hadith from content/hadith/hadith.json: its text shows only once
// it is approved there (Hadith hides it otherwise) — never typed here.
const HADITH = (hadithJson as { hadith: Record<string, unknown>[] }).hadith
  .map((j) => Hadith.fromJson(j))
  .find((h) => h.topic === 'برّ الوالدين')!;

type Scene = 'quran' | 'hadith';
const SCENES: readonly Scene[] = ['quran', 'hadith'];
const SCENE_MS = 6000;
const SCENE_PILL: Record<Scene, { label: string; tone: string }> = {
  quran: { label: 'حصة القرآن', tone: 'border-primary/40 bg-green-tint text-deep-green' },
  hadith: { label: 'حصة الحديث', tone: 'border-berry-border bg-berry-tint text-berry-deep' },
};

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
    <div className="relative h-[258px] w-full shrink-0">
      <span className="absolute top-[20px] left-1/2 h-[234px] w-[234px] -translate-x-1/2 rounded-full bg-green-tint" />
      {/* all frames stacked, only one visible — no flicker while switching */}
      {SHOWN.map((f) => (
        <img
          key={f}
          src={teacherFrameSrc('boy', f)}
          alt=""
          loading="eager"
          draggable={false}
          className={cx(
            'absolute bottom-0 left-1/2 h-[258px] w-[198px] -translate-x-1/2 object-cover object-top',
            f === frame ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {/* the talking glow */}
      {!reduce && (
        <span className="absolute top-[38px] left-1/2 h-[198px] w-[198px] -translate-x-1/2 animate-[gh-pulse_2.4s_ease-in-out_infinite] rounded-full" />
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

const AYAH_PX = 22;

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
      {/* the current ayah: the lesson card's soft green line */}
      <span className="inline-block rounded-lesson-ayah-highlight bg-green-tint px-[10px] text-deep-green">
        {AYAH.text}
        <AyahNumber n={1} />
      </span>
    </p>
  );
}

/** Two layers in one grid cell; the shown one fades in over the other (~400ms). */
function Fade({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'flex justify-center transition-opacity duration-[400ms] ease-in-out [grid-area:1/1]',
        show ? 'opacity-100' : 'opacity-0',
      )}
    >
      {children}
    </div>
  );
}

function QuranCard() {
  return (
    // the lesson's mushaf card: the surah's banner, the basmala, the ayah being recited
    <div className="flex w-full flex-col gap-[2px] self-center rounded-px-24 border border-primary/40 bg-[color-mix(in_srgb,var(--color-gold-tint)_40%,var(--color-surface))] px-[12px] pt-[10px] pb-[8px] shadow-lesson-ayah-card">
      <SurahBanner name="الإخلاص" size="sm" />
      <Basmala surahName="الإخلاص" className="text-[16px] leading-[1.9]" />
      <AyahLine />
    </div>
  );
}

/** The lesson's hadith card style; the hadith text itself only when approved in content/. */
function HadithCard() {
  return (
    <div className="flex w-full flex-col items-center gap-[6px] self-center rounded-px-24 border-[2px] border-primary bg-surface px-[12px] pt-[10px] pb-[11px] text-center shadow-lesson-ayah-card">
      <span className="font-heading text-[17px] leading-[1.5] font-bold text-text-dark">
        حديث اليوم: <span className="text-berry-deep">{HADITH.topic}</span>
      </span>
      {HADITH.isApproved ? (
        <span className="line-clamp-2 font-classical text-[15px] leading-[1.8] text-text-dark">
          «{HADITH.displayText}»
        </span>
      ) : (
        <span className="text-[12px] font-bold text-text-muted">يتعلّم المعنى ثم يطبّقه بعمل في البيت</span>
      )}
      <span className="rounded-pill bg-gold px-[10px] py-[2px] text-[11.5px] font-extrabold text-on-gold">
        مشروع اليوم
      </span>
    </div>
  );
}

/** Quran ↔ Hadith every ~6 s; under reduced motion it stays on the Quran (dots still switch). */
function useScene() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState<Scene>('quran');
  useEffect(() => {
    if (reduce) return;
    // keyed on `scene`, so a dot click restarts the 6 s
    const t = setTimeout(() => setScene((s) => (s === 'quran' ? 'hadith' : 'quran')), SCENE_MS);
    return () => clearTimeout(t);
  }, [reduce, scene]);
  return [scene, setScene] as const;
}

function CallScreen() {
  const [scene, setScene] = useScene();
  return (
    <div className="flex h-full flex-col bg-background">
      <StatusBar />
      <div className="flex grow flex-col items-center gap-[10px] px-[14px] pt-[10px] pb-[24px]">
        {/* LiveHeader */}
        <div className="flex w-full items-center gap-[6px]">
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
          <span className="flex grow items-center justify-center gap-[6px]">
            <span className="flex items-center gap-[5px] rounded-pill border border-berry-border bg-surface px-[10px] py-[4px]">
              <span className="h-[7px] w-[7px] animate-[gh-blink_1.4s_ease-in-out_infinite] rounded-full bg-berry" />
              <span className="text-[13px] font-extrabold text-berry-deep">مباشر</span>
            </span>
            <span className="grid">
              {SCENES.map((k) => (
                <Fade key={k} show={k === scene}>
                  <span
                    className={cx(
                      'rounded-pill border px-[10px] py-[4px] text-[13px] font-extrabold whitespace-nowrap',
                      SCENE_PILL[k].tone,
                    )}
                  >
                    {SCENE_PILL[k].label}
                  </span>
                </Fade>
              ))}
            </span>
            <span dir="ltr" className="font-heading text-[13px] font-bold text-text-muted">
              {toArabicDigits('02')}:{toArabicDigits(14)}
            </span>
          </span>
        </div>
        <TalkingTeacher />
        <span className="-mt-[4px] rounded-pill bg-green-tint px-[12px] py-[3px] text-[13px] font-extrabold text-deep-green">
          {TEACHER_NAME.boy}
        </span>
        {/* the lesson card: the Quran ayah (ONE line, never wrapped) or the hadith card */}
        <div className="grid w-full">
          <Fade show={scene === 'quran'}>
            <QuranCard />
          </Fade>
          <Fade show={scene === 'hadith'}>
            <HadithCard />
          </Fade>
        </div>
        {/* which scene is on (clickable, also under reduced motion) */}
        <span className="flex items-center gap-[6px]">
          {SCENES.map((k) => (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              onClick={() => setScene(k)}
              className={cx(
                'h-[7px] cursor-pointer rounded-pill border-0 p-0 transition-all duration-[400ms]',
                k === scene ? 'w-[18px] bg-primary' : 'w-[7px] bg-border-strong',
              )}
            />
          ))}
        </span>
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

// The phone is laid out at 323×700 (a real ~9:19.5 phone) and scaled as one piece to
// its box's height, so the teacher, card and mic all shrink together.
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
