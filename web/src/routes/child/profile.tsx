import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { ChildAvatar } from '../../components/child/ChildAvatar';
import { useChildData } from '../../components/child/ChildData';
import { ChildPage } from '../../components/child/ChildShell';
import { GrowthPath } from '../../components/child/GrowthPath';
import { C } from '../../components/ui/color';
import { ageLabel, headline, STAGE_LABEL } from '../../data/stats';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { daysPhrase, plural } from '../../lib/plural';
import type { Route } from './+types/profile';

export const meta: Route.MetaFunction = () => [{ title: 'ملفّي — غَرْسة' }];

const SHORT_DAY = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

/** «معي منذ ٣ أشهر» from when the parent added the child. */
function sinceText(created: Date | null, now = new Date()): string {
  if (!created) return '';
  const days = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
  if (days < 7) return days <= 1 ? 'معي منذ اليوم' : `معي منذ ${daysPhrase(days)}`;
  if (days < 30)
    return `معي منذ ${plural(Math.floor(days / 7), { one: 'أسبوع', two: 'أسبوعين', few: 'أسابيع', many: 'أسبوعًا' })}`;
  return `معي منذ ${plural(Math.floor(days / 30), { one: 'شهر', two: 'شهرين', few: 'أشهر', many: 'شهرًا' })}`;
}

/** Riyadh-date key YYYY-MM-DD (stats.lessonDays uses the plan time zone). */
const dayKey = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

/** design/v2 ChildProfile — «ملفّي»: avatar, stage, streak, badges. */
export default function ChildProfileRoute() {
  const { child } = useChildData();
  if (!child) {
    return (
      <ChildPage tab="profile" blob="page">
        <div aria-busy="true" className="grow" />
      </ChildPage>
    );
  }
  const h = headline(child);
  const lessonDays = new Set(
    (Array.isArray(child.stats?.lessonDays) ? (child.stats!.lessonDays as unknown[]) : []).filter(
      (d): d is string => typeof d === 'string',
    ),
  );
  const now = new Date();
  const last5 = [4, 3, 2, 1, 0].map((back) => {
    const d = new Date(now.getTime() - back * 86_400_000);
    return {
      key: dayKey(d),
      label: back === 0 ? 'اليوم' : SHORT_DAY[new Date(d.getTime() + 3 * 3_600_000).getUTCDay()]!,
      today: back === 0,
    };
  });
  const next =
    h.stage === 'seed' ? { at: 34, name: 'غَرْسة' } : h.stage === 'sprout' ? { at: 67, name: 'شجرة' } : null;
  // REVIEW: the design's «باقٍ ٤ حصص وتصير شجرة!» — lessons-to-go isn't known yet, so it counts plan percent.
  const toNext = next
    ? `باقٍ ${toArabicDigits(next.at - h.planPct)}٪ من خطتك وتصير ${next.name}!`
    : 'وصلت إلى الشجرة — استمر!';

  const badges = [
    {
      on: h.surahs >= 1,
      label: 'أول سورة',
      tint: 'bg-green-tint',
      ink: 'text-deep-green',
      icon: <BadgeBook />,
    },
    { on: h.ayat >= 50, label: '٥٠ آية', tint: 'bg-sky-tint', ink: 'text-sky-text', icon: <BadgeSpark /> },
    {
      on: h.streak >= 5,
      label: '٥ أيام',
      tint: 'bg-berry-tint',
      ink: 'text-berry-deep',
      icon: <BadgeFlame />,
    },
    {
      on: h.projects >= 1,
      label: 'أول مشروع',
      tint: 'bg-gold-tint',
      ink: 'text-warning-text',
      icon: <BadgeProject />,
    },
    {
      on: h.streak >= 30,
      label: '٣٠ يومًا',
      tint: 'bg-berry-tint',
      ink: 'text-berry-deep',
      icon: <BadgeFlame />,
    },
    {
      on: h.hadith >= 10,
      label: '١٠ أحاديث',
      tint: 'bg-berry-tint',
      ink: 'text-berry-deep',
      icon: <BadgeBook color="berryDeep" />,
    },
  ];

  return (
    <ChildPage tab="profile" blob="page" className="gap-[16px] pt-[26px]">
      <h1 className="m-0 font-heading text-[26px] leading-[1.4] font-bold">ملفّي</h1>

      <section className="flex flex-col items-center gap-[12px] rounded-px-30 bg-surface px-[20px] py-[24px] shadow-dark-14-30-5">
        <span className="animate-[gh-float_4s_ease-in-out_infinite]">
          <ChildAvatar id={child.avatarId} size={104} />
        </span>
        <span className="font-heading text-[28px] font-bold">{child.name}</span>
        <span className="text-[13.5px] font-bold text-text-muted">
          {ageLabel(child.age)}
          {child.createdAt && ` · ${sinceText(child.createdAt)}`}
        </span>
      </section>

      <section
        aria-labelledby="stage-title"
        className="flex flex-col gap-[14px] rounded-px-26 bg-surface px-[18px] py-[20px] shadow-dark-12-26-4"
      >
        <div className="flex items-center gap-[10px]">
          <h2 id="stage-title" className="m-0 font-heading text-[19px] font-bold">
            مرحلتك
          </h2>
          <span className="rounded-pill bg-gold-tint px-[12px] py-[6px] text-[12px] font-extrabold text-warning-text">
            {STAGE_LABEL[h.stage]}
          </span>
        </div>
        <GrowthPath stage={h.stage} pct={h.planPct} />
        <span className="text-[13px] leading-[1.8] font-bold text-text-muted">{toNext}</span>
      </section>

      <section
        aria-labelledby="streak-title"
        className="flex flex-col gap-[13px] rounded-px-26 bg-surface p-[18px] shadow-dark-12-26-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="streak-title" className="m-0 font-heading text-[19px] font-bold">
            سلسلتك
          </h2>
          <span className="rounded-pill bg-berry-tint px-[12px] py-[6px] text-[12.5px] font-extrabold text-berry-deep">
            {h.streak > 0 ? `${daysPhrase(h.streak)} متتالية` : 'ابدأ اليوم'}
          </span>
        </div>
        <ol className="m-0 flex list-none gap-[6px] p-0">
          {last5.map((d) => {
            const done = lessonDays.has(d.key);
            return (
              <li
                key={d.key}
                aria-label={`${d.label}${done ? ' — أنجزت' : ''}`}
                className={cx(
                  'flex h-[34px] grow items-center justify-center rounded-px-12 text-[11.5px] font-extrabold',
                  d.today
                    ? 'bg-gold text-on-gold'
                    : done
                      ? 'bg-green-tint text-deep-green'
                      : 'bg-border-soft text-text-subtle',
                )}
              >
                {d.label}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="badges-title" className="flex flex-col gap-[12px]">
        <h2 id="badges-title" className="m-0 font-heading text-[19px] font-bold">
          شاراتك
        </h2>
        <ul className="m-0 grid list-none grid-cols-3 gap-[10px] p-0">
          {badges.map((b) => (
            <li
              key={b.label}
              aria-label={`${b.label}${b.on ? '' : ' — لم تُفتح بعد'}`}
              className={cx(
                'flex flex-col items-center gap-[9px] rounded-px-22 bg-surface px-[10px] py-[16px] shadow-soft',
                !b.on && 'opacity-[0.42]',
              )}
            >
              <span
                className={cx(
                  'flex h-[52px] w-[52px] items-center justify-center rounded-full',
                  b.on ? b.tint : 'bg-border-soft',
                )}
                aria-hidden="true"
              >
                {b.on ? b.icon : <Lock />}
              </span>
              <span
                className={cx(
                  'text-center text-[12px] leading-[1.5] font-extrabold',
                  b.on ? b.ink : 'text-text-subtle',
                )}
              >
                {b.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Opens the parent login in this browser (password = the gate). */}
      <Link
        to={paths.loginTo('parent')}
        className="mt-auto flex h-[48px] items-center justify-center gap-[9px] self-center rounded-px-16 border-[1.5px] border-input-border bg-transparent px-[20px] text-[14px] font-bold text-text-muted no-underline hover:text-text-muted"
      >
        <Lock color="textMuted" size={18} />
        أنا وليّ الأمر
      </Link>
    </ChildPage>
  );
}

function Lock({ color = 'textSubtle', size = 22 }: { color?: 'textSubtle' | 'textMuted'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C[color]} strokeWidth="2" />
      <path
        d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
        stroke={C[color]}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BadgeBook({ color = 'deepGreen' }: { color?: 'deepGreen' | 'berryDeep' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
        stroke={C[color]}
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 5.8 V18.8" stroke={C[color]} strokeWidth="1.9" />
    </svg>
  );
}

function BadgeSpark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L14 9.4 L21.5 12 L14 14.6 L12 22 L10 14.6 L2.5 12 L10 9.4 Z" fill={C.gold} />
    </svg>
  );
}

function BadgeFlame() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 C12 7 8 8 8 12.5 C8 16 9.8 18.5 12 21 C14.2 18.5 16 16 16 12.5 C16 10 14 9 14 6.5 C13 8 12 7 12 3 Z"
        fill={C.berry}
      />
    </svg>
  );
}

function BadgeProject() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
      <path d="M32 38 V18" stroke={C.ayahBracket} strokeWidth="3.4" strokeLinecap="round" />
      <path
        d="M6 38 C6 50 17 58 32 58 C47 58 58 50 58 38 C58 34 54 32 51 34 L40 41 L24 41 L13 34 C10 32 6 34 6 38 Z"
        fill={C.gold}
      />
    </svg>
  );
}
