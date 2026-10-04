// The surah as a page of the mushaf. The lesson's card (built-in and AI) is MushafSurahCard —
// a King Fahd Complex mushaf page (see its doc). SurahBanner / Basmala / AyahNumber are the
// landing phone mockup's smaller pieces (unchanged).
import { useEffect, useRef } from 'react';

import { BASMALA, showsBasmala } from '../../content/verified';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';

/** A small gold diamond for the cartouche's ends. */
function Ornament() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      <path d="M7 1 L13 7 L7 13 L1 7 Z" fill="none" stroke={C.ayahBracket} strokeWidth="1.2" />
      <path d="M7 4.2 L9.8 7 L7 9.8 L4.2 7 Z" fill={C.gold} />
    </svg>
  );
}

/** The surah's banner: a rounded cartouche, thin double gold border, the name centered. */
export function SurahBanner({
  name,
  label,
  size = 'md',
}: {
  name: string;
  /** Replaces «سورة {name}» (the English landing's «Surah Al-Ikhlas»). */
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex justify-center" aria-hidden="true">
      <div className="rounded-pill border border-gold-border p-[3px]">
        <div
          className={cx(
            'flex items-center gap-[10px] rounded-pill border-[1.5px] border-ayah-bracket/60 bg-gold-tint',
            size === 'sm' ? 'px-[12px] py-[2px]' : 'px-[18px] py-[3px]',
          )}
        >
          <Ornament />
          <span
            className={cx(
              'font-classical leading-[1.6] font-bold whitespace-nowrap text-on-gold',
              size === 'sm' ? 'text-[15px]' : 'text-[18px]',
            )}
          >
            {label ?? `سورة ${name}`}
          </span>
          <Ornament />
        </div>
      </div>
    </div>
  );
}

/** The basmala line (verified text) — or nothing for At-Tawbah / Al-Fatiha. */
export function Basmala({ surahName, className }: { surahName: string; className?: string }) {
  if (!showsBasmala(surahName)) return null;
  return (
    <p dir="rtl" lang="ar" className={cx('m-0 text-center font-ayah leading-[2] text-text-dark', className)}>
      {BASMALA}
    </p>
  );
}

/** ﴿١﴾ — gold, a little smaller than the text, centered with it; never apart from its ayah. */
export function AyahNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="mx-[3px] inline-block [vertical-align:0.18em] text-[0.8em] leading-none text-ayah-bracket"
    >
      ﴿{toArabicDigits(n)}﴾
    </span>
  );
}

type Ayah = { readonly ayah: number; readonly text: string };

/** A small floral rosette (the header band's ends): petals, a double ring, a gold heart. */
function BandRosette({ size }: { size: number }) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      {petals.map((deg) => (
        <ellipse
          key={deg}
          cx="20"
          cy="7.2"
          rx="3.4"
          ry="5.6"
          transform={`rotate(${deg} 20 20)`}
          fill={C.goldTint}
          stroke={C.ayahBracket}
          strokeWidth="0.9"
        />
      ))}
      <circle cx="20" cy="20" r="10.4" fill={C.goldTint} stroke={C.ayahBracket} strokeWidth="1.1" />
      <circle cx="20" cy="20" r="8.2" fill="none" stroke={C.ayahBracket} strokeWidth="0.6" />
      <circle cx="20" cy="20" r="4.4" fill={C.gold} stroke={C.ayahBracket} strokeWidth="0.7" />
    </svg>
  );
}

/**
 * The surah's header like a printed mushaf: a full-width beige band with a thin brown double
 * border, a floral rosette at each end, and a centred cartouche with «سورة …» in Amiri bold.
 * CSS + inline SVG, so it scales with the card.
 */
export function MushafHeader({ name, label }: { name: string; label?: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex w-full shrink-0 items-center justify-between gap-[6px] rounded-px-6 border border-ayah-bracket/70 bg-gold-tint px-[6px] py-[5px] shadow-[inset_0_0_0_2px_var(--color-gold-tint),inset_0_0_0_3px_color-mix(in_srgb,var(--color-ayah-bracket)_45%,transparent)]"
    >
      <BandRosette size={34} />
      <span className="relative mx-auto inline-grid min-w-0 place-items-center px-[26px] py-[4px]">
        {/* the cartouche: pointed-round ends, a double outline */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M14 2 H186 C196 2 199 12 199 20 C199 28 196 38 186 38 H14 C4 38 1 28 1 20 C1 12 4 2 14 2 Z"
            fill={C.surface}
            stroke={C.ayahBracket}
            strokeWidth="1.3"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M16 5.5 H184 C192 5.5 195.5 13 195.5 20 C195.5 27 192 34.5 184 34.5 H16 C8 34.5 4.5 27 4.5 20 C4.5 13 8 5.5 16 5.5 Z"
            fill="none"
            stroke={C.gold}
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="relative font-classical text-[19px] leading-[1.7] font-bold whitespace-nowrap text-on-gold min-[520px]:text-[21px]">
          {label ?? `سورة ${name}`}
        </span>
      </span>
      <BandRosette size={34} />
    </div>
  );
}

/**
 * The end-of-ayah rosette (~1.15em, inline): a cream disc in a thin gold/brown double ring
 * with small petals, the Arabic-Indic number centred (in Amiri: the KFGQPC font draws its own
 * ayah-end ornament around every digit, which would nest a second, tiny frame). Same size for every
 * number; never the first thing on a line (see the nowrap with the ayah's last word).
 */
export function AyahRosette({ n }: { n: number }) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <span
      aria-hidden="true"
      className="relative mx-[0.15em] inline-flex h-[1.15em] w-[1.15em] items-center justify-center align-middle"
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {petals.map((deg) => (
          <circle
            key={deg}
            cx="20"
            cy="2.6"
            r="1.6"
            transform={`rotate(${deg} 20 20)`}
            fill={C.ayahBracket}
          />
        ))}
        <circle cx="20" cy="20" r="16" fill={C.goldTint} stroke={C.ayahBracket} strokeWidth="1.4" />
        <circle cx="20" cy="20" r="13" fill="none" stroke={C.gold} strokeWidth="1" />
      </svg>
      <span className="relative font-classical text-[0.58em] leading-none font-bold text-on-gold">
        {toArabicDigits(n)}
      </span>
    </span>
  );
}

/**
 * The surah card of the live lesson (built-in and AI) — a page of the King Fahd Complex mushaf:
 * the ornamental header band, the basmala on its own line (verified 1:1 text; not At-Tawbah,
 * not Al-Fatiha where it is ayah 1), then ALL the ayat as ONE justified paragraph in the
 * KFGQPC Hafs font (24 px phone / 30 px wider, line-height 2.3), each ayah ending in its
 * rosette. The verified Tanzil Uthmani text exactly as loaded — never typed or altered.
 * Current ayah: a soft gold band (clone-decorated, the flow stays justified); finished ayat
 * at 70%; the rest normal; the whole surah being repeated (no current ayah): all normal.
 * A long surah scrolls inside the card and keeps the current ayah in view.
 */
export function MushafSurahCard({
  surahName,
  ayat,
  currentAyah,
  playbackBlocked,
  label,
  bannerLabel,
  onTap,
  onPlay,
  playFallback,
}: {
  surahName: string;
  ayat: readonly Ayah[];
  currentAyah: number | null;
  /** The reciter is playing (kept for callers; the card itself no longer changes its border). */
  reciting: boolean;
  playbackBlocked: boolean;
  label: string;
  /** The header's text in the UI language («Surah Al-Ikhlas»); default «سورة {name}». */
  bannerLabel?: string;
  onTap: () => void;
  onPlay: () => void;
  /** The small «play» shown when autoplay was refused. */
  playFallback?: (onTap: () => void) => React.ReactNode;
}) {
  const current = useRef<HTMLElement | null>(null);
  useEffect(() => {
    current.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [currentAyah]);
  return (
    // the room the card may take; the card itself is only as tall as its content
    <div className="flex min-h-0 grow flex-col justify-center">
      <div
        role="button"
        tabIndex={0}
        onClick={onTap}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap();
          }
        }}
        aria-label={label}
        className="relative mx-auto flex max-h-full w-full max-w-[620px] cursor-pointer [scrollbar-width:none] flex-col gap-[10px] overflow-x-hidden overflow-y-auto rounded-px-24 border border-gold-border bg-[linear-gradient(180deg,var(--color-background),color-mix(in_srgb,var(--color-gold-tint)_55%,var(--color-background)))] px-[18px] py-[20px] text-[24px] text-text-dark shadow-lesson-ayah-card min-[520px]:px-[26px] min-[520px]:py-[24px] min-[520px]:text-[30px] [&::-webkit-scrollbar]:hidden"
      >
        <MushafHeader name={surahName} label={bannerLabel} />
        {showsBasmala(surahName) && (
          <p
            dir="rtl"
            lang="ar"
            className="m-0 text-center font-mushaf text-[0.86em] leading-[2.1] tracking-normal"
          >
            {BASMALA}
          </p>
        )}
        {/* The verified ayat: Arabic, right-to-left, in every UI language — one flowing paragraph. */}
        <p
          dir="rtl"
          lang="ar"
          className="m-0 text-justify font-mushaf leading-[2.3] tracking-normal [text-align-last:center]"
        >
          {ayat.map((a) => {
            const on = a.ayah === currentAyah;
            const done = currentAyah !== null && a.ayah < currentAyah;
            const words = a.text.split(' ');
            const last = words.pop() ?? '';
            return (
              <span
                key={a.ayah}
                ref={on ? (el) => void (current.current = el) : undefined}
                data-ayah={a.ayah}
                className={cx(
                  'rounded-[0.35em] [box-decoration-break:clone] transition-[background-color,opacity] duration-300 [-webkit-box-decoration-break:clone]',
                  on && 'bg-gold-tint shadow-[0_0_0_0.12em_var(--color-gold-tint)]',
                  done && 'opacity-70',
                )}
              >
                {words.length > 0 && `${words.join(' ')} `}
                {/* the last word and its rosette stay together: a rosette never starts a line */}
                <span className="whitespace-nowrap">
                  {last}
                  <AyahRosette n={a.ayah} />
                </span>{' '}
              </span>
            );
          })}
        </p>
        {playbackBlocked && playFallback?.(onPlay)}
      </div>
    </div>
  );
}
