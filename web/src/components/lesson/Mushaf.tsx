// The surah as a page of the mushaf, clear for children — shared by the lesson (built-in
// and AI) and the landing's phone mockup:
//   a gold cartouche with the surah name, the basmala (verified 1:1, never typed; not for
//   At-Tawbah / Al-Fatiha), then the ayat — ONE AYAH PER CENTERED LINE for a short surah
//   (≤ SHORT_SURAH_AYAT), centered flowing text for a longer one — each followed by its
//   gold number ornament. The font fits the room (22–28 px); the card is as tall as its
//   content. Current ayah: a soft green rounded background; done: normal; upcoming:
//   muted; the whole surah being repeated (no current ayah): no highlight.
import { useEffect, useRef, useState } from 'react';

import { BASMALA, showsBasmala } from '../../content/verified';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';

/** Up to this many ayat: one ayah per line. */
const SHORT_SURAH_AYAT = 8;
const FONT_MAX = 28;
const FONT_MIN = 22;

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
export function SurahBanner({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
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
            سورة {name}
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
    <p dir="rtl" className={cx('m-0 text-center font-ayah leading-[2] text-text-dark', className)}>
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

/**
 * The biggest font (28 → 22 px) at which the card fits its room: the whole height, and
 * (one ayah per line) every line within the width. At 22 px a short surah that still
 * doesn't fit wraps its lines; a long one scrolls inside the card.
 */
function useFit(
  room: React.RefObject<HTMLElement | null>,
  card: React.RefObject<HTMLElement | null>,
  key: string,
) {
  const [fit, setFit] = useState({ px: FONT_MAX, wrap: false });
  useEffect(() => {
    const r = room.current;
    const c = card.current;
    if (!r || !c) return;
    const measure = () => {
      if (r.clientHeight <= 0) return;
      let px = FONT_MAX;
      for (; px >= FONT_MIN; px--) {
        c.style.setProperty('--ayah-px', `${px}px`);
        if (c.scrollHeight <= r.clientHeight - 2 && c.scrollWidth <= c.clientWidth) break; // 2 px: rounding
      }
      const ok = px >= FONT_MIN;
      setFit({ px: ok ? px : FONT_MIN, wrap: !ok });
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(r);
    void document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  }, [room, card, key]);
  return fit;
}

/** The surah card (verified text, current ayah highlighted, tap = hear again) — the lesson's and the AI lesson's. */
export function MushafSurahCard({
  surahName,
  ayat,
  currentAyah,
  reciting,
  playbackBlocked,
  label,
  onTap,
  onPlay,
  playFallback,
}: {
  surahName: string;
  ayat: readonly Ayah[];
  currentAyah: number | null;
  reciting: boolean;
  playbackBlocked: boolean;
  label: string;
  onTap: () => void;
  onPlay: () => void;
  /** The small «play» shown when autoplay was refused. */
  playFallback?: (onTap: () => void) => React.ReactNode;
}) {
  const room = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLElement | null>(null);
  const short = ayat.length <= SHORT_SURAH_AYAT;
  const { px, wrap } = useFit(room, card, `${surahName}:${ayat.length}`);
  // only a surah too long for the room scrolls — and keeps the current ayah in view
  useEffect(() => {
    current.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [currentAyah]);
  const tone = (n: number) => {
    const on = n === currentAyah;
    return {
      on,
      cls: cx(
        'transition-[background-color,color,opacity] duration-300',
        on && 'text-deep-green',
        // done: normal; upcoming: a little muted; the whole surah (no current ayah): all normal
        currentAyah !== null && n > currentAyah && 'opacity-55',
      ),
    };
  };
  return (
    // the room the card may take; the card itself is only as tall as its content
    <div ref={room} className="flex min-h-0 grow flex-col justify-center">
      <div
        ref={card}
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
        style={{ ['--ayah-px' as string]: `${px}px` }}
        className={cx(
          'relative flex max-h-full cursor-pointer [scrollbar-width:none] flex-col gap-[6px] overflow-x-hidden overflow-y-auto rounded-px-24 bg-[color-mix(in_srgb,var(--color-gold-tint)_40%,var(--color-surface))] p-[20px] text-text-dark shadow-lesson-ayah-card [&::-webkit-scrollbar]:hidden',
          reciting ? 'border-[1.5px] border-primary' : 'border border-primary/40',
        )}
      >
        <SurahBanner name={surahName} />
        <Basmala surahName={surahName} className="text-[length:calc(var(--ayah-px)*0.85)]" />
        <div dir="rtl" className="font-ayah text-[length:var(--ayah-px)] leading-[2.1] [word-spacing:0.08em]">
          {short ? (
            // ONE AYAH PER LINE, centered; an ayah never breaks (unless it can't fit even at 22 px)
            ayat.map((a) => {
              const t = tone(a.ayah);
              return (
                <div key={a.ayah} className="text-center">
                  <span
                    ref={t.on ? (el) => void (current.current = el) : undefined}
                    className={cx(
                      'inline-block rounded-lesson-ayah-highlight px-[10px]',
                      wrap ? 'whitespace-normal' : 'whitespace-nowrap',
                      t.on && 'bg-green-tint',
                      t.cls,
                    )}
                  >
                    {a.text}
                    <AyahNumber n={a.ayah} />
                  </span>
                </div>
              );
            })
          ) : (
            // a long surah: centered flowing text; the current ayah as a soft band behind its words
            <p className="m-0 text-center [text-align-last:center]">
              {ayat.map((a) => {
                const t = tone(a.ayah);
                const words = a.text.split(' ');
                const last = words.pop() ?? '';
                return (
                  <span
                    key={a.ayah}
                    ref={t.on ? (el) => void (current.current = el) : undefined}
                    className={cx(
                      'rounded-lesson-ayah-highlight [box-decoration-break:clone] px-[4px] [-webkit-box-decoration-break:clone]',
                      t.on &&
                        'bg-[linear-gradient(to_bottom,transparent_20%,var(--color-green-tint)_20%,var(--color-green-tint)_84%,transparent_84%)]',
                      t.cls,
                    )}
                  >
                    {words.length > 0 && `${words.join(' ')} `}
                    <span className="whitespace-nowrap">
                      {last}
                      <AyahNumber n={a.ayah} />
                    </span>{' '}
                  </span>
                );
              })}
            </p>
          )}
        </div>
        {playbackBlocked && playFallback?.(onPlay)}
      </div>
    </div>
  );
}
