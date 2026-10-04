import { useEffect } from 'react';
import { Link } from 'react-router';

import { paths } from '../../app/paths';
import { ChildAvatar } from '../../components/child/ChildAvatar';
import { useChildData } from '../../components/child/ChildData';
import { ChildPage, PersonGlyph, ReviewTabGlyph } from '../../components/child/ChildShell';
import { useChildTitle } from '../../components/child/useChildTitle';
import { Leaderboard } from '../../components/child/Leaderboard';
import { C } from '../../components/ui/color';
import { ForwardIcon } from '../../components/ui/icons';
import { LanguageSheetButton } from '../../components/ui/LanguageSwitcher';
import { AskBubbleIcon, HadithIcon, ProjectIcon, QuranIcon } from '../../components/child/childIcons';
import { askEnabled } from '../../ask/AskService';
import { teacherFrameSrc } from '../../components/child/teacherCharacter';
import { lessonChips, lessonScripts, lessonValue } from '../../content/library';
import { PILOT_DAYS, pilotCopy } from '../../content/pilot';
import { hadithTitle, reviewItems, surahLabel } from '../../content/review';
import { nextReviewDay } from '../../data/children';
import { headline } from '../../data/stats';
import { countPhrase, fill, MESSAGES, useI18n, type UiLanguage } from '../../i18n/i18n';
import { agentEnabled, warmAgent } from '../../lesson/server/api';
import type { LessonScript } from '../../lesson/script';
import { serverVoiceEnabled, warmAiSpeak } from '../../lesson/web/serverVoice';
import { preloadTeacher } from '../../components/child/teacherCharacter';
import { getTeacher } from '../../content/teachers';
import { unlockLessonAudio } from '../../lesson/web/audioUnlock';
import { lessonStepGroups, pickTodayLesson } from '../../data/student';
import { cx } from '../../lib/cx';
import type { Route } from './+types/home';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.child.meta.home }];

type Chip = { label: string; kind: 'surah' | 'hadith' | 'report' };

/** The hero chips: Arabic exactly as lessonChips(); en / id from child.json. */
function chipsOf(s: LessonScript, lang: UiLanguage): Chip[] {
  if (lang === 'ar') return lessonChips(s);
  const chips: Chip[] = [];
  for (const st of s.steps) {
    if (st.type === 'project_report')
      chips.push({ label: MESSAGES[lang].child.home.reportChip, kind: 'report' });
    if (st.type === 'intro') chips.push({ label: surahLabel(lang, st.surah), kind: 'surah' });
    if (st.type === 'hadith_loop') chips.push({ label: hadithTitle(lang, st.hadithId), kind: 'hadith' });
  }
  return chips;
}

/** The lesson's value («برّ الوالدين» / «Kindness to parents»). */
function valueOf(lessonId: string, lang: UiLanguage): string {
  const ar = lessonValue(lessonId);
  if (lang === 'ar') return ar;
  return (MESSAGES[lang].child.lessonValues as Record<string, string>)[lessonId] ?? ar;
}

/** design/v3 StudentHome (+ StudentHomeDay2 when today's lesson starts with the project report). */
export default function ChildHome() {
  const { child, progress, board } = useChildData();
  const { lang, m } = useI18n();
  const t = m.child.home;
  useChildTitle(m.child.meta.home);
  // Before «ابدأ الحصة»: wake the AI server and its voice (Render cold start ~50 s),
  // and load the teacher's frames — so the call opens with the real teacher.
  useEffect(warmAgent, []);
  useEffect(() => {
    if (serverVoiceEnabled()) void warmAiSpeak();
  }, []);
  const gender = child?.gender;
  useEffect(() => {
    if (gender) void preloadTeacher(getTeacher(lang, gender));
  }, [gender, lang]);
  if (child === undefined || progress === undefined || !child) {
    return (
      <ChildPage tab="home">
        <div aria-busy="true" className="grow" />
      </ChildPage>
    );
  }
  const h = headline(child);
  const firstName = child.name.trim().split(/\s+/)[0] ?? child.name;
  const today = pickTodayLesson(progress);
  const script = lessonScripts.get(today.lessonId);
  const groups = script ? lessonStepGroups(script) : [];
  const done =
    today.kind !== 'available'
      ? groups.length
      : today.resume
        ? Math.min(groups.length, Math.max(0, groups.filter((g) => g < today.resume!.stepIndex).length - 1))
        : 0;
  const started = today.kind === 'available' && done > 0;
  const finished = today.kind !== 'available';
  const planDone = today.kind === 'planDone';
  const dayLabel = fill(lang, t.dayOf, { day: today.day, total: PILOT_DAYS.length });
  const pilotName = pilotCopy(lang).name;
  const reportFirst = script?.steps[0]?.type === 'project_report';
  const nextReview = nextReviewDay(child.schedule);
  const reviewDay = nextReview ? m.child.days[nextReview.day] : undefined;
  const reviewLine = reviewItems(child, progress, lang)
    .map((i) => i.label)
    .join(' · ');

  const badge = planDone
    ? t.badge.planDone
    : finished
      ? t.badge.finished
      : started
        ? t.badge.started
        : reportFirst
          ? t.badge.dayTwo
          : t.badge.new;
  const progressText =
    finished || started
      ? fill(lang, t.progressDone, { done, total: groups.length })
      : `${fill(lang, t.progressTodo, { n: groups.length })}${reportFirst ? t.reportFirst : ''}`;
  const cta = planDone ? t.cta.planDone : finished ? t.cta.finished : started ? t.cta.started : t.cta.start;
  const pct = groups.length ? Math.round((done / groups.length) * 100) : 0;
  const report = script?.steps[0]?.type === 'project_report' ? script.steps[0] : null;

  return (
    <ChildPage tab="home" className="gap-[18px] pt-[28px]">
      <header className="flex shrink-0 items-center gap-[13px]">
        <span className="shrink-0 animate-[gh-pop-7_.5s_ease-out_.05s_both]">
          <ChildAvatar id={child.avatarId} size={62} />
        </span>
        <div className="flex min-w-0 grow flex-col gap-[7px]">
          <h1 className="m-0 font-heading text-[25px] leading-[1.4] font-bold">
            {t.hello.replace('{name}', firstName)}
          </h1>
          <div className="flex flex-wrap gap-[7px]">
            <span className="flex items-center gap-[6px] rounded-pill bg-green-tint px-[11px] py-[6px] text-[12px] font-extrabold text-deep-green">
              <svg width="15" height="15" viewBox="0 0 76 76" fill="none" aria-hidden="true">
                <path d="M38 62 V34" stroke={C.deepGreen} strokeWidth="8" strokeLinecap="round" />
                <path d="M38 42 C28 42 22 36 22 27 C32 27 38 33 38 42 Z" fill={C.primary} />
                <path d="M38 47 C48 47 54 41 54 32 C44 32 38 38 38 47 Z" fill={C.softGreen} />
              </svg>
              {fill(lang, m.child.stageOf, { stage: m.child.stages[h.stage] })}
            </span>
            {h.streak > 0 && (
              <span className="flex items-center gap-[5px] rounded-pill bg-gold-tint px-[11px] py-[6px] text-[12px] font-extrabold text-warning-text">
                <Flame />
                {countPhrase(lang, h.streak, m.child.streak)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
          <LanguageSheetButton />
          <Link
            to={paths.child.profile}
            aria-label={m.child.nav.profile}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 border border-border bg-surface no-underline"
          >
            <PersonGlyph color="textDark" size={21} strokeWidth={1.9} />
          </Link>
        </div>
      </header>

      <Leaderboard board={board} myFirstName={firstName} avatarId={child.avatarId} />

      <section
        aria-labelledby="today-title"
        className="relative flex shrink-0 animate-[gh-rise_.5s_ease-out_.3s_both] flex-col gap-[14px] overflow-hidden rounded-px-30 bg-deep-green px-[20px] pt-[22px] pb-[20px] shadow-hero"
      >
        <div
          aria-hidden="true"
          className="absolute -end-[36px] -top-[46px] h-[160px] w-[160px] rounded-full bg-hero-circle"
        />
        <span
          className="absolute end-[4px] -bottom-[12px] animate-[gh-float-3_3.4s_ease-in-out_infinite]"
          aria-hidden="true"
        >
          <svg width="112" height="112" viewBox="0 0 100 100" fill="none" opacity="0.5">
            <path d="M50 92 V46" stroke={C.softGreen} strokeWidth="6" strokeLinecap="round" />
            <path d="M50 64 C34 64 24 55 24 40 C40 40 50 49 50 64 Z" fill={C.softGreen} />
            <path d="M50 56 C66 56 76 47 76 32 C60 32 50 41 50 56 Z" fill={C.leafLight} />
          </svg>
        </span>
        <div className="relative flex items-center justify-between gap-[10px]">
          <span className="flex flex-col gap-[2px]">
            <h2
              id="today-title"
              className="m-0 font-heading text-[24px] leading-[1.4] font-bold text-surface"
            >
              {planDone ? pilotName : t.todayTitle}
            </h2>
            {!planDone && (
              <span className="text-[13px] font-bold text-on-deep-green-muted">
                {pilotName} · {dayLabel}
              </span>
            )}
          </span>
          <span className="rounded-pill bg-gold px-[12px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-on-gold">
            {badge}
          </span>
        </div>
        {planDone && (
          // TODO(design): no designed plan-complete hero.
          <p role="status" className="relative m-0 text-[16px] leading-[1.8] font-bold text-surface">
            {fill(lang, t.planDoneText, { n: PILOT_DAYS.length })}
          </p>
        )}
        {report && !finished && (
          <p className="relative m-0 text-[16px] leading-[1.8] font-bold text-surface">
            {fill(lang, t.reportIntro, { value: valueOf(today.lessonId, lang) })}
          </p>
        )}
        <div className="relative flex flex-wrap gap-[8px]">
          {(planDone
            ? PILOT_DAYS.map((d) => ({ label: surahLabel(lang, d.surah), kind: 'surah' as const }))
            : script
              ? chipsOf(script, lang)
              : []
          ).map((c) => (
            <span
              key={c.label}
              className={cx(
                'flex items-center gap-[7px] rounded-px-14 px-[13px] py-[9px] text-[13.5px]',
                c.kind === 'report'
                  ? 'bg-gold font-extrabold text-on-gold'
                  : 'bg-hero-chip font-bold text-surface',
              )}
            >
              <ChipIcon kind={c.kind} />
              {c.label}
            </span>
          ))}
        </div>
        <div className="relative flex flex-col gap-[7px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] font-bold text-on-deep-green-muted">{progressText}</span>
            <span className="text-[12.5px] text-on-deep-green-muted">{t.duration}</span>
          </div>
          <div
            className="h-[10px] overflow-hidden rounded-px-6 bg-hero-track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.progressLabel}
          >
            <div className="h-full rounded-px-6 bg-gold" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {finished ? (
          // TODO(design): no designed «done for today» hero; the CTA just says goodbye.
          <span
            aria-disabled="true"
            className="relative flex h-[68px] items-center justify-center gap-[10px] rounded-px-22 bg-gold/60 font-heading text-[22px] font-bold text-on-gold"
          >
            {cta}
          </span>
        ) : (
          <Link
            to={paths.child.lesson(today.lessonId)}
            // AI lesson: this tap unlocks audio so the teacher's first line can play.
            onClick={agentEnabled() ? unlockLessonAudio : undefined}
            className="relative flex h-[68px] animate-[gh-breathe_2.8s_ease-in-out_infinite] items-center justify-center gap-[10px] rounded-px-22 bg-gold font-heading text-[22px] font-bold text-on-gold no-underline hover:text-on-gold"
          >
            {cta}
            <ForwardIcon size={24} color="onGold" strokeWidth={2.8} className="ltr:-scale-x-100" />
          </Link>
        )}
      </section>

      {askEnabled() && (
        <Link
          to={paths.child.ask}
          aria-label={m.child.ask.open}
          className="flex shrink-0 animate-[gh-rise_.5s_ease-out_.38s_both] items-center gap-[13px] rounded-px-26 border-[1.5px] border-border bg-surface px-[16px] py-[14px] text-text-dark no-underline shadow-soft hover:text-text-dark"
        >
          <span
            className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-full bg-green-tint"
            aria-hidden="true"
          >
            <img
              src={teacherFrameSrc(getTeacher(lang, child.gender), 'idle')}
              alt=""
              className="absolute inset-x-0 top-[2px] mx-auto h-[86px] w-auto max-w-none object-cover object-top"
            />
          </span>
          <span className="flex min-w-0 grow flex-col gap-[3px]">
            <span className="font-heading text-[19px] leading-[1.4] font-bold text-deep-green">
              {m.child.ask.title}
            </span>
            <span className="text-[13px] leading-[1.6] text-text-muted">{m.child.ask.homeSubtitle}</span>
          </span>
          <span
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-px-16 bg-gold-tint"
            aria-hidden="true"
          >
            <AskBubbleIcon size={26} color={C.ayahBracket} />
          </span>
        </Link>
      )}

      <Link
        to={paths.child.weeklyReview}
        className="flex shrink-0 items-center gap-[13px] rounded-px-26 border-[1.5px] border-gold-border bg-gold-tint px-[18px] py-[16px] text-on-gold no-underline hover:text-on-gold"
      >
        <span
          className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-px-17 bg-surface"
          aria-hidden="true"
        >
          <ReviewTabGlyph color="ayahBracket" size={24} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 grow flex-col gap-[4px]">
          <span className="text-[15.5px] font-extrabold">
            {reviewDay ? fill(lang, m.child.weekReviewOn, { day: reviewDay }) : m.child.weekReview}
          </span>
          {reviewLine && <span className="text-[12.5px] text-warning-text">{reviewLine}</span>}
        </span>
        <ForwardIcon size={20} color="ayahBracket" strokeWidth={2.3} className="ltr:-scale-x-100" />
      </Link>

      <section
        aria-labelledby="browse-title"
        className="flex shrink-0 animate-[gh-rise_.5s_ease-out_.45s_both] flex-col gap-[11px]"
      >
        <h2 id="browse-title" className="m-0 font-heading text-[17px] leading-[1.5] font-bold">
          {t.browse}
        </h2>
        <div className="grid grid-cols-3 gap-[10px]">
          <Shortcut
            to={paths.child.review('quran')}
            tint="bg-green-tint"
            icon={<QuranIcon />}
            title={t.quran}
          >
            {countPhrase(lang, h.surahs, m.child.count.surahs)}
          </Shortcut>
          <Shortcut
            to={paths.child.review('hadith')}
            tint="bg-berry-tint"
            icon={<HadithIcon />}
            title={t.hadith}
          >
            {countPhrase(lang, h.hadith, m.child.count.hadith)}
          </Shortcut>
          <Shortcut
            to={paths.child.review('projects')}
            tint="bg-gold-tint"
            icon={<ProjectIcon />}
            title={t.projects}
          >
            {fill(lang, t.projectsDone, { n: h.projects })}
          </Shortcut>
          <div className="col-span-3 flex items-center gap-[12px] rounded-px-22 border-[1.5px] border-dashed border-border-strong px-[16px] py-[14px]">
            <span
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-px-14 bg-border-soft"
              aria-hidden="true"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.textSubtle} strokeWidth="2" />
                <path
                  d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
                  stroke={C.textSubtle}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="flex grow flex-col gap-[3px]">
              <span className="text-[14.5px] font-extrabold text-text-subtle">{m.child.lockedTitle}</span>
              <span className="text-[12px] text-text-subtle">{t.lockedBody}</span>
            </span>
            <span className="rounded-pill bg-border-soft px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-text-muted">
              {m.child.soon}
            </span>
          </div>
        </div>
      </section>
    </ChildPage>
  );
}

function Shortcut({
  to,
  tint,
  icon,
  title,
  children,
}: {
  to: string;
  tint: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[124px] flex-col items-center justify-center gap-[9px] rounded-px-24 border-[1.5px] border-border bg-surface px-[8px] py-[14px] text-text-dark no-underline shadow-soft hover:text-text-dark"
    >
      <span
        className={`flex h-[54px] w-[54px] items-center justify-center rounded-px-18 ${tint}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-[14.5px] font-extrabold">{title}</span>
      <span className="text-[11.5px] font-bold text-text-muted">{children}</span>
    </Link>
  );
}

function Flame() {
  return (
    <span className="flex animate-[gh-flicker_1.8s_ease-in-out_infinite]" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2.5 C13.5 6.5 17.5 7.5 17.5 12.5 C17.5 16.6 15 19.5 12 19.5 C9 19.5 6.5 16.6 6.5 12.5 C6.5 9.5 8.5 8.5 9.5 6.5 C10 9 11 9.5 12 8 C12.5 6 12 4 12 2.5 Z"
          fill={C.gold}
        />
        <path
          d="M12 11.5 C12.8 13.2 14 14 14 15.8 C14 17.4 13 18.5 12 18.5 C11 18.5 10 17.4 10 15.8 C10 14.6 10.8 13.8 11.2 12.8 C11.5 13.6 11.7 13.8 12 13.2 Z"
          fill={C.berry}
        />
      </svg>
    </span>
  );
}

function ChipIcon({ kind }: { kind: 'surah' | 'hadith' | 'report' }) {
  if (kind === 'report') {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4 V12 L17 14.5"
          stroke={C.onGold}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="8.6" stroke={C.onGold} strokeWidth="2.2" />
      </svg>
    );
  }
  if (kind === 'hadith') {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 12.5 C20 16.4 16.4 19.5 12 19.5 C10.9 19.5 9.9 19.3 8.9 19 L4 20.5 L5.6 16.4 C4.6 15.3 4 14 4 12.5 C4 8.6 7.6 5.5 12 5.5 C16.4 5.5 20 8.6 20 12.5 Z"
          stroke={C.surface}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
        stroke={C.surface}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
