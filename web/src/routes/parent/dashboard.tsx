import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import { avatarById, avatarInk, avatarTint, ChildAvatar } from '../../components/child/ChildAvatar';
import { GrowthPath } from '../../components/child/GrowthPath';
import { AiVoiceConsent } from '../../components/parent/AiVoiceConsent';
import { PilotPlanCard } from '../../components/parent/PilotPlanCard';
import { GrowthHero } from '../../components/parent/GrowthHero';
import { initialOf, useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, ParentPage, SettingsButton } from '../../components/parent/ParentShell';
import { projectTitle, Recordings } from '../../components/parent/Recordings';
import { C } from '../../components/ui/color';
import { ForwardIcon, PlusIcon } from '../../components/ui/icons';
import { projectValue } from '../../content/library';
import { reviewDayNames, type ChildProfile } from '../../data/children';
import { ageLabel, headline, pilotChip, STAGE_LABEL, type Headline } from '../../data/stats';
import { watchSubmissions, type ProjectSubmission } from '../../data/submissions';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { daysPhrase, plural } from '../../lib/plural';
import { DashDetail, type DashCard } from '../../components/parent/DashDetail';
import type { Route } from './+types/dashboard';

export const meta: Route.MetaFunction = () => [{ title: 'لوحة التحكم — غَرْسة' }];

const TINT_BG: Record<string, string> = {
  berryTint: 'bg-berry-tint',
  skyTint: 'bg-sky-tint',
  greenTint: 'bg-green-tint',
  goldTint: 'bg-gold-tint',
  borderSoft: 'bg-border-soft',
};

/** «باقٍ ١٤٪ ليصير شجرة» */
function toNextStage(h: Headline): string {
  if (h.stage === 'tree') return 'وصل إلى الشجرة — ما شاء الله.';
  const next = h.stage === 'seed' ? { at: 34, name: 'غَرْسة' } : { at: 67, name: 'شجرة' };
  return `أتمّ ${toArabicDigits(h.planPct)}٪ من الباقة التجريبية — باقٍ ${toArabicDigits(next.at - h.planPct)}٪ ليصير ${next.name}.`;
}

function useSubmissions(uid: string, childId: string | undefined) {
  // Keyed by child so switching children never shows the previous child's list.
  const [state, setState] = useState<{ childId: string; subs: ProjectSubmission[] } | null>(null);
  useEffect(() => {
    if (!childId) return;
    return watchSubmissions(
      uid,
      childId,
      (subs) => setState({ childId, subs }),
      () => setState({ childId, subs: [] }),
    );
  }, [uid, childId]);
  return state && state.childId === childId ? state.subs : null;
}

/**
 * design/v3 ParentWebDash (desktop) / Dashboard + DashboardMaryam (phone).
 * `/parent/dashboard/:childId?` — the first child when none is chosen;
 * `?card=surahs|ayat|hadith|projects` opens a card (DashSurahs … DashProjects).
 */
export default function DashboardRoute() {
  const { childId } = useParams();
  const [params] = useSearchParams();
  const { uid, children } = useParentData();
  const kids = children ?? [];
  const child = kids.find((c) => c.id === childId) ?? (childId ? undefined : kids[0]);
  const subs = useSubmissions(uid, child?.id);

  if (children === null) return <ParentPage tab="home" desktop={<div aria-busy="true" />} />;
  if (childId && !child) return <Navigate to={paths.parent.dashboard()} replace />;
  if (!child) return <ParentPage tab="home" desktop={<NoChildren />} />;

  const card =
    (['surahs', 'ayat', 'hadith', 'projects'] as const).find((c) => c === params.get('card')) ?? null;
  const h = headline(child);
  return (
    <ParentPage
      tab="home"
      desktop={<Desktop kids={kids} child={child} h={h} subs={subs} />}
      mobile={<Mobile kids={kids} child={child} h={h} subs={subs} card={card} />}
    />
  );
}

/** TODO(design): no designed dashboard for a parent without children. */
function NoChildren() {
  return (
    <>
      <DesktopHeader
        title="لوحة التحكم"
        subtitle="متابعة تقدّم أبنائك — كل ما يحفظه ابنك وما أنجزه من مشاريع."
      />
      <Link
        to={paths.parent.addChildFrom('dashboard')}
        className="flex min-h-[200px] flex-col items-center justify-center gap-[12px] rounded-px-30 border-[2px] border-dashed border-input-border bg-transparent text-deep-green no-underline"
      >
        <span
          className="flex h-[62px] w-[62px] items-center justify-center rounded-px-22 bg-green-tint"
          aria-hidden="true"
        >
          <PlusIcon size={28} color="deepGreen" />
        </span>
        <span className="font-heading text-[20px] font-bold">أضف ابنك الأول</span>
        <span className="text-[13.5px] text-text-muted">ثم أعطه رمز الربط ليبدأ حصته الأولى</span>
      </Link>
    </>
  );
}

// ── Icons of the four counts ──

function CountIcon({ kind, size = 24 }: { kind: DashCard; size?: number }) {
  if (kind === 'surahs')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
          stroke={C.deepGreen}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path d="M12 5.8 V18.8" stroke={C.deepGreen} strokeWidth="1.9" />
      </svg>
    );
  if (kind === 'ayat')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M8.5 5 C6 7 6 17 8.5 19" stroke={C.skyText} strokeWidth="2" strokeLinecap="round" />
        <path d="M15.5 5 C18 7 18 17 15.5 19" stroke={C.skyText} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.8" fill={C.skyText} />
      </svg>
    );
  if (kind === 'hadith')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
    );
  return (
    <svg width={size + 2} height={size + 2} viewBox="0 0 64 64" fill="none">
      <path d="M32 38 V18" stroke={C.ayahBracket} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 28 C24 28 19 23 19 15 C27 15 32 20 32 28 Z" fill={C.goldMid} />
      <path
        d="M6 38 C6 50 17 58 32 58 C47 58 58 50 58 38 C58 34 54 32 51 34 L40 41 L24 41 L13 34 C10 32 6 34 6 38 Z"
        fill={C.gold}
      />
    </svg>
  );
}

const COUNT_TINT: Record<DashCard, string> = {
  surahs: 'bg-green-tint',
  ayat: 'bg-sky-tint',
  hadith: 'bg-berry-tint',
  projects: 'bg-gold-tint',
};

function ReviewIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12 C20 16.4 16.4 20 12 20 C7.6 20 4 16.4 4 12 C4 7.6 7.6 4 12 4 C14.9 4 17.4 5.4 18.9 7.6"
        stroke={C.ayahBracket}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19.6 4 V8.2 H15.4"
        stroke={C.ayahBracket}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * «آخر مراجعة أسبوعية» — empty until the weekly-review contract exists
 * (product decision): it only tells which day the review is set for.
 */
function lastReviewLine(child: ChildProfile): string {
  const days = reviewDayNames(child.schedule);
  return days ? `لم تبدأ بعد — أيام المراجعة: ${days}` : 'لم تبدأ بعد — اختر أيام المراجعة من الجدول';
}

// ── Desktop: ParentWebDash ──

function Desktop({
  kids,
  child,
  h,
  subs,
}: {
  kids: ChildProfile[];
  child: ChildProfile;
  h: Headline;
  subs: ProjectSubmission[] | null;
}) {
  const s = child.schedule;
  const pending =
    typeof child.stats?.pendingProject === 'string' ? (child.stats.pendingProject as string) : null;
  return (
    <div className="flex grow flex-col gap-[24px]">
      <DesktopHeader
        title="لوحة التحكم"
        subtitle="متابعة تقدّم أبنائك — كل ما يحفظه ابنك وما أنجزه من مشاريع."
        action={
          <nav aria-label="الأبناء" className="flex items-center gap-[10px]">
            {kids.map((k) => {
              const on = k.id === child.id;
              const a = avatarById(k.avatarId);
              return (
                <Link
                  key={k.id}
                  to={paths.parent.dashboard(k.id)}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-[10px] rounded-pill py-[10px] pr-[18px] pl-[12px] text-[15px] no-underline',
                    on
                      ? 'bg-deep-green font-extrabold text-surface hover:text-surface'
                      : 'border-[1.5px] border-border bg-surface font-bold text-text-muted hover:text-text-muted',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-[32px] w-[32px] items-center justify-center rounded-full font-heading text-[15px] font-extrabold',
                      on ? 'bg-surface/20' : cx(TINT_BG[avatarTint(a)], avatarInk(a)),
                    )}
                    aria-hidden="true"
                  >
                    {initialOf(k.name)}
                  </span>
                  {k.name}
                </Link>
              );
            })}
            <Link
              to={paths.parent.addChildFrom('dashboard')}
              aria-label="إضافة ابن"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-dashed border-input-border bg-surface no-underline"
            >
              <PlusIcon size={20} color="deepGreen" strokeWidth={2.4} />
            </Link>
          </nav>
        }
      />
      <div className="flex items-center gap-[18px] rounded-px-26 border-[1.5px] border-border bg-surface px-[26px] py-[22px]">
        <span
          className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-px-18 bg-gold-tint"
          aria-hidden="true"
        >
          <ReviewIcon />
        </span>
        <span className="flex min-w-0 grow flex-col gap-[5px]">
          <span className="text-[13px] font-bold text-text-muted">آخر مراجعة أسبوعية</span>
          <span className="text-[17px] font-extrabold">{lastReviewLine(child)}</span>
        </span>
        <span className="flex items-center gap-[7px] rounded-pill bg-gold-tint px-[14px] py-[8px] text-[13px] font-extrabold whitespace-nowrap text-warning-text">
          قريبًا
        </span>
      </div>
      <div className="flex gap-[20px]">
        <section
          aria-label={`نموّ ${child.name}`}
          className="flex grow flex-col gap-[20px] rounded-px-32 bg-surface px-[32px] py-[30px] shadow-dark-16-34-5"
        >
          <div className="flex items-center gap-[16px]">
            <span
              className={cx(
                'flex h-[58px] w-[58px] items-center justify-center rounded-px-20 font-heading text-[23px] font-extrabold',
                TINT_BG[avatarTint(avatarById(child.avatarId))],
                avatarInk(avatarById(child.avatarId)),
              )}
              aria-hidden="true"
            >
              {initialOf(child.name)}
            </span>
            <span className="flex grow flex-col gap-[4px]">
              <h2 className="m-0 font-heading text-[24px] font-bold">{child.name}</h2>
              <span className="text-[13.5px] text-text-muted">
                {ageLabel(child.age)}
                {s &&
                  ` · ${plural(s.days.length, { one: 'حصة واحدة', two: 'حصتان', few: 'حصص', many: 'حصة' })} في الأسبوع · ${toArabicDigits(s.duration)} دقيقة للجلسة`}
              </span>
            </span>
            {h.streak > 0 && (
              <span className="rounded-pill bg-gold-tint px-[16px] py-[9px] text-[13px] font-extrabold text-warning-text">
                {daysPhrase(h.streak)} متتالية
              </span>
            )}
          </div>
          <div className="h-[1px] bg-border" />
          <GrowthPath stage={h.stage} pct={h.planPct} size={74} />
          <span className="text-[13.5px] font-bold text-text-muted">{toNextStage(h)}</span>
        </section>
        {pending && (
          <section
            aria-label="مشروع هذا الأسبوع"
            className="flex w-[330px] shrink-0 flex-col gap-[16px] rounded-px-32 border-[2px] border-gold-border bg-gold-tint px-[26px] py-[28px]"
          >
            <span className="self-start rounded-pill bg-gold px-[14px] py-[7px] text-[12.5px] font-extrabold text-on-gold">
              مشروع هذا الأسبوع
            </span>
            <span className="animate-[gh-pop-5_.5s_ease-out_both]" aria-hidden="true">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <path d="M32 38 V18" stroke={C.deepGreen} strokeWidth="3.4" strokeLinecap="round" />
                <path d="M32 28 C24 28 19 23 19 15 C27 15 32 20 32 28 Z" fill={C.primary} />
                <path d="M32 24 C40 24 45 19 45 11 C37 11 32 16 32 24 Z" fill={C.softGreen} />
                <path
                  d="M6 38 C6 50 17 58 32 58 C47 58 58 50 58 38 C58 34 54 32 51 34 L40 41 L24 41 L13 34 C10 32 6 34 6 38 Z"
                  fill={C.gold}
                />
                <path d="M24 41 C24 37 28 35 32 35 C36 35 40 37 40 41 Z" fill={C.goldMid} />
              </svg>
            </span>
            <h3 className="m-0 font-heading text-[24px] leading-[1.5] font-bold text-on-gold">
              {projectTitle(pending)}
            </h3>
            <span className="text-[13.5px] leading-[1.9] text-hadith-note-text">
              حديث الأسبوع: {projectValue(pending)}. يحكي {child.name} ما فعله في حصة الغد.
            </span>
            <span className="mt-auto flex items-center gap-[9px] rounded-px-16 bg-surface px-[14px] py-[12px]">
              <span className="h-[9px] w-[9px] rounded-full bg-gold" />
              <span className="text-[13px] font-bold text-warning-text">بانتظار تسجيل {child.name}</span>
            </span>
          </section>
        )}
      </div>
      <div className="flex gap-[16px]">
        {(
          [
            ['surahs', h.surahs, 'سور مكتملة', 'text-deep-green'],
            ['ayat', h.ayat, 'آية محفوظة', 'text-sky-text'],
            ['hadith', h.hadith, h.hadith === 1 ? 'حديث' : 'حديثًا', 'text-berry-deep'],
            ['projects', h.projects, 'مشاريع منجزة', 'text-warning-text'],
          ] as const
        ).map(([kind, n, label, ink]) => (
          <div
            key={kind}
            className="flex grow basis-0 animate-[gh-rise_.45s_ease-out_both] flex-col gap-[14px] rounded-px-26 bg-surface px-[22px] py-[24px] shadow-dark-12-26-5"
          >
            <span
              className={cx(
                'flex h-[50px] w-[50px] items-center justify-center rounded-px-16',
                COUNT_TINT[kind],
              )}
              aria-hidden="true"
            >
              <CountIcon kind={kind} />
            </span>
            <span className={cx('font-heading text-[38px] leading-[1] font-extrabold', ink)}>
              {toArabicDigits(n)}
            </span>
            <span className="text-[14.5px] font-bold text-text-muted">{label}</span>
          </div>
        ))}
      </div>
      <PilotPlanCard child={child} />
      <section aria-labelledby="recordings" className="flex min-h-0 grow flex-col gap-[14px]">
        <div className="flex items-center gap-[12px]">
          <h2 id="recordings" className="m-0 font-heading text-[22px] font-bold">
            تسجيلات المشاريع
          </h2>
          <span className="rounded-pill bg-green-tint px-[13px] py-[6px] text-[12.5px] font-extrabold text-deep-green">
            بصوت {child.name} · لك وحدك
          </span>
        </div>
        <Recordings child={child} subs={subs} pending={pending} />
      </section>
      <AiVoiceConsent child={child} />
    </div>
  );
}

// ── Phone: Dashboard (+ DashSurahs / DashAyat / DashHadith / DashProjects) ──

function Mobile({
  kids,
  child,
  h,
  subs,
  card,
}: {
  kids: ChildProfile[];
  child: ChildProfile;
  h: Headline;
  subs: ProjectSubmission[] | null;
  card: DashCard | null;
}) {
  const [, setParams] = useSearchParams();
  const cards: [DashCard, number, string][] = [
    ['surahs', h.surahs, 'السور المنجزة'],
    ['ayat', h.ayat, 'الآيات المحفوظة'],
    ['hadith', h.hadith, 'الأحاديث'],
    ['projects', h.projects, 'المشاريع المنجزة'],
  ];
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[18px] pt-[4px]">
      <div className="flex items-center justify-between">
        <h1 className="m-0 font-heading text-[26px] leading-[1.5] font-bold">لوحة التحكم</h1>
        <SettingsButton />
      </div>
      {kids.length > 1 && (
        <nav aria-label="الأبناء" className="flex flex-wrap items-center gap-[10px]">
          {kids.map((k) => {
            const on = k.id === child.id;
            return (
              <Link
                key={k.id}
                to={paths.parent.dashboard(k.id)}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex h-[46px] items-center gap-[8px] rounded-px-16 pr-[16px] pl-[10px] text-[14.5px] font-bold no-underline',
                  on
                    ? 'bg-deep-green text-surface hover:text-surface'
                    : 'border border-border bg-surface text-text-dark hover:text-text-dark',
                )}
              >
                <ChildAvatar id={k.avatarId} size={28} mouth={false} />
                {k.name}
              </Link>
            );
          })}
        </nav>
      )}
      <GrowthHero
        name={child.name}
        stage={h.stage}
        pct={h.planPct}
        planChip={pilotChip(child.pilotDaysDone)}
      />
      {!card && <PilotPlanCard child={child} />}
      {card ? (
        <DashDetail
          card={card}
          child={child}
          h={h}
          subs={subs}
          onClose={() => setParams({}, { replace: false })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-[12px]">
            {cards.map(([kind, n, label]) => (
              <Link
                key={kind}
                to={`?card=${kind}`}
                className="relative flex min-h-[134px] flex-col gap-[6px] rounded-px-24 border-[1.5px] border-border bg-surface p-[16px] text-text-dark no-underline hover:text-text-dark"
              >
                <span
                  className={cx(
                    'flex h-[42px] w-[42px] items-center justify-center rounded-px-14',
                    COUNT_TINT[kind],
                  )}
                  aria-hidden="true"
                >
                  <CountIcon kind={kind} size={22} />
                </span>
                <span className="font-heading text-[32px] leading-[1.2] font-extrabold">
                  {toArabicDigits(n)}
                </span>
                <span className="text-[13px] font-bold text-text-muted">{label}</span>
                <span className="absolute top-[18px] left-[16px]">
                  <ForwardIcon size={18} color="textSubtle" strokeWidth={2.2} />
                </span>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-[14px] rounded-px-26 border-[1.5px] border-border bg-surface px-[20px] py-[18px]">
            <span
              className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-px-17 bg-gold-tint"
              aria-hidden="true"
            >
              <ReviewIcon size={24} />
            </span>
            <span className="flex min-w-0 grow flex-col gap-[5px]">
              <span className="text-[12.5px] font-bold text-text-muted">آخر مراجعة أسبوعية</span>
              <span className="text-[15px] font-extrabold">{lastReviewLine(child)}</span>
            </span>
            <span className="flex items-center gap-[6px] rounded-pill bg-gold-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-warning-text">
              قريبًا
            </span>
          </div>
          <AiVoiceConsent child={child} />
          <p className="m-0 text-center text-[12.5px] text-text-muted">اضغط أي بطاقة لعرض تفاصيلها.</p>
        </>
      )}
      <span className="sr-only">{STAGE_LABEL[h.stage]}</span>
    </div>
  );
}
