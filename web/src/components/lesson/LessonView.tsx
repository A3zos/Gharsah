// The live lesson (design/v3 L1Intro → L10Done), v0.2 (review notes C7–C12):
// rendered from the LessonAgent's state only — the screen never plays audio or
// advances. Fits the viewport (phone 390×844, desktop 1366×768): header, teacher
// and caption on top, the step's card in the middle (the surah card scrolls
// inside itself), and the mic indicator fixed at the bottom. No "next" arrows —
// the agent moves on by itself; the only control is ✕ → ExitConfirm. No text
// under 16px. Religious text only from the verified content (never generated).
import { useState, useSyncExternalStore } from 'react';

import { countPhrase, fill, formatNumber, useI18n, type UiLanguage } from '../../i18n/i18n';
import type { Subscribe } from '../../lesson/observable';
import { isMicLive, isTeacherListening, isTeacherQuiet, type LessonState } from '../../lesson/state';
import { hadithCopyIn, projectCopyIn, surahNameIn } from '../../lesson/teacherLines';
import { cx } from '../../lib/cx';
import { TeacherArt } from '../child/TeacherArt';
import { type TeacherGender } from '../child/teacherCharacter';
import { getTeacher, teacherName, type Teacher as TeacherInfo } from '../../content/teachers';
import { TeacherSprite, type MouthSource } from '../child/TeacherSprite';
import { C } from '../ui/color';
import { SproutMark } from '../ui/icons';
import { MushafSurahCard } from './Mushaf';
import { TranslationNote } from './Translation';
import { ayahTranslation, hadithTranslation } from '../../content/translations';
import { AllowPrompt, VoiceMic } from './VoiceCall';

/** What the plan card (L1) and the celebration frames (L6, L10) need beyond the state. */
export interface LessonPlanInfo {
  surahName?: string;
  surahAyat?: number;
  hadithTitle?: string;
  hasProject: boolean;
}

/** The child's totals (server `stats`) for L6 and L10. */
export interface ChildGlance {
  surahsTotal: number;
  streak: number;
  /** Short labels of the scheduled days in the streak, oldest first, ending «اليوم». */
  streakDays: string[];
}

export interface LessonActions {
  tapTeacher(): void;
  micTap(): void;
  continueTapped(): void;
  replayAyah(): void;
  play(): void;
  reRecord(): void;
  /** «أعد المحاولة» after the project check service was busy. */
  retryVerify(): void;
  /** «ردّدت» — one repeat when the mic can't hear the child (agent `manualRepeat`). */
  repeatTapped(): void;
  /** The ✕ — opens ExitConfirm. */
  exit(): void;
  goHome(): void;
}

export interface LevelSource {
  readonly value: number;
  readonly subscribe: Subscribe<number>;
}

const clock = (lang: UiLanguage, ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return formatNumber(
    lang,
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
  );
};
const shortClock = (lang: UiLanguage, ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return formatNumber(lang, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
};

export function LessonView({
  state: s,
  plan,
  glance,
  actions,
  level,
  desktop,
  voiceMissing = false,
  gender = 'boy',
  teacher,
  mouth,
}: {
  state: LessonState;
  plan: LessonPlanInfo;
  glance: ChildGlance;
  actions: LessonActions;
  level: LevelSource;
  desktop: boolean;
  /** Neither the server voice nor a browser Arabic voice — the teacher is captions only. */
  voiceMissing?: boolean;
  /** The child's stored gender (the teacher's grammatical gender). */
  gender?: TeacherGender;
  /** The call's teacher, locked at its start (content/teachers.ts); default: the UI language's. */
  teacher?: TeacherInfo;
  /** The teacher's lip-sync. */
  mouth?: MouthSource;
}) {
  const body = (
    <>
      <LiveHeader elapsedMs={s.elapsedMs} onEnd={actions.exit} />
      <Teacher
        state={s}
        gender={gender}
        teacher={teacher}
        mouth={mouth}
        desktop={desktop}
        onTap={actions.tapTeacher}
      >
        {/* Only the teacher talks — the line is written ONLY when no voice can say it. */}
        {voiceMissing && s.caption && (
          <p
            aria-live="polite"
            className={cx(
              'm-0 line-clamp-3 w-full text-center text-[18px] leading-[1.7] font-bold',
              s.happy ? 'text-deep-green' : 'text-text-dark',
            )}
          >
            {s.caption}
          </p>
        )}
      </Teacher>
      <Problems state={s} actions={actions} voiceMissing={voiceMissing} gender={gender} />
      <div className="flex min-h-0 grow flex-col">
        <Middle state={s} plan={plan} glance={glance} actions={actions} />
      </div>
      <Bottom state={s} actions={actions} level={level} gender={gender} />
      {/* The one button of the call: allow the mic, or the sound the browser blocked. */}
      {s.beat === 'awaitMic' ? (
        <AllowPrompt reason="mic" gender={gender} teacher={teacher} onAllow={actions.micTap} />
      ) : (
        s.playbackBlocked && (
          <AllowPrompt reason="sound" gender={gender} teacher={teacher} onAllow={actions.play} />
        )
      )}
    </>
  );

  return <CallFrame desktop={desktop}>{body}</CallFrame>;
}

/**
 * «المعلم يتجهز…»: the call screen before the lesson starts — the character idle,
 * breathing and blinking — while the server voice and the frames get ready.
 */
export function ReadyingCall({
  gender,
  teacher,
  desktop,
  onExit,
}: {
  gender: TeacherGender;
  teacher?: TeacherInfo;
  desktop: boolean;
  onExit: () => void;
}) {
  const { m } = useI18n();
  return (
    <CallFrame desktop={desktop}>
      <LiveHeader elapsedMs={0} onEnd={onExit} />
      <TeacherStage
        gender={gender}
        teacher={teacher}
        desktop={desktop}
        pose="quiet"
        talking={false}
        happy={false}
      >
        <p role="status" className="m-0 text-center text-[17px] font-bold text-text-muted">
          {m.lesson.teacher[gender].readying}
        </p>
      </TeacherStage>
    </CallFrame>
  );
}

/** The call's page: phone column, or the centered card on desktop (LessonDesktop). Shared with the AI-server lesson. */
export function CallFrame({ desktop, children }: { desktop: boolean; children: React.ReactNode }) {
  const { m } = useI18n();
  if (desktop) {
    return (
      <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-background px-[16px] py-[24px] text-text-dark">
        <div
          aria-hidden="true"
          className="absolute -top-[180px] -right-[140px] h-[540px] w-[540px] rounded-full bg-blob-green"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-[200px] -left-[160px] h-[600px] w-[600px] rounded-full bg-gold/9"
        />
        <div className="absolute top-0 right-0 left-0 z-2 flex h-[64px] items-center gap-[10px] px-[36px]">
          <SproutMark size={30} />
          <span className="font-heading text-[21px] font-bold text-deep-green">
            {m.footer.brandLatin || 'غَرْسة'}
          </span>
        </div>
        <div className="relative z-1 flex h-full max-h-[860px] w-[560px] max-w-full flex-col gap-[12px] rounded-px-40 border-[1.5px] border-border bg-surface px-[28px] pt-[22px] pb-[20px] shadow-dark-30-70-10">
          {children}
        </div>
      </main>
    );
  }
  return (
    <main className="relative flex h-dvh justify-center overflow-hidden bg-background px-[16px] pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] text-text-dark">
      <div
        aria-hidden="true"
        className="absolute -top-[170px] -left-[140px] h-[400px] w-[400px] rounded-full bg-blob-green-strong"
      />
      <div className="z-1 flex min-h-0 w-full max-w-[520px] flex-col gap-[10px]">{children}</div>
    </main>
  );
}

export function LiveHeader({ elapsedMs, onEnd }: { elapsedMs: number; onEnd: () => void }) {
  const { lang, m } = useI18n();
  return (
    <div className="flex w-full shrink-0 items-center gap-[11px]">
      <button
        type="button"
        onClick={onEnd}
        aria-label={m.lesson.endCall}
        className="flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-berry-border bg-berry-tint p-0"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" stroke={C.berryDeep} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className="flex grow items-center justify-center gap-[9px]">
        <span className="flex items-center gap-[6px] rounded-pill border border-berry-border bg-surface px-[14px] py-[6px]">
          <span className="h-[8px] w-[8px] animate-[gh-blink_1.4s_ease-in-out_infinite] rounded-full bg-berry" />
          <span className="text-[16px] font-extrabold text-berry-deep">{m.lesson.live}</span>
        </span>
        <span
          role="timer"
          dir="ltr"
          aria-label={m.lesson.timer}
          className="font-heading text-[16px] font-bold text-text-muted"
        >
          {clock(lang, elapsedMs)}
        </span>
      </span>
      <span className="w-[48px] shrink-0" />
    </div>
  );
}

/** The SAME teacher on every frame: talking (lip-sync), listening (leans in), quiet while the reciter plays. */
function Teacher({
  state,
  gender,
  teacher,
  mouth,
  desktop,
  onTap,
  children,
}: {
  state: LessonState;
  gender: TeacherGender;
  teacher?: TeacherInfo;
  mouth?: MouthSource;
  desktop: boolean;
  onTap: () => void;
  children?: React.ReactNode;
}) {
  const quiet = isTeacherQuiet(state);
  const listening = isTeacherListening(state);
  const speaking = !quiet && !listening;
  return (
    <TeacherStage
      gender={gender}
      teacher={teacher}
      desktop={desktop}
      pose={quiet ? 'quiet' : listening ? 'listening' : 'speaking'}
      talking={speaking && state.teacherSpeaking}
      // a praise moment, and the end of the lesson
      happy={state.happy || state.screen === 'lessonEnd'}
      compact={state.screen === 'ayah'}
      mouth={mouth}
      onTap={onTap}
    >
      {children}
    </TeacherStage>
  );
}

/**
 * The hero of the call: the teacher character, large, centered and bottom-anchored
 * (waist up), with the teacher's name — shared with the AI-server lesson. The old
 * SVG teacher stays as the fallback when a sprite frame can't load.
 */
export function TeacherStage({
  gender,
  desktop,
  pose,
  talking,
  happy,
  cheerKey,
  mouth,
  onTap,
  children,
  compact = false,
  teacher: locked,
}: {
  gender: TeacherGender;
  /** The call's teacher (locked at the call's start); default: the UI language's. */
  teacher?: TeacherInfo;
  desktop: boolean;
  pose: 'speaking' | 'listening' | 'quiet';
  talking: boolean;
  happy: boolean;
  cheerKey?: number;
  /** The reciter / the child is on the ayat: a small avatar at the top, the card gets the room. */
  compact?: boolean;
  mouth?: MouthSource;
  onTap?: () => void;
  children?: React.ReactNode;
}) {
  const { lang, m } = useI18n();
  const teacher = locked ?? getTeacher(lang, gender);
  return (
    <div className="flex shrink-0 flex-col items-center gap-[8px]">
      <div
        className={cx(
          'relative w-full transition-[height] duration-500 ease-out motion-reduce:transition-none',
          compact ? 'h-[90px]' : desktop ? 'h-[260px]' : 'h-[clamp(180px,32dvh,320px)]',
        )}
      >
        <TeacherSprite
          teacher={teacher}
          pose={pose}
          talking={talking}
          happy={happy}
          cheerKey={cheerKey}
          mouth={mouth}
          onTap={onTap}
          fallback={
            <span className="flex h-full items-end justify-center">
              <TeacherAvatar
                size={desktop ? 200 : 170}
                onTap={onTap}
                pose={pose}
                talking={talking}
                happy={happy}
              />
            </span>
          }
        />
      </div>
      {!compact && (
        <span className="rounded-pill bg-green-tint px-[14px] py-[4px] text-[16px] font-extrabold text-deep-green">
          {teacherName(m, teacher)}
        </span>
      )}
      {children}
    </div>
  );
}

/** The teacher's look per moment — shared with the AI-server lesson (same character, same animation). */
export function TeacherAvatar({
  size,
  onTap,
  pose,
  talking,
  happy,
}: {
  size: number;
  onTap?: () => void;
  pose: 'speaking' | 'listening' | 'quiet';
  /** Mouth open + sound arcs (a line is actually being voiced). */
  talking: boolean;
  happy: boolean;
}) {
  const { m } = useI18n();
  const quiet = pose === 'quiet';
  const listening = pose === 'listening';
  const speaking = pose === 'speaking';
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={m.lesson.teacherButton}
      className="relative flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      style={{ width: size, height: size }}
    >
      {!quiet && (
        <span
          className={cx(
            'absolute inset-0 animate-[gh-glow-2_2.1s_ease-out_infinite] rounded-full',
            listening ? 'bg-glow-listening' : 'bg-glow-speaking',
          )}
        />
      )}
      <span
        className={cx(
          'relative',
          listening
            ? 'animate-[gh-lean_2.6s_ease-in-out_infinite]'
            : speaking && 'animate-[gh-bob_1.7s_ease-in-out_infinite]',
          quiet && 'opacity-76',
        )}
      >
        <TeacherArt
          size={size}
          eyes={happy ? 'happy' : 'open'}
          eyeRy={listening ? 11.5 : 10}
          mouth={speaking && talking ? 'open' : 'shut'}
          arcs={speaking && talking ? 'double' : 'none'}
        />
      </span>
    </button>
  );
}

/** Save / mic / offline problems — the design's gold note. */
function Problems({
  state: s,
  actions,
  voiceMissing,
  gender,
}: {
  state: LessonState;
  actions: LessonActions;
  voiceMissing: boolean;
  gender: TeacherGender;
}) {
  const { m } = useI18n();
  const text =
    s.progressSaveFailed || s.saveFailed
      ? m.lesson.problems.saveFailed
      : s.contentUnavailable
        ? m.lesson.problems.contentUnavailable
        : voiceMissing
          ? // TODO(design): no designed state — the teacher's voice is unavailable.
            m.lesson.teacher[gender].voiceMissing
          : null;
  if (!text) return null;
  const retry = s.beat === 'saveFailed' || (s.beat === 'recorded' && s.saveFailed);
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-[10px] rounded-px-18 bg-gold-tint px-[14px] py-[10px]"
    >
      <span className="grow text-[16px] leading-[1.6] font-bold text-on-gold">{text}</span>
      {retry && (
        <button
          type="button"
          onClick={actions.continueTapped}
          className="h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[16px] text-[16px] font-extrabold text-surface"
        >
          {m.lesson.problems.retry}
        </button>
      )}
    </div>
  );
}

// ── Middle (per frame) ─────────────────────────────────────────────────────

function Middle({
  state: s,
  plan,
  glance,
  actions,
}: {
  state: LessonState;
  plan: LessonPlanInfo;
  glance: ChildGlance;
  actions: LessonActions;
}) {
  const { m } = useI18n();
  switch (s.screen) {
    case 'intro':
      return <Plan state={s} plan={plan} />;
    case 'reviewIntro':
      return (
        <Card className="items-center justify-center gap-[10px] text-center">
          <span className="font-heading text-[26px] font-bold">{m.lesson.review.title}</span>
          <span className="text-[16px] text-text-muted">{m.lesson.review.body}</span>
        </Card>
      );
    case 'ayah':
      return <SurahStage state={s} actions={actions} />;
    case 'surahDone':
      return <SurahDone state={s} glance={glance} />;
    case 'hadith':
      return <HadithCard state={s} actions={actions} />;
    case 'projectAssign':
      return <ProjectAssign state={s} />;
    case 'projectReport':
      return <ProjectReport state={s} actions={actions} />;
    case 'lessonEnd':
      return <LessonEnd glance={glance} />;
    default:
      return null;
  }
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex min-h-0 grow flex-col rounded-px-28 border-[1.5px] border-border bg-surface px-[16px] py-[14px] shadow-lesson-ayah-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The three stages: stage indicator + the whole surah (verified text) with the
 * current ayah highlighted; stage 2 shows 5 dots, stage 3 «المرة ١ من ٢»; a thin
 * bar between stages. The card scrolls inside itself and keeps the current ayah visible.
 */
function SurahStage({ state: s, actions }: { state: LessonState; actions: LessonActions }) {
  const { lang, m } = useI18n();
  const currentAyah = s.ayahRef?.ayah ?? null;
  const stage = s.stage === 1 || s.stage === 2 || s.stage === 3 ? s.stage : null;
  const name = surahNameIn(lang, s.surahName ?? '');
  // Arabic: the agent's own reference, as before; en / id: the same, in the UI language
  const label =
    lang === 'ar'
      ? (s.ayahReference ?? `سورة ${s.surahName ?? ''}`)
      : s.ayahRef
        ? fill(lang, m.lesson.ayahRef, { name, n: s.ayahRef.ayah })
        : fill(lang, m.lesson.surah, { name });
  return (
    <div className="flex min-h-0 grow flex-col gap-[8px]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-[8px]">
        {stage && (
          <span className="rounded-pill bg-green-tint px-[14px] py-[6px] text-[16px] font-extrabold text-deep-green">
            {fill(lang, m.lesson.stagePill, { n: stage, total: 3, name: m.lesson.stages[stage] })}
          </span>
        )}
        {stage === 2 && !s.stageTransition && (
          <span
            className="flex items-center gap-[6px]"
            aria-label={fill(lang, m.lesson.repeatsAria, { done: s.repeatsDone, target: s.repeatsTarget })}
          >
            {Array.from({ length: s.repeatsTarget }, (_, k) => (
              <span
                key={k}
                className={cx(
                  'h-[14px] w-[14px] rounded-full',
                  k < s.repeatsDone ? 'bg-gold' : 'border-[2px] border-input-border',
                )}
              />
            ))}
          </span>
        )}
        {stage === 3 && !s.stageTransition && s.passesTarget > 0 && (
          <span className="rounded-pill bg-gold-tint px-[14px] py-[6px] text-[16px] font-extrabold text-warning-text">
            {fill(lang, m.lesson.passPill, {
              n: Math.min(s.passesDone + 1, s.passesTarget),
              total: s.passesTarget,
            })}
          </span>
        )}
      </div>
      {s.stageTransition && (
        <div className="h-[4px] shrink-0 overflow-hidden rounded-pill bg-border-soft" aria-hidden="true">
          <div className="h-full origin-right animate-[gh-line_2s_linear_both] rounded-pill bg-primary ltr:origin-left" />
        </div>
      )}
      <SurahCard
        surahName={s.surahName ?? ''}
        ayat={s.surahAyat}
        currentAyah={currentAyah}
        reciting={s.beat === 'reciting'}
        playbackBlocked={false}
        label={label}
        bannerLabel={lang === 'ar' ? undefined : fill(lang, m.lesson.surah, { name })}
        onTap={actions.replayAyah}
        onPlay={actions.play}
      />
      {/* English / Indonesian: the current ayah's translation (QuranEnc) under the Arabic */}
      {s.ayahRef && <TranslationNote t={ayahTranslation(lang, s.ayahRef.surah, s.ayahRef.ayah)} />}
    </div>
  );
}

/** The surah card as a mushaf page (Mushaf.tsx) — shared with the AI-server lesson. */
export function SurahCard(props: Omit<React.ComponentProps<typeof MushafSurahCard>, 'playFallback'>) {
  return <MushafSurahCard {...props} playFallback={(onTap) => <PlayFallback onTap={onTap} />} />;
}

/** Small fallback play when the browser blocked autoplay (the only visible play control). */
export function PlayFallback({ onTap }: { onTap: () => void }) {
  const { m } = useI18n();
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onTap();
        }
      }}
      className="mt-[8px] flex h-[48px] items-center justify-center gap-[8px] self-center rounded-pill bg-green-tint px-[18px] text-[16px] font-extrabold text-deep-green"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 5.5 V18.5 L18.5 12 Z" fill={C.deepGreen} />
      </svg>
      {m.lesson.playFallback}
    </span>
  );
}

/** L1 «خطة اليوم» — no مكية/مدنية (no verified dataset yet). */
function Plan({ state: s, plan }: { state: LessonState; plan: LessonPlanInfo }) {
  const { lang, m } = useI18n();
  const i = s.lineIndex;
  const row = (lit: boolean, title: string, meta: string) => (
    <div
      className={cx(
        'flex items-center gap-[12px] rounded-px-20 px-[14px] py-[12px] transition-colors duration-300',
        lit ? 'border-[2px] border-primary bg-green-tint' : 'border-[1.5px] border-border bg-surface',
      )}
    >
      <span className="grow text-[17px] font-bold">{title}</span>
      <span className="text-[16px] font-extrabold text-text-muted">{meta}</span>
    </div>
  );
  return (
    <section aria-labelledby="plan-title" className="flex flex-col gap-[8px]">
      <h2 id="plan-title" className="m-0 font-heading text-[19px] leading-[1.5] font-bold">
        {m.lesson.plan.title}
      </h2>
      {plan.surahName &&
        row(
          i >= 1 && i <= 3,
          fill(lang, m.lesson.surah, { name: surahNameIn(lang, plan.surahName) }),
          countPhrase(lang, plan.surahAyat ?? 0, m.lesson.plan.ayat),
        )}
      {plan.hadithTitle &&
        row(
          i === 1,
          hadithCopyIn(lang, { title: plan.hadithTitle, topic: plan.hadithTitle }).title,
          m.lesson.plan.oneHadith,
        )}
      {plan.hasProject && row(i === 1, m.lesson.plan.project, m.lesson.plan.atHome)}
    </section>
  );
}

function SurahDone({ state: s, glance }: { state: LessonState; glance: ChildGlance }) {
  const { lang, m } = useI18n();
  // Real values, never empty: this surah is complete now, and today counts in the streak.
  const stat = (n: number, label: string, color: string) => (
    <div className="flex grow basis-0 flex-col items-center gap-[4px] rounded-px-22 bg-surface px-[10px] py-[12px] shadow-child-card">
      <span className={cx('font-heading text-[28px] leading-[1.2] font-extrabold', color)}>
        {formatNumber(lang, n)}
      </span>
      <span className="text-center text-[16px] font-bold text-text-muted">{label}</span>
    </div>
  );
  return (
    <div className="flex grow flex-col items-center justify-center gap-[12px]">
      <h1 className="m-0 text-center font-heading text-[28px] leading-[1.5] font-bold text-deep-green">
        {fill(lang, m.lesson.surahDone.title, { name: surahNameIn(lang, s.surahName ?? '') })}
      </h1>
      <div className="flex w-full gap-[8px]">
        {stat(s.surahAyahCount ?? 0, m.lesson.surahDone.ayatToday, 'text-deep-green')}
        {stat(Math.max(glance.surahsTotal, 1), m.lesson.surahDone.surahsDone, 'text-warning-text')}
        {stat(Math.max(glance.streak, 1), m.lesson.surahDone.streak, 'text-berry-deep')}
      </div>
    </div>
  );
}

function HadithCard({ state: s, actions }: { state: LessonState; actions: LessonActions }) {
  const { lang, m } = useI18n();
  const h = s.hadith;
  if (!h) return null;
  const topic = hadithCopyIn(lang, h).topic;
  if (!h.isApproved) {
    // Unapproved: the topic only — never a placeholder, bracket or internal note (C11).
    return <HadithPendingCard topic={topic} />;
  }
  return (
    <button
      type="button"
      onClick={actions.replayAyah}
      aria-label={m.lesson.hadith.replay}
      className={cx(
        'flex min-h-0 grow cursor-pointer flex-col items-center gap-[12px] overflow-y-auto rounded-px-28 bg-surface px-[18px] py-[16px] font-body text-text-dark shadow-lesson-ayah-card',
        s.beat === 'reciting' ? 'border-[2px] border-primary' : 'border-[1.5px] border-border',
      )}
    >
      <span className="rounded-pill bg-berry-tint px-[14px] py-[6px] text-[16px] font-extrabold text-berry-deep">
        {fill(lang, m.lesson.hadith.about, { topic })}
      </span>
      {/* Approved, vetted text exactly as in content/hadith/hadith.json — Arabic in every language. */}
      <span dir="rtl" lang="ar" className="font-classical text-[24px] leading-[1.9]">
        «{h.displayText}»
      </span>
      <span dir="rtl" lang="ar" className="text-[16px] font-bold text-text-subtle">
        {h.displayTakhrij}
      </span>
      {/* English / Indonesian: HadeethEnc's translation, once a reviewer linked it */}
      <TranslationNote t={hadithTranslation(lang, h.id, h.isApproved)} />
    </button>
  );
}

/** An unapproved hadith: the topic only — never a placeholder, bracket or internal note (C11). */
export function HadithPendingCard({ topic }: { topic: string }) {
  const { lang, m } = useI18n();
  return (
    <Card className="items-center justify-center gap-[14px] text-center">
      <span className="font-heading text-[26px] font-bold">
        {fill(lang, m.lesson.hadith.about, { topic })}
      </span>
      <span className="rounded-pill bg-gold-tint px-[14px] py-[6px] text-[16px] font-extrabold text-warning-text">
        {m.lesson.hadith.pending}
      </span>
    </Card>
  );
}

function ProjectAssign({ state: s }: { state: LessonState }) {
  const { lang, m } = useI18n();
  if (!s.project) return null;
  const p = projectCopyIn(lang, s.project);
  return (
    <Card className="gap-[10px] border-gold-border bg-gold-tint">
      <span className="self-start rounded-pill bg-gold px-[14px] py-[6px] text-[16px] font-extrabold text-on-gold">
        {m.lesson.project.today}
      </span>
      <p className="m-0 font-heading text-[22px] leading-[1.5] font-bold text-on-gold">{p.title}</p>
      <ol className="m-0 flex list-none flex-col gap-[8px] overflow-y-auto p-0">
        {p.hints.map((h, i) =>
          s.lineIndex >= i + 1 ? (
            <li key={h} className="flex items-center gap-[10px] rounded-px-18 bg-surface px-[12px] py-[10px]">
              <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-green-tint font-heading text-[16px] font-extrabold text-deep-green">
                {formatNumber(lang, i + 1)}
              </span>
              <span className="text-[17px] font-bold">{h}</span>
            </li>
          ) : null,
        )}
      </ol>
    </Card>
  );
}

function ProjectReport({ state: s, actions }: { state: LessonState; actions: LessonActions }) {
  const { lang, m } = useI18n();
  const recording = s.beat === 'recording';
  const saved = s.beat === 'recorded' || (s.beat === 'advancing' && s.recordedDurationMs !== null);
  const v = s.verify;
  return (
    <Card
      className={cx(
        'items-center justify-center gap-[12px]',
        recording && 'border-gold',
        saved && 'border-primary',
      )}
    >
      <span className="rounded-pill border border-gold-border bg-gold-tint px-[14px] py-[6px] text-[16px] font-extrabold text-warning-text">
        {m.lesson.project.yesterday}
      </span>
      <p className="m-0 text-center font-heading text-[22px] leading-[1.5] font-bold">
        {s.project ? projectCopyIn(lang, s.project).title : ''}
      </p>
      {recording && (
        <span className="flex items-center gap-[8px] rounded-pill bg-berry-tint px-[15px] py-[8px]">
          <span className="h-[9px] w-[9px] animate-[gh-blink_1.1s_ease-in-out_infinite] rounded-full bg-berry" />
          <span className="text-[16px] font-extrabold text-berry-deep">
            {fill(lang, m.lesson.project.recording, { time: shortClock(lang, s.recordingElapsedMs) })}
          </span>
        </span>
      )}
      {/* the project check: checking… / the server's message exactly / busy + retry */}
      {v?.state === 'checking' && (
        <span
          role="status"
          className="rounded-pill bg-gold-tint px-[15px] py-[8px] text-[16px] font-extrabold text-warning-text"
        >
          {m.lesson.project.checking}
        </span>
      )}
      {v && v.state !== 'checking' && v.message && (
        <p
          role="status"
          dir="auto"
          className={cx(
            'm-0 rounded-px-16 px-[15px] py-[9px] text-center text-[17px] leading-[1.7] font-extrabold',
            v.state === 'verified' ? 'bg-green-tint text-deep-green' : 'bg-gold-tint text-warning-text',
          )}
        >
          {v.message}
        </p>
      )}
      {s.beat === 'verifyRetry' && (
        <button
          type="button"
          onClick={actions.retryVerify}
          className="h-[48px] cursor-pointer rounded-px-16 border-0 bg-gold px-[20px] font-body text-[16px] font-bold text-on-gold"
        >
          {m.lesson.project.retry}
        </button>
      )}
      {saved && (
        <>
          <span className="rounded-pill bg-green-tint px-[15px] py-[8px] text-[16px] font-extrabold text-deep-green">
            {fill(lang, m.lesson.project.saved, { time: shortClock(lang, s.recordedDurationMs ?? 0) })}
          </span>
          <span className="text-center text-[16px] leading-[1.7] font-bold text-text-muted">
            {m.lesson.project.private}
          </span>
          <button
            type="button"
            onClick={actions.reRecord}
            disabled={s.beat !== 'recorded'}
            className="h-[48px] cursor-pointer rounded-px-16 border-[1.5px] border-input-border bg-surface px-[18px] font-body text-[16px] font-bold text-text-muted disabled:opacity-60"
          >
            {m.lesson.project.reRecord}
          </button>
        </>
      )}
    </Card>
  );
}

function LessonEnd({ glance }: { glance: ChildGlance }) {
  const { lang, m } = useI18n();
  const days = glance.streakDays.length ? glance.streakDays : [m.lesson.end.today];
  const n = Math.max(glance.streak, 1);
  return (
    <div className="flex grow flex-col justify-center gap-[12px]">
      <h1 className="m-0 text-center font-heading text-[28px] leading-[1.5] font-bold text-deep-green">
        {m.lesson.end.title}
      </h1>
      <div className="flex items-center gap-[10px] rounded-px-24 bg-surface p-[14px] shadow-lesson-done-card">
        <span className="font-heading text-[20px] font-bold text-deep-green">{m.lesson.end.done}</span>
        <span className="rounded-pill bg-green-tint px-[14px] py-[6px] text-[16px] font-extrabold text-deep-green">
          {m.lesson.end.grew}
        </span>
      </div>
      <div className="flex flex-col gap-[10px] rounded-px-24 bg-surface px-[14px] py-[12px] shadow-lesson-done-card">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-extrabold">{m.lesson.end.streakTitle}</span>
          <span className="rounded-pill bg-gold-tint px-[12px] py-[5px] text-[16px] font-extrabold text-warning-text">
            {countPhrase(lang, n, m.lesson.end.days)}
          </span>
        </div>
        <div className="flex gap-[6px]">
          {days.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className={cx(
                'flex h-[36px] grow basis-0 items-center justify-center rounded-px-12 text-[16px] font-extrabold',
                i === days.length - 1 ? 'bg-gold text-on-gold' : 'bg-green-tint text-deep-green',
              )}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Bottom: the mic indicator (not a button — D2) ────────────────────────────

const BARS = [9, 14, 7, 16, 11, 18, 6, 13, 17, 8, 15, 10, 18, 7, 14, 9, 16, 11, 6, 13, 8];

export function VoiceBars({ level }: { level: LevelSource }) {
  const lvl = useSyncExternalStore(
    level.subscribe,
    () => level.value,
    () => 0,
  );
  return (
    <div
      className="flex h-[18px] items-center justify-center gap-[3px]"
      style={{ transform: `scaleY(${0.55 + 0.45 * lvl})` }}
      aria-hidden="true"
    >
      {BARS.map((h, i) => (
        <span
          key={i}
          className="w-[3px] shrink-0 rounded-px-2 bg-deep-green"
          style={{ height: h, animation: `gh-wave .8s ease-in-out ${(i * 0.05).toFixed(2)}s infinite` }}
        />
      ))}
    </div>
  );
}

function Bottom({
  state: s,
  actions,
  level,
  gender,
}: {
  state: LessonState;
  actions: LessonActions;
  level: LevelSource;
  gender: TeacherGender;
}) {
  const { m } = useI18n();
  // «I heard you»: each counted repeat / pass (the counters reset per step, this one only grows)
  const total = s.repeatsDone + s.passesDone;
  const [heard, setHeard] = useState({ prev: total, n: 0 });
  if (total !== heard.prev) setHeard({ prev: total, n: total > heard.prev ? heard.n + 1 : heard.n });
  if (s.beat === 'done') {
    return (
      <div className="flex shrink-0 flex-col gap-[8px]">
        <span className="text-center text-[16px] font-bold text-text-muted">{m.lesson.end.seeYou}</span>
        <button
          type="button"
          onClick={actions.goHome}
          className="flex h-[56px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-px-22 border-0 bg-deep-green font-heading text-[20px] font-bold text-surface shadow-lesson-home-button"
        >
          {m.lesson.end.home}
        </button>
      </div>
    );
  }
  const live = isMicLive(s) || s.beat === 'recording';
  const denied = s.beat === 'awaitMic';
  const label = live
    ? s.beat === 'recording'
      ? m.lesson.mic.report
      : m.lesson.mic.yourTurn
    : denied
      ? m.lesson.mic.closed
      : s.beat === 'reciting'
        ? m.lesson.mic.reciter
        : s.beat === 'saving' || s.beat === 'saveFailed'
          ? m.lesson.mic.saving
          : m.lesson.teacher[gender].talking;
  // A voice call: only the mic animation — no «ردّدت», no text (the label is for screen readers).
  return <VoiceMic live={live && !denied} heardKey={heard.n} level={level} label={label} />;
}

/**
 * The mic indicator (gold + pulse + voice bars while live; dimmed otherwise) and
 * its line — shared with the AI-server lesson. A button only when `onMicTap` is set.
 */
export function MicIndicator({
  live,
  label,
  level,
  onMicTap,
  trailing,
  hideLabel = false,
}: {
  live: boolean;
  label: string;
  level?: LevelSource;
  onMicTap?: () => void;
  trailing?: React.ReactNode;
  /** A voice call shows no text: the label is for screen readers only. */
  hideLabel?: boolean;
}) {
  const { m } = useI18n();
  const mic = (
    <span
      className={cx(
        'relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full',
        live ? 'bg-gold shadow-lesson-mic-live' : 'border-[2px] border-input-border bg-surface opacity-70',
      )}
    >
      {live && (
        <span className="absolute inset-0 animate-[gh-glow-2_1.5s_ease-out_infinite] rounded-full bg-mic-pulse" />
      )}
      <svg className="relative" width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="9"
          y="3"
          width="6"
          height="11"
          rx="3"
          fill={live ? C.surface : 'none'}
          stroke={live ? C.surface : C.textMuted}
          strokeWidth="2"
        />
        <path
          d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
          stroke={live ? C.surface : C.textMuted}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
  return (
    <div className="flex shrink-0 items-center justify-center gap-[14px]" role="status" aria-live="polite">
      {onMicTap ? (
        // Only when the mic couldn't open by itself (or the child can retry listening): a tap asks again.
        <button
          type="button"
          onClick={onMicTap}
          aria-label={m.lesson.mic.open}
          className="cursor-pointer border-0 bg-transparent p-0"
        >
          {mic}
        </button>
      ) : (
        mic
      )}
      <span className={cx('flex flex-col gap-[4px]', hideLabel && 'sr-only')}>
        <span className={cx('text-[17px] font-extrabold', live ? 'text-warning-text' : 'text-text-muted')}>
          {label}
        </span>
        {live && level && <VoiceBars level={level} />}
      </span>
      {trailing}
    </div>
  );
}
