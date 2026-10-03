// Pieces the desktop (WebLanding) and mobile (WebLandingMobile) landing share —
// same art, different sizes, so sizes are props with the frames' exact values.
import { useEffect, useRef, useState } from 'react';

import { toArabicDigits } from '../../lib/arabicDigits';
import { C } from '../ui/color';
import { PlayGlyph } from '../ui/icons';
import { cx } from '../../lib/cx';

/** «كيف تعمل غَرْسة»: the three cards. Examples are descriptive on purpose — no ayah, hadith or answer text. */
export const HOW_STEPS = [
  {
    key: 'quran',
    label: 'القرآن',
    title: 'يحفظ القرآن مع معلّم ذكي',
    body: 'يسمع الطفل الآية من قارئ متقن، ثم يردّدها بصوته، والمعلّم يشجّعه ويعدّ معه حتى يتقنها.',
    tint: 'bg-green-tint',
    labelColor: 'text-deep-green',
    childBubble: 'bg-primary/15',
    accent: 'primary',
    accentBg: 'bg-primary',
    chat: [
      { from: 'teacher', text: 'اليوم سورة الإخلاص 🌱 اسمعها من القارئ، ثم ردّدها معي آية آية.' },
      { from: 'child', text: 'جاهز!' },
    ],
  },
  {
    key: 'hadith',
    label: 'الحديث',
    title: 'يفهم الحديث ويطبّقه',
    body: 'يتعلّم الطفل حديثًا قصيرًا ومعناه بكلمات بسيطة، ثم يحوّله إلى عمل حقيقي في البيت.',
    tint: 'bg-gold-tint',
    labelColor: 'text-warning-text',
    childBubble: 'bg-gold/15',
    accent: 'goldDeep',
    accentBg: 'bg-gold-deep',
    chat: [
      { from: 'teacher', text: 'حديث اليوم عن برّ الوالدين 💛 ما الشيء الذي ستفعله لأمك اليوم؟' },
      { from: 'child', text: 'سأساعدها في ترتيب البيت' },
    ],
  },
  {
    key: 'questions',
    label: 'أسئلة الطفل',
    title: 'يجيب عن تساؤلاته عن الإسلام',
    body: 'يسأل الطفل بصوته عمّا يحيّره، فيجيبه المعلّم بلغة تناسب عمره، من إجابات مراجَعة من مختصين.',
    tint: 'bg-berry-tint',
    labelColor: 'text-berry-deep',
    childBubble: 'bg-berry/15',
    accent: 'berry',
    accentBg: 'bg-berry',
    chat: [
      { from: 'child', text: 'ليش خلق الله النار؟' },
      { from: 'child', text: 'ليش نصلي خمس صلوات في اليوم؟' },
      // Exactly this — the landing never shows an answer's religious content.
      { from: 'teacher', text: 'سؤال جميل! خلّنا نفهمه معًا…' },
    ],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  title: string;
  body: string;
  tint: string;
  labelColor: string;
  childBubble: string;
  accent: 'primary' | 'goldDeep' | 'berry';
  accentBg: string;
  chat: readonly { from: 'teacher' | 'child'; text: string }[];
}[];

export type HowStep = (typeof HOW_STEPS)[number];

/** A card's label (the old «الخطوة n» slot), in the card's accent. */
export function HowLabel({ step, desktop }: { step: HowStep; desktop?: boolean }) {
  return (
    <span className={cx('font-extrabold', step.labelColor, desktop ? 'text-[13px]' : 'text-[12px]')}>
      {step.label}
    </span>
  );
}

const BARS = 28;

/** ~28 waveform bar heights (25–100%), fixed per line so every render draws the same note. */
function waveform(text: string): number[] {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const envelope = Math.sin(((i + 1) / (BARS + 1)) * Math.PI); // louder mid-note
    return Math.round(25 + 75 * (0.35 * envelope + 0.65 * ((h >>> 16) / 65535)));
  });
}

/** «٠:٠٤» — a plausible length for the line (no real audio). */
function noteDuration(text: string): string {
  const sec = Math.min(9, Math.max(1, Math.round(text.length / 13)));
  return `${toArabicDigits(0)}:${toArabicDigits(0)}${toArabicDigits(sec)}`;
}

/** One voice note (WhatsApp-style): speaker tag, play button, waveform, duration, then the words. */
function VoiceNote({
  step,
  from,
  text,
  playing,
  desktop,
}: {
  step: HowStep;
  from: 'teacher' | 'child';
  text: string;
  playing: boolean;
  desktop?: boolean;
}) {
  const teacher = from === 'teacher';
  return (
    <div
      className={cx(
        'flex min-h-[84px] w-[calc(100%-40px)] flex-col gap-[6px] rounded-px-22 px-[14px] pt-[10px] pb-[12px] shadow-soft',
        teacher ? 'self-start bg-surface' : cx('self-end', step.childBubble),
      )}
    >
      <span className={cx('text-[12px] font-extrabold', step.labelColor)}>
        {teacher ? 'المعلّم' : 'الطفل'}
      </span>
      <span className="flex items-center gap-[10px]">
        <span
          className={cx(
            'flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full',
            teacher ? step.accentBg : 'bg-surface shadow-soft',
          )}
        >
          {/* the play triangle points right in RTL too (media icons are not mirrored) */}
          <span className="translate-x-[1.5px]">
            <PlayGlyph size={15} color={teacher ? 'surface' : step.accent} />
          </span>
        </span>
        <span className="flex h-[28px] min-w-0 grow items-center gap-[2px]" dir="ltr">
          {waveform(text).map((h, i) => (
            <span
              key={i}
              className={cx(
                'w-[3px] min-w-[2px] shrink rounded-pill',
                step.accentBg,
                playing && 'animate-[gh-wave_.5s_ease-in-out_4_alternate]',
              )}
              style={{ height: `${h}%`, animationDelay: playing ? `${(i % 7) * 60}ms` : undefined }}
            />
          ))}
        </span>
        <span dir="ltr" className="shrink-0 font-heading text-[12.5px] font-bold text-text-muted">
          {noteDuration(text)}
        </span>
      </span>
      <span
        className={cx('leading-[1.7] font-bold text-text-dark', desktop ? 'text-[16.5px]' : 'text-[16px]')}
      >
        {text}
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
export function HowExample({ step, desktop }: { step: HowStep; desktop?: boolean }) {
  const { ref, playing } = usePlayOnView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cx(
        'flex flex-col gap-[10px] rounded-px-18',
        step.tint,
        desktop ? 'px-[14px] pt-[10px] pb-[14px]' : 'px-[12px] pt-[8px] pb-[12px]',
      )}
    >
      <span className="text-[11.5px] font-extrabold text-text-muted">مثال</span>
      {step.chat.map((m, i) => (
        <VoiceNote
          key={m.text}
          step={step}
          from={m.from}
          text={m.text}
          playing={playing && i === 0}
          desktop={desktop}
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

/** The parent-dashboard preview card (growth path + four counts). */
export function DashboardPreview({ desktop }: { desktop?: boolean }) {
  const stages = [
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
      size: desktop ? 26 : 21,
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
      size: desktop ? 28 : 23,
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
      size: desktop ? 28 : 23,
    },
  ];
  const counts = [
    { n: '٨', label: 'سور', color: 'text-deep-green' },
    { n: '٦٤', label: 'آية', color: 'text-sky-text' },
    { n: '١٢', label: 'حديثًا', color: 'text-berry-deep' },
    { n: '٩', label: 'مشاريع', color: 'text-warning-text' },
  ];
  return (
    <div
      aria-label="مثال للوحة المتابعة"
      className={cx(
        'flex flex-col border-[1.5px] border-border bg-background',
        desktop ? 'gap-[20px] rounded-px-30 p-[26px]' : 'gap-[16px] rounded-px-26 p-[20px]',
      )}
    >
      <div className={cx('flex items-center', desktop ? 'gap-[14px]' : 'gap-[12px]')}>
        <span
          className={cx(
            'flex items-center justify-center bg-green-tint font-heading font-extrabold text-deep-green',
            desktop
              ? 'h-[54px] w-[54px] rounded-px-18 text-[22px]'
              : 'h-[46px] w-[46px] rounded-px-16 text-[19px]',
          )}
        >
          ع
        </span>
        <span className={cx('flex grow flex-col', desktop ? 'gap-[3px]' : 'gap-[2px]')}>
          <span className={cx('font-extrabold', desktop ? 'text-[17px]' : 'text-[15.5px]')}>عبدالله</span>
          <span className={cx('text-text-muted', desktop ? 'text-[13px]' : 'text-[12.5px]')}>
            {desktop ? '١٠ سنوات · خطة سنوية' : '١٠ سنوات'}
          </span>
        </span>
        <span
          className={cx(
            'rounded-pill bg-gold-tint font-extrabold text-warning-text',
            desktop ? 'px-[13px] py-[7px] text-[12.5px]' : 'px-[11px] py-[6px] text-[11.5px]',
          )}
        >
          {desktop ? '٥ أيام متتالية' : '٥ أيام'}
        </span>
      </div>
      <div
        className={cx(
          'flex flex-col bg-surface',
          desktop
            ? 'gap-[14px] rounded-px-22 px-[18px] py-[20px]'
            : 'gap-[12px] rounded-px-20 px-[14px] py-[16px]',
        )}
      >
        <span className={cx('font-extrabold text-text-muted', desktop ? 'text-[13.5px]' : 'text-[12.5px]')}>
          مسار النموّ
        </span>
        <div className={cx('flex items-start [direction:ltr]', desktop ? 'gap-[6px]' : 'gap-[4px]')}>
          {stages.map((s) => (
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
                {s.art(s.size)}
              </span>
              <span className={cx('font-extrabold', desktop ? 'text-[12.5px]' : 'text-[11.5px]', s.text)}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-[8px] overflow-hidden rounded-px-4 bg-border [direction:ltr]">
          <span className="block h-[8px] w-[52%] rounded-px-4 bg-primary" />
        </div>
      </div>
      <div className={cx('flex', desktop ? 'gap-[10px]' : 'gap-[8px]')}>
        {counts.map((c) => (
          <div
            key={c.label}
            className={cx(
              'flex grow flex-col items-center bg-surface',
              desktop
                ? 'gap-[3px] rounded-px-18 px-[10px] py-[14px]'
                : 'gap-[2px] rounded-px-16 px-[6px] py-[12px]',
            )}
          >
            <span
              className={cx('font-heading font-extrabold', desktop ? 'text-[22px]' : 'text-[19px]', c.color)}
            >
              {c.n}
            </span>
            <span className="text-[12px] font-bold text-text-muted">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
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
