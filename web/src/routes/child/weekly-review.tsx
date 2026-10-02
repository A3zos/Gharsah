import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { useChildData } from '../../components/child/ChildData';
import { ChildPage, ReviewTabGlyph } from '../../components/child/ChildShell';
import { C } from '../../components/ui/color';
import { CheckIcon, ForwardIcon } from '../../components/ui/icons';
import { Blob } from '../../components/ui/Page';
import { reviewItems, type ReviewItem } from '../../content/review';
import { formatTime, nextReviewDay, type ChildProfile } from '../../data/children';
import { cx } from '../../lib/cx';
import { daysPhrase, plural } from '../../lib/plural';
import type { Route } from './+types/weekly-review';

export const meta: Route.MetaFunction = () => [{ title: 'المراجعة — غَرْسة' }];

/** «بعد يومين — الساعة ٥:٠٠ مساءً» for the child's next review day. */
function whenText(child: ChildProfile, now = new Date()): string | null {
  const s = child.schedule;
  const next = nextReviewDay(s, now);
  if (!s || !next) return null;
  const diff = next.inDays;
  const when = diff === 0 ? 'اليوم' : diff === 1 ? 'غدًا' : `بعد ${daysPhrase(diff)}`;
  return `${when} — الساعة ${formatTime(s.custom[next.day] ?? s.time)}`;
}

/**
 * design/v3 WeeklyReview — the «المراجعة» tab. The review session itself isn't
 * in the lesson contract yet, so «ابدأ المراجعة» stays in its locked state and
 * «آخر مراجعة» is an empty state (product decision).
 */
export default function WeeklyReviewRoute() {
  const { child, progress } = useChildData();
  if (!child) {
    return (
      <ChildPage tab="review" blob="page">
        <div aria-busy="true" className="grow" />
      </ChildPage>
    );
  }
  const dayName = nextReviewDay(child.schedule)?.label ?? null;
  const items = reviewItems(child, progress);
  const toReview = items.filter((i) => i.state === 'done');
  const surahs = items.filter((i) => i.kind === 'surah').length;
  const hadith = items.filter((i) => i.kind === 'hadith').length;
  return (
    <ChildPage tab="review" blob="page" className="gap-[18px] pt-[28px]">
      <Blob className="-top-[150px] -left-[130px] h-[380px] w-[380px] bg-blob-gold-strong" />
      <div className="relative flex items-center gap-[12px]">
        <span className="flex grow flex-col gap-[5px]">
          <h1 className="m-0 font-heading text-[26px] leading-[1.4] font-bold">المراجعة</h1>
          <span className="text-[13px] text-text-muted">حصة واحدة كل أسبوع نرجع فيها لما حفظته</span>
        </span>
        <span
          className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-px-19 bg-gold-tint"
          aria-hidden="true"
        >
          <ReviewTabGlyph color="ayahBracket" size={26} />
        </span>
      </div>

      <section
        aria-labelledby="week-review"
        className="relative flex flex-col gap-[14px] overflow-hidden rounded-px-30 bg-gold px-[20px] pt-[22px] pb-[20px] shadow-gold-16-32-28"
      >
        <div
          aria-hidden="true"
          className="absolute -top-[46px] -left-[36px] h-[160px] w-[160px] rounded-full bg-surface/24"
        />
        <div className="relative flex items-center justify-between gap-[10px]">
          <h2 id="week-review" className="m-0 font-heading text-[23px] leading-[1.4] font-bold text-on-gold">
            مراجعة هذا الأسبوع
          </h2>
          {dayName && (
            <span className="rounded-pill bg-on-gold px-[12px] py-[6px] text-[12px] font-extrabold whitespace-nowrap text-gold-tint">
              {dayName}
            </span>
          )}
        </div>
        {whenText(child) && (
          <span className="relative text-[14.5px] leading-[1.8] font-bold text-on-gold">
            {whenText(child)}
          </span>
        )}
        <div className="relative flex flex-col gap-[9px]">
          <span className="text-[12.5px] font-extrabold text-on-gold">وش نراجع؟</span>
          <div className="flex flex-wrap gap-[8px]">
            {toReview.length ? (
              toReview.map((i) => (
                <span
                  key={i.label}
                  className="flex items-center gap-[7px] rounded-px-13 bg-surface/62 px-[12px] py-[8px] text-[13px] font-bold text-on-gold"
                >
                  {i.label}
                </span>
              ))
            ) : (
              <span className="text-[13px] font-bold text-on-gold">
                ما تحفظه هذا الأسبوع — ابدأ حصة اليوم!
              </span>
            )}
          </div>
        </div>
        <span
          aria-disabled="true"
          className="relative flex h-[66px] items-center justify-center gap-[10px] rounded-px-22 bg-on-gold/14 font-heading text-[20px] font-bold text-on-gold"
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.onGold} strokeWidth="2" />
            <path
              d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
              stroke={C.onGold}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          ابدأ المراجعة
        </span>
        <span className="relative text-center text-[12.5px] font-bold text-on-gold">
          {dayName ? `يتفعّل الزر صباح ${dayName}` : 'يتفعّل الزر في يوم المراجعة'}
        </span>
      </section>

      {/* «آخر مراجعة» — empty until the weekly-review contract exists (product decision). */}
      <div className="relative flex items-center gap-[14px] rounded-px-26 border-[1.5px] border-border bg-surface px-[20px] py-[18px]">
        <span
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-px-17 bg-border-soft"
          aria-hidden="true"
        >
          <ReviewTabGlyph color="textSubtle" size={24} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 grow flex-col gap-[4px]">
          <span className="text-[15px] font-extrabold">آخر مراجعة</span>
          <span className="text-[12.5px] leading-[1.7] text-text-muted">
            لم تُراجع بعد — {dayName ? `أول مراجعة يوم ${dayName}` : 'أول مراجعة في يومها من الجدول'}
          </span>
        </span>
        <span className="rounded-pill bg-border-soft px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-text-muted">
          قريبًا
        </span>
      </div>

      <section aria-labelledby="all-memorized" className="relative flex flex-col gap-[11px]">
        <div className="flex items-baseline justify-between gap-[10px]">
          <h2 id="all-memorized" className="m-0 font-heading text-[17px] leading-[1.5] font-bold">
            كل ما حفظته
          </h2>
          <span className="text-[12px] font-bold text-text-muted">
            {plural(surahs, { one: 'سورة واحدة', two: 'سورتان', few: 'سور', many: 'سورة' })} ·{' '}
            {plural(hadith, { one: 'حديث واحد', two: 'حديثان', few: 'أحاديث', many: 'حديثًا' })}
          </span>
        </div>
        {items.map((i) => (
          <ItemRow key={i.label} item={i} />
        ))}
        <div className="flex items-center gap-[12px] rounded-px-20 border-[1.5px] border-dashed border-border-strong bg-surface px-[15px] py-[13px]">
          <span
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-px-14 bg-border-soft"
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.textSubtle} strokeWidth="2" />
              <path
                d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
                stroke={C.textSubtle}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="flex min-w-0 grow flex-col gap-[4px]">
            <span className="text-[15px] font-extrabold text-text-subtle">بعد الباقة التجريبية</span>
            <span className="text-[12px] text-text-muted">تُفتح بقية السور والأحاديث في التحديث القادم</span>
          </span>
          <span className="rounded-pill bg-border-soft px-[10px] py-[5px] text-[11px] font-extrabold whitespace-nowrap text-text-muted">
            قريبًا
          </span>
        </div>
      </section>

      <Link
        to={paths.child.review('quran')}
        className="relative flex h-[56px] items-center justify-center gap-[9px] rounded-px-19 border-[1.5px] border-input-border bg-surface text-[15.5px] font-extrabold text-deep-green no-underline"
      >
        افتح القوائم الكاملة
        <ForwardIcon size={19} color="deepGreen" strokeWidth={2.4} />
      </Link>
    </ChildPage>
  );
}

function ItemRow({ item }: { item: ReviewItem }) {
  const now = item.state === 'now';
  return (
    <div className="flex items-center gap-[12px] rounded-px-20 border-[1.5px] border-border bg-surface px-[15px] py-[13px]">
      <span
        className={cx(
          'flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-px-14',
          now ? 'bg-gold-tint' : 'bg-green-tint',
        )}
        aria-hidden="true"
      >
        {now ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="6" fill={C.gold} />
          </svg>
        ) : (
          <CheckIcon size={20} strokeWidth={3.2} />
        )}
      </span>
      <span className="flex min-w-0 grow flex-col gap-[4px]">
        <span className="text-[15px] font-extrabold text-text-dark">{item.label}</span>
        <span className="text-[12px] text-text-muted">{item.meta}</span>
      </span>
      {now && (
        <span className="rounded-pill bg-gold-tint px-[10px] py-[5px] text-[11px] font-extrabold whitespace-nowrap text-warning-text">
          هذا الأسبوع
        </span>
      )}
    </div>
  );
}
