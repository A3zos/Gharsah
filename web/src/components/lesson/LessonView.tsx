// The live lesson (design/v3 L1Intro → L10Done), v0.2 (review notes C7–C12):
// rendered from the LessonAgent's state only — the screen never plays audio or
// advances. Fits the viewport (phone 390×844, desktop 1366×768): header, teacher
// and caption on top, the step's card in the middle (the surah card scrolls
// inside itself), and the mic indicator fixed at the bottom. No "next" arrows —
// the agent moves on by itself; the only control is ✕ → ExitConfirm. No text
// under 16px. Religious text only from the verified content (never generated).
import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { Subscribe } from '../../lesson/observable';
import { isMicLive, isTeacherListening, isTeacherQuiet, type LessonState } from '../../lesson/state';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { TeacherArt } from '../child/TeacherArt';
import { TEACHER_NAME, TEACHER_TEXT, type TeacherGender } from '../child/teacherCharacter';
import { TeacherSprite, type MouthSource } from '../child/TeacherSprite';
import { C } from '../ui/color';
import { SproutMark } from '../ui/icons';

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

const STAGE_NAMES = { 1: 'استمع وردّد', 2: 'آية آية', 3: 'السورة كاملة' } as const;
export const SAVE_FAILED_TEXT = 'لم نتمكّن من حفظ تقدّمك — تحقّق من الاتصال';

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return toArabicDigits(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
};
const shortClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return toArabicDigits(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
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
  /** The child's stored gender → المعلم عبدالله (boys) / المعلمة سارة (girls). */
  gender?: TeacherGender;
  /** The teacher's lip-sync. */
  mouth?: MouthSource;
}) {
  const body = (
    <>
      <LiveHeader elapsedMs={s.elapsedMs} onEnd={actions.exit} />
      <Teacher state={s} gender={gender} mouth={mouth} desktop={desktop} onTap={actions.tapTeacher}>
        <p
          aria-live="polite"
          className={cx(
            'm-0 line-clamp-3 w-full text-center text-[18px] leading-[1.7] font-bold',
            s.happy ? 'text-deep-green' : 'text-text-dark',
          )}
        >
          {s.caption}
        </p>
      </Teacher>
      <Problems state={s} actions={actions} voiceMissing={voiceMissing} gender={gender} />
      <div className="flex min-h-0 grow flex-col">
        <Middle state={s} plan={plan} glance={glance} actions={actions} />
      </div>
      <Bottom state={s} actions={actions} level={level} gender={gender} />
    </>
  );

  return <CallFrame desktop={desktop}>{body}</CallFrame>;
}

/** The call's page: phone column, or the centered card on desktop (LessonDesktop). Shared with the AI-server lesson. */
export function CallFrame({ desktop, children }: { desktop: boolean; children: React.ReactNode }) {
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
          <span className="font-heading text-[21px] font-bold text-deep-green">غَرْسة</span>
        </div>
        <div className="relative z-1 flex h-full max-h-[720px] w-[560px] max-w-full flex-col gap-[12px] rounded-px-40 border-[1.5px] border-border bg-surface px-[28px] pt-[22px] pb-[20px] shadow-dark-30-70-10">
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
  return (
    <div className="flex w-full shrink-0 items-center gap-[11px]">
      <button
        type="button"
        onClick={onEnd}
        aria-label="إنهاء المكالمة"
        className="flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-berry-border bg-berry-tint p-0"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" stroke={C.berryDeep} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className="flex grow items-center justify-center gap-[9px]">
        <span className="flex items-center gap-[6px] rounded-pill border border-berry-border bg-surface px-[14px] py-[6px]">
          <span className="h-[8px] w-[8px] animate-[gh-blink_1.4s_ease-in-out_infinite] rounded-full bg-berry" />
          <span className="text-[16px] font-extrabold text-berry-deep">مباشر</span>
        </span>
        <span
          role="timer"
          dir="ltr"
          aria-label="مدة الحصة"
          className="font-heading text-[16px] font-bold text-text-muted"
        >
          {clock(elapsedMs)}
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
  mouth,
  desktop,
  onTap,
  children,
}: {
  state: LessonState;
  gender: TeacherGender;
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
      desktop={desktop}
      pose={quiet ? 'quiet' : listening ? 'listening' : 'speaking'}
      talking={speaking && state.teacherSpeaking}
      // a praise moment, and the end of the lesson
      happy={state.happy || state.screen === 'lessonEnd'}
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
}: {
  gender: TeacherGender;
  desktop: boolean;
  pose: 'speaking' | 'listening' | 'quiet';
  talking: boolean;
  happy: boolean;
  cheerKey?: number;
  mouth?: MouthSource;
  onTap?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-[8px]">
      <div className={cx('relative w-full', desktop ? 'h-[260px]' : 'h-[clamp(180px,32dvh,320px)]')}>
        <TeacherSprite
          gender={gender}
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
      <span className="rounded-pill bg-green-tint px-[14px] py-[4px] text-[16px] font-extrabold text-deep-green">
        {TEACHER_NAME[gender]}
      </span>
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
  const quiet = pose === 'quiet';
  const listening = pose === 'listening';
  const speaking = pose === 'speaking';
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="المعلّم"
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
  const text =
    s.progressSaveFailed || s.saveFailed
      ? SAVE_FAILED_TEXT
      : s.micDenied
        ? 'لا أسمعك — اطلب من بابا أو ماما السماح للمتصفح باستخدام الميكروفون.'
        : s.contentUnavailable
          ? 'لا يوجد اتصال لتحميل التلاوة — اتصل بالإنترنت وحاول مجددًا.'
          : voiceMissing
            ? // TODO(design): no designed state — the teacher's voice is unavailable.
              TEACHER_TEXT[gender].voiceMissing
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
          حاول مجددًا
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
  switch (s.screen) {
    case 'intro':
      return <Plan state={s} plan={plan} />;
    case 'reviewIntro':
      return (
        <Card className="items-center justify-center gap-[10px] text-center">
          <span className="font-heading text-[26px] font-bold">المراجعة الأسبوعية</span>
          <span className="text-[16px] text-text-muted">نراجع ما حفظته هذا الأسبوع</span>
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
  const currentAyah = s.ayahRef?.ayah ?? null;
  const stage = s.stage === 1 || s.stage === 2 || s.stage === 3 ? s.stage : null;
  return (
    <div className="flex min-h-0 grow flex-col gap-[8px]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-[8px]">
        {stage && (
          <span className="rounded-pill bg-green-tint px-[14px] py-[6px] text-[16px] font-extrabold text-deep-green">
            المرحلة {toArabicDigits(stage)} من ٣ — {STAGE_NAMES[stage]}
          </span>
        )}
        {stage === 2 && !s.stageTransition && (
          <span
            className="flex items-center gap-[6px]"
            aria-label={`التكرار ${toArabicDigits(s.repeatsDone)} من ${toArabicDigits(s.repeatsTarget)}`}
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
            المرة {toArabicDigits(Math.min(s.passesDone + 1, s.passesTarget))} من{' '}
            {toArabicDigits(s.passesTarget)}
          </span>
        )}
      </div>
      {s.stageTransition && (
        <div className="h-[4px] shrink-0 overflow-hidden rounded-pill bg-border-soft" aria-hidden="true">
          <div className="h-full origin-right animate-[gh-line_2s_linear_both] rounded-pill bg-primary" />
        </div>
      )}
      <SurahCard
        surahName={s.surahName ?? ''}
        ayat={s.surahAyat}
        currentAyah={currentAyah}
        reciting={s.beat === 'reciting'}
        playbackBlocked={s.playbackBlocked}
        label={s.ayahReference ?? `سورة ${s.surahName ?? ''}`}
        onTap={actions.replayAyah}
        onPlay={actions.play}
      />
    </div>
  );
}

/** The surah card (verified text, current ayah highlighted, tap = hear again) — shared with the AI-server lesson. */
export function SurahCard({
  surahName,
  ayat,
  currentAyah,
  reciting,
  playbackBlocked,
  label,
  onTap,
  onPlay,
}: {
  surahName: string;
  ayat: readonly { readonly ayah: number; readonly text: string }[];
  currentAyah: number | null;
  reciting: boolean;
  playbackBlocked: boolean;
  label: string;
  onTap: () => void;
  onPlay: () => void;
}) {
  const current = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [currentAyah]);
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={label}
      className={cx(
        'flex min-h-0 grow cursor-pointer flex-col overflow-y-auto rounded-px-28 bg-surface px-[18px] py-[14px] text-right font-body text-text-dark shadow-lesson-ayah-card',
        reciting ? 'border-[2px] border-primary' : 'border-[1.5px] border-border',
      )}
    >
      <span className="mb-[6px] text-center text-[16px] font-bold text-text-muted">سورة {surahName}</span>
      <span className="font-ayah text-[28px] leading-[2.1]">
        {ayat.map((a) => {
          const on = a.ayah === currentAyah;
          return (
            <span
              key={a.ayah}
              ref={on ? current : undefined}
              className={cx('rounded-px-12 px-[4px] transition-colors', on && 'bg-gold-tint text-deep-green')}
            >
              {a.text}
              <span className="text-ayah-bracket" aria-hidden="true">
                {' '}
                ﴿{toArabicDigits(a.ayah)}﴾{' '}
              </span>
            </span>
          );
        })}
      </span>
      {playbackBlocked && <PlayFallback onTap={onPlay} />}
    </button>
  );
}

/** Small fallback play when the browser blocked autoplay (the only visible play control). */
export function PlayFallback({ onTap }: { onTap: () => void }) {
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
      اضغط لتسمع التلاوة
    </span>
  );
}

/** L1 «خطة اليوم» — no مكية/مدنية (no verified dataset yet). */
function Plan({ state: s, plan }: { state: LessonState; plan: LessonPlanInfo }) {
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
        خطة اليوم
      </h2>
      {plan.surahName &&
        row(i >= 1 && i <= 3, `سورة ${plan.surahName}`, `${toArabicDigits(plan.surahAyat ?? 0)} آيات`)}
      {plan.hadithTitle && row(i === 1, plan.hadithTitle, 'حديث واحد')}
      {plan.hasProject && row(i === 1, 'مشروع اليوم', 'في البيت')}
    </section>
  );
}

function SurahDone({ state: s, glance }: { state: LessonState; glance: ChildGlance }) {
  // Real values, never empty: this surah is complete now, and today counts in the streak.
  const stat = (n: number, label: string, color: string) => (
    <div className="flex grow basis-0 flex-col items-center gap-[4px] rounded-px-22 bg-surface px-[10px] py-[12px] shadow-child-card">
      <span className={cx('font-heading text-[28px] leading-[1.2] font-extrabold', color)}>
        {toArabicDigits(n)}
      </span>
      <span className="text-center text-[16px] font-bold text-text-muted">{label}</span>
    </div>
  );
  return (
    <div className="flex grow flex-col items-center justify-center gap-[12px]">
      <h1 className="m-0 text-center font-heading text-[28px] leading-[1.5] font-bold text-deep-green">
        أتممت سورة {s.surahName ?? ''}!
      </h1>
      <div className="flex w-full gap-[8px]">
        {stat(s.surahAyahCount ?? 0, 'آيات اليوم', 'text-deep-green')}
        {stat(Math.max(glance.surahsTotal, 1), 'سور مكتملة', 'text-warning-text')}
        {stat(Math.max(glance.streak, 1), 'أيام متتالية', 'text-berry-deep')}
      </div>
    </div>
  );
}

function HadithCard({ state: s, actions }: { state: LessonState; actions: LessonActions }) {
  const h = s.hadith;
  if (!h) return null;
  if (!h.isApproved) {
    // Unapproved: the topic only — never a placeholder, bracket or internal note (C11).
    return <HadithPendingCard topic={h.topic} />;
  }
  return (
    <button
      type="button"
      onClick={actions.replayAyah}
      aria-label="أعد سماع الحديث"
      className={cx(
        'flex min-h-0 grow cursor-pointer flex-col items-center gap-[12px] overflow-y-auto rounded-px-28 bg-surface px-[18px] py-[16px] font-body text-text-dark shadow-lesson-ayah-card',
        s.beat === 'reciting' ? 'border-[2px] border-primary' : 'border-[1.5px] border-border',
      )}
    >
      <span className="rounded-pill bg-berry-tint px-[14px] py-[6px] text-[16px] font-extrabold text-berry-deep">
        حديث اليوم عن {h.topic}
      </span>
      {/* Approved, vetted text exactly as in content/hadith/hadith.json. */}
      <span className="font-classical text-[24px] leading-[1.9]">«{h.displayText}»</span>
      <span className="text-[16px] font-bold text-text-subtle">{h.displayTakhrij}</span>
      {s.playbackBlocked && <PlayFallback onTap={actions.play} />}
    </button>
  );
}

/** An unapproved hadith: the topic only — never a placeholder, bracket or internal note (C11). */
export function HadithPendingCard({ topic }: { topic: string }) {
  return (
    <Card className="items-center justify-center gap-[14px] text-center">
      <span className="font-heading text-[26px] font-bold">حديث اليوم عن {topic}</span>
      <span className="rounded-pill bg-gold-tint px-[14px] py-[6px] text-[16px] font-extrabold text-warning-text">
        قيد المراجعة الشرعية
      </span>
    </Card>
  );
}

function ProjectAssign({ state: s }: { state: LessonState }) {
  const p = s.project;
  if (!p) return null;
  return (
    <Card className="gap-[10px] border-gold-border bg-gold-tint">
      <span className="self-start rounded-pill bg-gold px-[14px] py-[6px] text-[16px] font-extrabold text-on-gold">
        مشروع اليوم
      </span>
      <p className="m-0 font-heading text-[22px] leading-[1.5] font-bold text-on-gold">{p.title}</p>
      <ol className="m-0 flex list-none flex-col gap-[8px] overflow-y-auto p-0">
        {p.hints.map((h, i) =>
          s.lineIndex >= i + 1 ? (
            <li key={h} className="flex items-center gap-[10px] rounded-px-18 bg-surface px-[12px] py-[10px]">
              <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-green-tint font-heading text-[16px] font-extrabold text-deep-green">
                {toArabicDigits(i + 1)}
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
  const recording = s.beat === 'recording';
  const saved = s.beat === 'recorded' || (s.beat === 'advancing' && s.recordedDurationMs !== null);
  return (
    <Card
      className={cx(
        'items-center justify-center gap-[12px]',
        recording && 'border-gold',
        saved && 'border-primary',
      )}
    >
      <span className="rounded-pill border border-gold-border bg-gold-tint px-[14px] py-[6px] text-[16px] font-extrabold text-warning-text">
        مشروع الأمس
      </span>
      <p className="m-0 text-center font-heading text-[22px] leading-[1.5] font-bold">
        {s.project?.title ?? ''}
      </p>
      {recording && (
        <span className="flex items-center gap-[8px] rounded-pill bg-berry-tint px-[15px] py-[8px]">
          <span className="h-[9px] w-[9px] animate-[gh-blink_1.1s_ease-in-out_infinite] rounded-full bg-berry" />
          <span className="text-[16px] font-extrabold text-berry-deep">
            جارٍ التسجيل · {shortClock(s.recordingElapsedMs)}
          </span>
        </span>
      )}
      {saved && (
        <>
          <span className="rounded-pill bg-green-tint px-[15px] py-[8px] text-[16px] font-extrabold text-deep-green">
            حُفظ صوتك · {shortClock(s.recordedDurationMs ?? 0)}
          </span>
          <span className="text-center text-[16px] leading-[1.7] font-bold text-text-muted">
            يصل إلى لوحة والدك — لا يُنشر لأحد غيره.
          </span>
          <button
            type="button"
            onClick={actions.reRecord}
            disabled={s.beat !== 'recorded'}
            className="h-[48px] cursor-pointer rounded-px-16 border-[1.5px] border-input-border bg-surface px-[18px] font-body text-[16px] font-bold text-text-muted disabled:opacity-60"
          >
            أعِد التسجيل
          </button>
        </>
      )}
    </Card>
  );
}

function LessonEnd({ glance }: { glance: ChildGlance }) {
  const days = glance.streakDays.length ? glance.streakDays : ['اليوم'];
  const n = Math.max(glance.streak, 1);
  return (
    <div className="flex grow flex-col justify-center gap-[12px]">
      <h1 className="m-0 text-center font-heading text-[28px] leading-[1.5] font-bold text-deep-green">
        أكملت حصة اليوم!
      </h1>
      <div className="flex items-center gap-[10px] rounded-px-24 bg-surface p-[14px] shadow-lesson-done-card">
        <span className="font-heading text-[20px] font-bold text-deep-green">أكملت درس اليوم ✓</span>
        <span className="rounded-pill bg-green-tint px-[14px] py-[6px] text-[16px] font-extrabold text-deep-green">
          غرستك كبرت خطوة
        </span>
      </div>
      <div className="flex flex-col gap-[10px] rounded-px-24 bg-surface px-[14px] py-[12px] shadow-lesson-done-card">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-extrabold">أيامك المتتالية</span>
          <span className="rounded-pill bg-gold-tint px-[12px] py-[5px] text-[16px] font-extrabold text-warning-text">
            {toArabicDigits(n)} {n >= 3 && n <= 10 ? 'أيام' : 'يوم'}
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
  if (s.beat === 'done') {
    return (
      <div className="flex shrink-0 flex-col gap-[8px]">
        <span className="text-center text-[16px] font-bold text-text-muted">إلى اللقاء غدًا</span>
        <button
          type="button"
          onClick={actions.goHome}
          className="flex h-[56px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-px-22 border-0 bg-deep-green font-heading text-[20px] font-bold text-surface shadow-lesson-home-button"
        >
          عودة للرئيسية
        </button>
      </div>
    );
  }
  const live = isMicLive(s) || s.beat === 'recording';
  const denied = s.beat === 'awaitMic';
  const label = live
    ? s.beat === 'recording'
      ? 'أسمعك… احكِ لي'
      : 'دورك… أنا أسمعك'
    : denied
      ? 'الميكروفون مغلق'
      : s.beat === 'reciting'
        ? 'القارئ يقرأ… استمع'
        : s.beat === 'saving' || s.beat === 'saveFailed'
          ? 'نحفظ تقدّمك…'
          : TEACHER_TEXT[gender].talking;
  return (
    <MicIndicator
      live={live}
      label={label}
      level={level}
      onMicTap={denied ? actions.micTap : undefined}
      trailing={
        canTapRepeat(s) && (
          // TODO(design): «ردّدت» — the fallback when the mic can't hear the child; never a dead end.
          <button
            type="button"
            onClick={actions.repeatTapped}
            className="h-[48px] shrink-0 cursor-pointer rounded-px-14 border-0 bg-deep-green px-[18px] text-[17px] font-extrabold text-surface"
          >
            {s.screen === 'surahDone' ? 'جاهز' : 'ردّدت'}
          </button>
        )
      }
    />
  );
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
}: {
  live: boolean;
  label: string;
  level?: LevelSource;
  onMicTap?: () => void;
  trailing?: React.ReactNode;
}) {
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
          aria-label="افتح الميكروفون"
          className="cursor-pointer border-0 bg-transparent p-0"
        >
          {mic}
        </button>
      ) : (
        mic
      )}
      <span className="flex flex-col gap-[4px]">
        <span className={cx('text-[17px] font-extrabold', live ? 'text-warning-text' : 'text-text-muted')}>
          {label}
        </span>
        {live && level && <VoiceBars level={level} />}
      </span>
      {trailing}
    </div>
  );
}

/** «ردّدت» is offered (mic refused, or silence past a nudge) while the child's turn is open. */
function canTapRepeat(s: LessonState): boolean {
  if (!s.manualRepeat || s.paused) return false;
  // The report: only when the mic is blocked (a working mic records the child's voice).
  if (s.screen === 'projectReport') return s.beat === 'awaitMic';
  return (
    s.beat === 'listening' || s.beat === 'nudging' || s.beat === 'awaitMic' || s.beat === 'hearingAnswer'
  );
}
