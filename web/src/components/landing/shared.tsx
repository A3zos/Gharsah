// Pieces the desktop (WebLanding) and mobile (WebLandingMobile) landing share —
// same art, different sizes, so sizes are props with the frames' exact values.
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { PILOT_CTA, PILOT_DAYS, PILOT_ITEMS, PILOT_NAME, PILOT_PRICE } from '../../content/pilot';
import { verifiedAyah } from '../../content/verified';
import { toArabicDigits } from '../../lib/arabicDigits';
import { buttonClass } from '../ui/Button';
import { TeacherArt } from '../child/TeacherArt';
import { AyahText } from '../ui/AyahText';
import { C } from '../ui/color';
import { MicIcon } from '../ui/icons';
import { cx } from '../../lib/cx';

// Surah Al-Ikhlas 112:1 — the lesson's first ayah, from the verified asset.
const AYAH = verifiedAyah(112, 1);

/** The phone showing a live lesson (hero). Desktop = design/v3 WebLandingLaptop; mobile = WebLandingMobile. */
export function PhoneMock({ desktop }: { desktop?: boolean }) {
  if (desktop) {
    return (
      <div
        aria-hidden="true"
        className="flex h-[540px] w-[320px] shrink-0 animate-[gh-float-4_5s_ease-in-out_infinite] flex-col items-center gap-[10px] overflow-hidden rounded-px-40 border-[9px] border-text-dark bg-surface px-[14px] py-[16px] shadow-dark-26-52-18"
      >
        <span className="flex shrink-0 items-center gap-[7px] rounded-pill bg-berry-tint px-[13px] py-[7px]">
          <span className="h-[7px] w-[7px] rounded-full bg-berry" />
          <span className="text-[14px] font-extrabold text-berry-deep">مباشر</span>
        </span>
        <span className="shrink-0">
          <svg width="104" height="104" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill={C.greenTint} />
            <path d="M13 60 C13 47 21 40 32 40 C43 40 51 47 51 60 Z" fill={C.avatarCap} />
            <ellipse cx="32" cy="29" rx="11.5" ry="13" fill={C.avatarSkinTan} />
            <path d="M19 24 C19 16 24 11 32 11 C40 11 45 16 45 24 Z" fill={C.surface} />
            <path d="M19.5 25 H44.5" stroke={C.borderStrong} strokeWidth="2" strokeLinecap="round" />
            <circle cx="27.5" cy="30" r="2.2" fill={C.avatarFeatures} />
            <circle cx="37" cy="30" r="2.2" fill={C.avatarFeatures} />
            <path
              d="M28.5 36.5 C30.5 38.5 34 38.5 36.5 36.5"
              stroke={C.avatarFeatures}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="shrink-0 text-center text-[14px] leading-[1.7] font-bold text-text-muted">
          استمع للآية… وأنا صامت معك
        </span>
        <span className="flex w-full shrink-0 flex-col items-center gap-[7px] rounded-px-20 border-[1.5px] border-border bg-background px-[12px] py-[16px]">
          <AyahText text={AYAH.text} className="text-[25px] leading-[1.9]" />
          <span className="text-[14px] font-bold text-text-muted">{AYAH.reference}</span>
        </span>
        <span className="mt-auto flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-gold">
          <MicIcon size={28} />
        </span>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex w-[290px] flex-col items-center gap-[10px] overflow-hidden rounded-px-36 border-[8px] border-text-dark bg-surface px-[13px] py-[16px] shadow-dark-22-44-16"
    >
      <span className="flex items-center gap-[6px] rounded-pill border border-berry-border bg-surface px-[11px] py-[5px]">
        <span className="h-[6px] w-[6px] animate-[gh-blink_1.4s_ease-in-out_infinite] rounded-full bg-berry" />
        <span className="text-[11px] font-extrabold text-berry-deep">مباشر</span>
      </span>
      <span className="animate-[gh-bob-2_1.9s_ease-in-out_infinite]">
        <TeacherArt size={118} detailed={false} arcs="single" />
      </span>
      <p className="m-0 text-center text-[13.5px] font-bold text-text-dark">استمع للآية… وأنا صامت معك</p>
      <div className="flex w-full flex-col items-center gap-[7px] rounded-px-22 border-[1.5px] border-border bg-surface px-[12px] py-[14px]">
        <AyahText text={AYAH.text} className="text-[21px] leading-[1.9]" bracketClassName="text-[24px]" />
        <span className="text-[11px] font-bold text-text-muted">{AYAH.reference}</span>
      </div>
      <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-gold shadow-gold-10-20-40">
        <MicIcon size={32} />
      </span>
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
  phone: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="6" y="2.5" width="12" height="19" rx="3" stroke={C.warningText} strokeWidth="1.9" />
      <path d="M10.5 18.5 H13.5" stroke={C.warningText} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
};

/** «الباقة التجريبية» — the current offer on the landing page (the pilot plan). */
export function PilotOffer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        'relative flex w-full flex-col rounded-px-32 border-[2.5px] border-primary bg-surface',
        compact ? 'gap-[14px] px-[22px] pt-[28px] pb-[22px]' : 'gap-[18px] px-[32px] pt-[38px] pb-[32px]',
      )}
    >
      <span
        className={cx(
          'absolute right-[24px] rounded-pill bg-primary font-extrabold text-surface',
          compact
            ? '-top-[14px] px-[15px] py-[7px] text-[12px]'
            : '-top-[15px] px-[18px] py-[8px] text-[13px]',
        )}
      >
        العرض الحالي
      </span>
      <h3 className={cx('m-0 font-heading font-bold', compact ? 'text-[21px]' : 'text-[24px]')}>
        {PILOT_NAME}
      </h3>
      {/* The price spot: the pilot is free. */}
      <span
        className={cx(
          'font-heading leading-[1] font-extrabold text-deep-green',
          compact ? 'text-[48px]' : 'text-[62px]',
        )}
      >
        {PILOT_PRICE}
      </span>
      <span className="self-start rounded-pill bg-gold-tint px-[14px] py-[8px] text-[14px] font-bold text-warning-text">
        {toArabicDigits(PILOT_DAYS.length)} أيام — يومًا بعد يوم، بالترتيب
      </span>
      <div className="h-[1px] bg-border" />
      <PlanList items={PILOT_ITEMS} text={compact ? 'text-[14px]' : undefined} />
      <ol className="m-0 flex flex-col gap-[6px] ps-[20px] text-[14px] leading-[1.7] text-text-muted">
        {PILOT_DAYS.map((d) => (
          <li key={d.lessonId}>
            اليوم {toArabicDigits(d.day)}: سورة {d.surahName} + {d.hadithTitle}
          </li>
        ))}
      </ol>
      <Link
        to={paths.signup}
        className={buttonClass(
          'primary',
          'custom',
          cx(
            'mt-auto gap-[10px] font-heading font-bold shadow-lesson-home-button',
            compact ? 'h-[58px] rounded-px-20 text-[17px]' : 'h-[62px] rounded-px-22 text-[19px]',
          ),
        )}
      >
        {PILOT_CTA}
      </Link>
    </div>
  );
}

/** Monthly / yearly — shown with their prices, but not on sale yet («قريبًا»). */
export function ComingSoonPlan({
  title,
  price,
  per,
  items,
  compact = false,
}: {
  title: string;
  price: string;
  per: string;
  items: readonly string[];
  compact?: boolean;
}) {
  return (
    <div
      aria-disabled="true"
      className={cx(
        'relative flex flex-col rounded-px-32 border-[1.5px] border-border bg-surface opacity-80',
        compact
          ? 'gap-[14px] px-[22px] pt-[26px] pb-[22px]'
          : 'grow basis-0 gap-[16px] px-[30px] pt-[34px] pb-[28px]',
      )}
    >
      <span
        className={cx(
          'absolute right-[24px] rounded-pill bg-gold-tint font-extrabold text-warning-text',
          compact
            ? '-top-[13px] px-[14px] py-[6px] text-[12px]'
            : '-top-[14px] px-[16px] py-[7px] text-[13px]',
        )}
      >
        قريبًا
      </span>
      <h3 className={cx('m-0 font-heading font-bold', compact ? 'text-[21px]' : 'text-[22px]')}>{title}</h3>
      <span className="flex items-baseline gap-[8px]">
        <span
          className={cx(
            'font-heading leading-[1] font-extrabold text-text-dark',
            compact ? 'text-[44px]' : 'text-[52px]',
          )}
        >
          {price}
        </span>
        <span className="text-[16px] font-bold text-text-muted">{per}</span>
      </span>
      <div className="h-[1px] bg-border" />
      <PlanList items={items} text="text-[14px]" gap="gap-[10px]" />
      <span
        className={cx(
          'mt-auto flex items-center justify-center rounded-px-20 bg-border-soft font-heading font-bold text-text-muted',
          compact ? 'h-[54px] text-[16px]' : 'h-[56px] text-[17px]',
        )}
      >
        قريبًا
      </span>
    </div>
  );
}
