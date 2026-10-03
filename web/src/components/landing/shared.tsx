// Pieces the desktop (WebLanding) and mobile (WebLandingMobile) landing share —
// same art, different sizes, so sizes are props with the frames' exact values.
import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../../i18n/i18n';
import { C } from '../ui/color';
import { PlayGlyph } from '../ui/icons';
import { cx } from '../../lib/cx';

/** One voice note: who speaks, the caption, its (pretend) length in seconds. */
export type VoiceLine = { from: 'teacher' | 'child'; text: string; sec: number };

/**
 * «كيف تعمل غَرْسة»: the three cards' look and their voice notes' order and lengths; the
 * words are in src/i18n (how.steps.<key>). Examples are descriptive on purpose — no ayah,
 * hadith or answer text («سؤال جميل! خلّنا نفهمه معًا…» exactly, never an answer).
 */
export const HOW_STEPS = [
  {
    key: 'quran',
    tint: 'bg-green-tint',
    labelColor: 'text-deep-green',
    childBubble: 'bg-primary/15',
    accent: 'primary',
    accentBg: 'bg-primary',
    chat: [
      { from: 'teacher', sec: 5 },
      { from: 'child', sec: 1 },
    ],
  },
  {
    key: 'hadith',
    tint: 'bg-gold-tint',
    labelColor: 'text-warning-text',
    childBubble: 'bg-gold/15',
    accent: 'goldDeep',
    accentBg: 'bg-gold-deep',
    chat: [
      { from: 'teacher', sec: 4 },
      { from: 'child', sec: 2 },
    ],
  },
  {
    key: 'questions',
    tint: 'bg-berry-tint',
    labelColor: 'text-berry-deep',
    childBubble: 'bg-berry/15',
    accent: 'berry',
    accentBg: 'bg-berry',
    chat: [
      { from: 'child', sec: 3 },
      { from: 'teacher', sec: 2 },
    ],
  },
] as const satisfies readonly {
  key: string;
  tint: string;
  labelColor: string;
  childBubble: string;
  accent: 'primary' | 'goldDeep' | 'berry';
  accentBg: string;
  chat: readonly [Omit<VoiceLine, 'text'>, Omit<VoiceLine, 'text'>];
}[];

export type HowStep = (typeof HOW_STEPS)[number];

/** A card's label (the old «الخطوة n» slot), in the card's accent. */
export function HowLabel({ step, desktop }: { step: HowStep; desktop?: boolean }) {
  const { m } = useI18n();
  return (
    <span className={cx('font-extrabold', step.labelColor, desktop ? 'text-[13px]' : 'text-[12px]')}>
      {m.how.steps[step.key].label}
    </span>
  );
}

const BARS = 16;

/** ~16 waveform bar heights (30–100% of 14px), fixed per line so every render draws the same note. */
function waveform(text: string): number[] {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const envelope = Math.sin(((i + 1) / (BARS + 1)) * Math.PI); // louder mid-note
    return Math.round(30 + 70 * (0.35 * envelope + 0.65 * ((h >>> 16) / 65535)));
  });
}

/**
 * A small WhatsApp-style voice note on one row (play button, waveform, «0:05»), with the
 * words as a one-line muted caption under it. Teacher: white + accent play button, on the start side;
 * child: accent-tinted + white play button, on the other side.
 */
export function VoiceNote({ step, line, playing }: { step: HowStep; line: VoiceLine; playing: boolean }) {
  const teacher = line.from === 'teacher';
  return (
    <div className={cx('flex w-full flex-col gap-[3px]', teacher ? 'items-start' : 'items-end')}>
      <div
        className={cx(
          'flex h-[40px] w-full max-w-[200px] items-center gap-[8px] rounded-px-14 px-[10px] py-[6px] shadow-soft',
          teacher ? 'bg-surface' : step.childBubble,
        )}
      >
        <span
          className={cx(
            'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full',
            teacher ? step.accentBg : 'bg-surface',
          )}
        >
          {/* the play triangle points right in RTL too (media icons are not mirrored) */}
          <span className="translate-x-[1px]">
            <PlayGlyph size={10} color={teacher ? 'surface' : step.accent} />
          </span>
        </span>
        <span className="flex h-[14px] min-w-0 grow items-center gap-[2px]" dir="ltr">
          {waveform(line.text).map((h, i) => (
            <span
              key={i}
              className={cx(
                'w-[2px] shrink-0 rounded-pill',
                step.accentBg,
                playing && 'animate-[gh-wave_.5s_ease-in-out_4_alternate]',
              )}
              style={{ height: `${h}%`, animationDelay: playing ? `${(i % 7) * 60}ms` : undefined }}
            />
          ))}
        </span>
        {/* Latin digits on purpose: at this size the Arabic-Indic zero «٠» reads as a dot */}
        <span dir="ltr" className="shrink-0 text-[12px] font-bold text-text-muted tabular-nums">
          0:0{line.sec}
        </span>
      </div>
      <span
        className={cx(
          'max-w-full truncate px-[4px] text-[13px] leading-[1.4] text-text-muted ltr:line-clamp-2 ltr:whitespace-normal',
          teacher ? 'text-start' : 'text-end',
        )}
      >
        {line.text}
      </span>
    </div>
  );
}

/** Plays the first note's waveform for ~2 s when the card scrolls into view (not under reduced motion). */
function usePlayOnView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        setPlaying(true);
        timer = setTimeout(() => setPlaying(false), 2000);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return { ref, playing };
}

/**
 * «مثال»: a soft tinted box with voice notes — the teacher's white notes on the start
 * side, the child's accent-tinted ones on the other. The words are captions; no audio.
 */
export function HowExample({ step }: { step: HowStep }) {
  const { ref, playing } = usePlayOnView<HTMLDivElement>();
  const { m } = useI18n();
  const words = m.how.steps[step.key];
  return (
    <div ref={ref} className={cx('flex flex-col gap-[10px] rounded-px-18 p-[14px]', step.tint)}>
      <span className="-mb-[4px] text-[12px] leading-[1.2] font-extrabold text-text-muted">
        {m.how.example}
      </span>
      {step.chat.map((line, i) => (
        <VoiceNote
          key={line.from}
          step={step}
          line={{ ...line, text: words[line.from] }}
          playing={playing && i === 0}
        />
      ))}
    </div>
  );
}

/** «اشترك من التطبيق» icon: a phone with a download arrow (design/v3 plan buttons). */
export function PhoneDownloadIcon({
  color = 'surface',
  size = 20,
}: {
  color?: 'surface' | 'textDark';
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="3" stroke={C[color]} strokeWidth="1.9" />
      <path
        d="M12 7.5 V14 M9.4 11.6 L12 14.4 L14.6 11.6"
        stroke={C[color]}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A plan's feature list (the 18px ticks, top-aligned for wrapped lines). */
export function PlanList({
  items,
  text = 'text-[15.5px]',
  gap = 'gap-[12px]',
}: {
  items: readonly string[];
  text?: string;
  gap?: string;
}) {
  return (
    <ul className={cx('m-0 flex list-none flex-col p-0', gap)}>
      {items.map((f) => (
        <li key={f} className={cx('flex items-start gap-[10px] leading-[1.6] text-text-dark', text)}>
          <span className="mt-[2px] shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12.5 L10 17.5 L19 7"
                stroke={C.deepGreen}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {f}
        </li>
      ))}
    </ul>
  );
}

/** Icons of the «مصادرنا» / «الخصوصية» cards, in the frames' tones. */
export const SourceIcons = {
  quran: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
        stroke={C.deepGreen}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 5.8 V18.8" stroke={C.deepGreen} strokeWidth="1.9" />
    </svg>
  ),
  recitation: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 14 V10 C5 6.1 8.1 3 12 3 C15.9 3 19 6.1 19 10 V14"
        stroke={C.skyText}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <rect x="3" y="13" width="4.5" height="7" rx="2.2" stroke={C.skyText} strokeWidth="1.9" />
      <rect x="16.5" y="13" width="4.5" height="7" rx="2.2" stroke={C.skyText} strokeWidth="1.9" />
    </svg>
  ),
  tafsir: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 4.5 H19 V19.5 H5 Z" stroke={C.ayahBracket} strokeWidth="1.9" strokeLinejoin="round" />
      <path
        d="M8.5 9 H15.5 M8.5 12.5 H15.5 M8.5 16 H12.5"
        stroke={C.ayahBracket}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  hadith: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4 H17 C18.7 4 20 5.3 20 7 V20 H9.5 C8 20 7 18.8 7 17.3 Z"
        stroke={C.berryDeep}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M7 4 C5.3 4 4 5.3 4 7 C4 8.2 4.9 9 6 9 H7"
        stroke={C.berryDeep}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  ),
  shieldOnDark: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 L20 6.5 V12 C20 16.5 16.6 19.9 12 21 C7.4 19.9 4 16.5 4 12 V6.5 Z"
        stroke={C.surface}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 12.2 L11 14.6 L15.6 10"
        stroke={C.surface}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  noMic: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke={C.berryDeep} strokeWidth="2" />
      <path
        d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
        stroke={C.berryDeep}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M4.2 19.8 L19.8 4.2" stroke={C.berryDeep} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  project: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 64 64" fill="none">
      <path d="M32 38 V18" stroke={C.berryDeep} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 28 C24 28 19 23 19 15 C27 15 32 20 32 28 Z" fill={C.berry} />
      <path
        d="M6 38 C6 50 17 58 32 58 C47 58 58 50 58 38 C58 34 54 32 51 34 L40 41 L24 41 L13 34 C10 32 6 34 6 38 Z"
        fill={C.gold}
      />
    </svg>
  ),
  question: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={C.berryDeep} strokeWidth="1.9" />
      <path
        d="M9.4 9.4 C9.4 7.9 10.6 6.9 12 6.9 C13.5 6.9 14.6 7.9 14.6 9.3 C14.6 11.3 12 11.4 12 13.6"
        stroke={C.berryDeep}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.9" r="1.2" fill={C.berryDeep} />
    </svg>
  ),
};
