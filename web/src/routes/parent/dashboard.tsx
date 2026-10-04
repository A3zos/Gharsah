import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import { ChildAvatar } from '../../components/child/ChildAvatar';
import { GrowthPath } from '../../components/child/GrowthPath';
import { GrowthHero } from '../../components/parent/GrowthHero';
import { useParentData } from '../../components/parent/ParentData';
import { DesktopHeader, ParentPage, SettingsButton } from '../../components/parent/ParentShell';
import { projectTitle, Recordings } from '../../components/parent/Recordings';
import { C } from '../../components/ui/color';
import { ForwardIcon, PlusIcon } from '../../components/ui/icons';
import { projectValue } from '../../content/library';
import { reviewDayNames, type ChildProfile } from '../../data/children';
import { planProgress, planSentence, planSubtitle } from '../../data/planProgress';
import { ageLabel, headline, pilotChip, stageLabel, type Headline } from '../../data/stats';
import { watchSubmissions, type ProjectSubmission } from '../../data/submissions';
import { countPhrase, formatNumber, MESSAGES, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { DashDetail, type DashCard } from '../../components/parent/DashDetail';
import { fmt, useParentTitle, valueText } from '../../components/parent/parentText';
import type { Route } from './+types/dashboard';

export const meta: Route.MetaFunction = () => [
  { title: `${MESSAGES.ar.parent.meta.dashboard} — ${MESSAGES.ar.parent.meta.brand}` },
];

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
  useParentTitle('dashboard');

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
  const t = useI18n().m.parent.dashboard;
  return (
    <>
      <DesktopHeader title={t.title} subtitle={t.subtitle} />
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
        <span className="font-heading text-[20px] font-bold">{t.firstChild}</span>
        <span className="text-[13.5px] text-text-muted">{t.firstChildNote}</span>
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
function useLastReviewLine(child: ChildProfile): string {
  const { lang, m } = useI18n();
  const days = reviewDayNames(child.schedule, lang);
  return days ? fmt(lang, m.parent.dashboard.reviewDays, { days }) : m.parent.dashboard.reviewPick;
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
  const { lang, m } = useI18n();
  const t = m.parent.dashboard;
  const reviewLine = useLastReviewLine(child);
  const plan = planProgress(child, undefined, lang);
  const pending =
    typeof child.stats?.pendingProject === 'string' ? (child.stats.pendingProject as string) : null;
  return (
    <div className="flex grow flex-col gap-[24px]">
      <DesktopHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <nav aria-label={t.childrenNav} className="flex items-center gap-[10px]">
            {kids.map((k) => {
              const on = k.id === child.id;
              return (
                <Link
                  key={k.id}
                  to={paths.parent.dashboard(k.id)}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-[10px] rounded-pill py-[10px] ps-[18px] pe-[12px] text-[15px] no-underline',
                    on
                      ? 'bg-deep-green font-extrabold text-surface hover:text-surface'
                      : 'border-[1.5px] border-border bg-surface font-bold text-text-muted hover:text-text-muted',
                  )}
                >
                  <ChildAvatar id={k.avatarId} size={32} />
                  {k.name}
                </Link>
              );
            })}
            <Link
              to={paths.parent.addChildFrom('dashboard')}
              aria-label={m.parent.common.addChild}
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
          <span className="text-[13px] font-bold text-text-muted">{t.lastReview}</span>
          <span className="text-[17px] font-extrabold">{reviewLine}</span>
        </span>
        <span className="flex items-center gap-[7px] rounded-pill bg-gold-tint px-[14px] py-[8px] text-[13px] font-extrabold whitespace-nowrap text-warning-text">
          {m.parent.common.soon}
        </span>
      </div>
      <div className="flex gap-[20px]">
        <section
          aria-label={fmt(lang, t.growthOf, { name: child.name })}
          className="flex grow flex-col gap-[20px] rounded-px-32 bg-surface px-[32px] py-[30px] shadow-dark-16-34-5"
        >
          <div className="flex items-center gap-[16px]">
            <ChildAvatar id={child.avatarId} size={58} className="rounded-px-20" />
            <span className="flex grow flex-col gap-[4px]">
              <h2 className="m-0 font-heading text-[24px] font-bold">{child.name}</h2>
              <span className="text-[13.5px] text-text-muted">
                {planSubtitle(ageLabel(child.age, lang), plan)}
              </span>
            </span>
            {h.streak > 0 && (
              <span className="rounded-pill bg-gold-tint px-[16px] py-[9px] text-[13px] font-extrabold text-warning-text">
                {countPhrase(lang, h.streak, t.streak)}
              </span>
            )}
          </div>
          <div className="h-[1px] bg-border" />
          {/* the stages by the CURRENT plan's %: بذرة 0–33, غَرْسة 34–99, شجرة 100 */}
          <GrowthPath stage={plan.stage} pct={plan.pct} size={74} />
          <span className="text-[13.5px] font-bold text-text-muted">{planSentence(plan, lang)}</span>
        </section>
        {pending && (
          <section
            aria-label={t.weekProject}
            className="flex w-[330px] shrink-0 flex-col gap-[16px] rounded-px-32 border-[2px] border-gold-border bg-gold-tint px-[26px] py-[28px]"
          >
            <span className="self-start rounded-pill bg-gold px-[14px] py-[7px] text-[12.5px] font-extrabold text-on-gold">
              {t.weekProject}
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
              {projectTitle(pending, lang)}
            </h3>
            <span className="text-[13.5px] leading-[1.9] text-hadith-note-text">
              {fmt(lang, t.weekHadith, { value: valueText(lang, projectValue(pending)), name: child.name })}
            </span>
            <span className="mt-auto flex items-center gap-[9px] rounded-px-16 bg-surface px-[14px] py-[12px]">
              <span className="h-[9px] w-[9px] rounded-full bg-gold" />
              <span className="text-[13px] font-bold text-warning-text">
                {fmt(lang, t.awaiting, { name: child.name })}
              </span>
            </span>
          </section>
        )}
      </div>
      <div className="flex gap-[16px]">
        {(
          [
            ['surahs', h.surahs, t.countSurahs, 'text-deep-green'],
            ['ayat', h.ayat, t.countAyat, 'text-sky-text'],
            ['hadith', h.hadith, h.hadith === 1 ? t.countHadithOne : t.countHadithMany, 'text-berry-deep'],
            ['projects', h.projects, t.countProjects, 'text-warning-text'],
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
              {formatNumber(lang, n)}
            </span>
            <span className="text-[14.5px] font-bold text-text-muted">{label}</span>
          </div>
        ))}
      </div>
      <AskQuestionsCard />
      <section aria-labelledby="recordings" className="flex min-h-0 grow flex-col gap-[14px]">
        <div className="flex items-center gap-[12px]">
          <h2 id="recordings" className="m-0 font-heading text-[22px] font-bold">
            {t.recordings}
          </h2>
          <span className="rounded-pill bg-green-tint px-[13px] py-[6px] text-[12.5px] font-extrabold text-deep-green">
            {fmt(lang, t.recordingsPill, { name: child.name })}
          </span>
        </div>
        <Recordings child={child} subs={subs} pending={pending} />
      </section>
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
  const { lang, m } = useI18n();
  const t = m.parent.dashboard;
  const reviewLine = useLastReviewLine(child);
  const cards: [DashCard, number, string][] = [
    ['surahs', h.surahs, m.parent.cards.surahs],
    ['ayat', h.ayat, m.parent.cards.ayat],
    ['hadith', h.hadith, m.parent.cards.hadith],
    ['projects', h.projects, m.parent.cards.projects],
  ];
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-[18px] pt-[4px]">
      <div className="flex items-center justify-between gap-[10px]">
        <h1 className="m-0 font-heading text-[26px] leading-[1.5] font-bold">{t.title}</h1>
        <SettingsButton />
      </div>
      {kids.length > 1 && (
        <nav aria-label={t.childrenNav} className="flex flex-wrap items-center gap-[10px]">
          {kids.map((k) => {
            const on = k.id === child.id;
            return (
              <Link
                key={k.id}
                to={paths.parent.dashboard(k.id)}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'flex h-[46px] items-center gap-[8px] rounded-px-16 ps-[16px] pe-[10px] text-[14.5px] font-bold no-underline',
                  on
                    ? 'bg-deep-green text-surface hover:text-surface'
                    : 'border border-border bg-surface text-text-dark hover:text-text-dark',
                )}
              >
                <ChildAvatar id={k.avatarId} size={28} />
                {k.name}
              </Link>
            );
          })}
        </nav>
      )}
      <MobileGrowth child={child} />
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
                  {formatNumber(lang, n)}
                </span>
                <span className="text-[13px] font-bold text-text-muted">{label}</span>
                <span className="absolute end-[16px] top-[18px]">
                  <ForwardIcon size={18} color="textSubtle" strokeWidth={2.2} className="ltr:-scale-x-100" />
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
              <span className="text-[12.5px] font-bold text-text-muted">{t.lastReview}</span>
              <span className="text-[15px] font-extrabold">{reviewLine}</span>
            </span>
            <span className="flex items-center gap-[6px] rounded-pill bg-gold-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-warning-text">
              {m.parent.common.soon}
            </span>
          </div>
          <AskQuestionsCard />
          <p className="m-0 text-center text-[12.5px] text-text-muted">{t.tapHint}</p>
        </>
      )}
      <span className="sr-only">{stageLabel(h.stage, lang)}</span>
    </div>
  );
}

/** Phones: the growth hero (stages + bar) by the CURRENT plan's %. */
/** «أسئلة طفلك» — empty for now («اسألني» isn't connected yet): two placeholder rows. */
function AskQuestionsCard() {
  const { m } = useI18n();
  const t = m.parent.dashboard;
  return (
    <section
      aria-labelledby="ask-questions"
      className="flex flex-col gap-[12px] rounded-px-26 border-[1.5px] border-border bg-surface px-[20px] py-[18px]"
    >
      <div className="flex items-center justify-between gap-[10px]">
        <h2 id="ask-questions" className="m-0 font-heading text-[19px] font-bold">
          {t.questionsTitle}
        </h2>
        <span className="rounded-pill bg-gold-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-warning-text">
          {m.parent.common.soon}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-[8px] p-0" aria-hidden="true">
        {['w-[72%]', 'w-[54%]'].map((w) => (
          <li
            key={w}
            className="flex items-center gap-[12px] rounded-px-18 bg-background px-[14px] py-[12px]"
          >
            <span className="h-[34px] w-[34px] shrink-0 rounded-full bg-border-soft" />
            <span className="flex grow flex-col gap-[7px]">
              <span className={cx('h-[10px] rounded-pill bg-border-soft', w)} />
              <span className="h-[8px] w-[30%] rounded-pill bg-border-soft" />
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[13px] leading-[1.8] text-text-muted">{t.questionsEmpty}</p>
    </section>
  );
}

function MobileGrowth({ child }: { child: ChildProfile }) {
  const { lang } = useI18n();
  const plan = planProgress(child, undefined, lang);
  return (
    <GrowthHero
      name={child.name}
      subtitle={planSubtitle(ageLabel(child.age, lang), plan)}
      stage={plan.stage}
      pct={plan.pct}
      planChip={pilotChip(child.pilotDaysDone, lang)}
      sentence={planSentence(plan, lang)}
    />
  );
}
