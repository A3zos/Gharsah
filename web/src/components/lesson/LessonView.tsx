// Frames L1Intro → L10Done (design/v3): one live "call" screen rendered from the
// LessonAgent's state only — port of app/lib/features/lesson/screens/lesson_view.dart.
// The screen never plays audio or advances by itself; every tap is forwarded.
// Phone/tablet: the 390 frame centered at 520. Desktop: the LessonDesktop card (560).
import { useSyncExternalStore } from 'react';

import type { Subscribe } from '../../lesson/observable';
import { isMicLive, isTeacherListening, isTeacherQuiet, type LessonState } from '../../lesson/state';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { AyahText } from '../ui/AyahText';
import { C } from '../ui/color';
import { SproutMark } from '../ui/icons';
import { Note } from '../ui/Note';
import { TeacherArt } from '../child/TeacherArt';

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
  /** The ✕ — opens ExitConfirm. */
  exit(): void;
  goHome(): void;
}

export interface LevelSource {
  readonly value: number;
  readonly subscribe: Subscribe<number>;
}

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
}: {
  state: LessonState;
  plan: LessonPlanInfo;
  glance: ChildGlance;
  actions: LessonActions;
  level: LevelSource;
  desktop: boolean;
}) {
  const end = s.screen === 'lessonEnd';
  const compact = s.screen === 'surahDone' || s.screen === 'projectAssign' || s.screen === 'projectReport';
  const body = (
    <>
      <LiveHeader elapsedMs={s.elapsedMs} onEnd={actions.exit} desktop={desktop} />
      <Teacher
        state={s}
        size={desktop ? 198 : end ? 164 : compact ? 170 : 180}
        box={desktop ? 210 : end ? 172 : compact ? 178 : 190}
        onTap={actions.tapTeacher}
      />
      <div className="flex min-h-[34px] shrink-0 items-center justify-center">
        <p
          aria-live="polite"
          className={cx(
            'm-0 text-center leading-[1.7] font-bold',
            desktop ? 'text-[18px]' : 'text-[17px]',
            s.happy ? 'text-deep-green' : 'text-text-dark',
          )}
        >
          {s.caption}
        </p>
      </div>
      <Problems state={s} />
      <Middle state={s} plan={plan} glance={glance} actions={actions} desktop={desktop} />
      <Bottom state={s} actions={actions} level={level} desktop={desktop} />
    </>
  );

  if (desktop) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-[16px] py-[96px] text-text-dark">
        <div
          aria-hidden="true"
          className="absolute -top-[180px] -right-[140px] h-[540px] w-[540px] rounded-full bg-blob-green"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-[200px] -left-[160px] h-[600px] w-[600px] rounded-full bg-gold/9"
        />
        <div className="absolute top-0 right-0 left-0 z-2 flex h-[74px] items-center gap-[10px] px-[36px]">
          <SproutMark size={30} />
          <span className="font-heading text-[21px] font-bold text-deep-green">غَرْسة</span>
        </div>
        <div className="relative z-1 flex w-[560px] max-w-full flex-col gap-[14px] rounded-px-40 border-[1.5px] border-border bg-surface px-[34px] pt-[30px] pb-[34px] shadow-dark-30-70-10">
          {body}
        </div>
      </main>
    );
  }
  return (
    <main className="relative flex min-h-dvh justify-center overflow-hidden bg-background px-[20px] pt-[max(24px,env(safe-area-inset-top))] pb-[max(26px,env(safe-area-inset-bottom))] text-text-dark">
      <Blobs screen={s.screen} />
      <div className={cx('z-1 flex max-w-[520px] grow flex-col', end ? 'gap-[11px]' : 'gap-[12px]')}>
        {body}
      </div>
    </main>
  );
}

function Blobs({ screen }: { screen: LessonState['screen'] }) {
  const b = (cls: string) => <div aria-hidden="true" className={cx('absolute rounded-full', cls)} />;
  switch (screen) {
    case 'surahDone':
      return (
        <>
          {b('-top-[140px] -left-[120px] h-[330px] w-[330px] bg-blob-green-10')}
          {b('-right-[100px] -bottom-[120px] h-[280px] w-[280px] bg-blob-gold-strong')}
        </>
      );
    case 'hadith':
      return b('-bottom-[150px] -left-[120px] h-[360px] w-[360px] bg-blob-gold-strong');
    case 'projectAssign':
      return b('-bottom-[150px] -left-[120px] h-[360px] w-[360px] bg-blob-gold-14');
    case 'projectReport':
      return b('-top-[160px] -left-[130px] h-[380px] w-[380px] bg-blob-green-09');
    case 'lessonEnd':
      return (
        <>
          {b('-top-[150px] -left-[130px] h-[350px] w-[350px] bg-blob-green-10')}
          {b('-right-[110px] -bottom-[130px] h-[300px] w-[300px] bg-blob-gold-strong')}
        </>
      );
    default:
      return b('-top-[170px] -left-[140px] h-[400px] w-[400px] bg-blob-green-strong');
  }
}

function LiveHeader({
  elapsedMs,
  onEnd,
  desktop,
}: {
  elapsedMs: number;
  onEnd: () => void;
  desktop: boolean;
}) {
  const size = desktop ? 'h-[46px] w-[46px]' : 'h-[44px] w-[44px]';
  return (
    <div className="flex w-full shrink-0 items-center gap-[11px]">
      <button
        type="button"
        onClick={onEnd}
        aria-label="إنهاء المكالمة"
        className={cx(
          'flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-berry-border bg-berry-tint p-0',
          size,
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" stroke={C.berryDeep} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className={cx('flex grow items-center justify-center', desktop ? 'gap-[9px]' : 'gap-[8px]')}>
        <span
          className={cx(
            'flex items-center gap-[6px] rounded-pill border border-berry-border',
            desktop ? 'bg-background px-[14px] py-[8px]' : 'bg-surface px-[13px] py-[7px]',
          )}
        >
          <span className="h-[8px] w-[8px] animate-[gh-blink_1.4s_ease-in-out_infinite] rounded-full bg-berry" />
          <span className={cx('font-extrabold text-berry-deep', desktop ? 'text-[12.5px]' : 'text-[12px]')}>
            مباشر
          </span>
        </span>
        <span
          role="timer"
          aria-label="مدة الحصة"
          className={cx('font-heading font-bold text-text-muted', desktop ? 'text-[14px]' : 'text-[13.5px]')}
        >
          {clock(elapsedMs)}
        </span>
      </span>
      <span className={cx('shrink-0', desktop ? 'w-[46px]' : 'w-[44px]')} />
    </div>
  );
}

/** The SAME teacher on every frame: talking (bob + arcs), listening (leans in), quiet while the reciter plays. */
function Teacher({
  state,
  size,
  box,
  onTap,
}: {
  state: LessonState;
  size: number;
  box: number;
  onTap: () => void;
}) {
  const quiet = isTeacherQuiet(state);
  const listening = isTeacherListening(state);
  const speaking = !quiet && !listening;
  const glow = size * 1.011;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="تابع مع المعلّم"
      className="relative flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
      style={{ height: box }}
    >
      {!quiet && (
        <span
          className={cx(
            'absolute animate-[gh-glow-2_2.1s_ease-out_infinite] rounded-full',
            listening ? 'bg-glow-listening' : 'bg-glow-speaking',
          )}
          style={{ width: glow, height: glow }}
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
          eyes={state.happy ? 'happy' : 'open'}
          eyeRy={listening ? 11.5 : 10}
          mouth={speaking ? 'open' : 'shut'}
          arcs={speaking ? 'double' : 'none'}
        />
      </span>
    </button>
  );
}

/** TODO(design): mic denied / offline / save failed — the design's info note (Tier 3 has the full states). */
function Problems({ state: s }: { state: LessonState }) {
  const text = s.micDenied
    ? 'لا أسمعك — اطلب من بابا أو ماما السماح للمتصفح باستخدام الميكروفون.'
    : s.saveFailed
      ? 'لم يُحفظ صوتك بعد — تأكّد من الإنترنت ثم اضغط السهم.'
      : s.contentUnavailable
        ? 'لا يوجد اتصال لتحميل التلاوة — اتصل بالإنترنت وحاول مجددًا.'
        : null;
  if (!text) return null;
  return (
    <Note tone="gold" className="shrink-0 text-[13.5px] leading-[1.7] font-bold">
      <span role="alert">{text}</span>
    </Note>
  );
}

// ── Middle (per frame) ─────────────────────────────────────────────────────

function Middle({
  state: s,
  plan,
  glance,
  actions,
  desktop,
}: {
  state: LessonState;
  plan: LessonPlanInfo;
  glance: ChildGlance;
  actions: LessonActions;
  desktop: boolean;
}) {
  const box = (child: React.ReactNode) => (
    <div className={cx('flex shrink-0 flex-col justify-center', !desktop && 'min-h-[292px]')}>{child}</div>
  );
  switch (s.screen) {
    case 'intro':
      return box(<Plan state={s} plan={plan} />);
    case 'ayah':
      return box(
        <button
          key={s.ayahRef ? `${s.ayahRef.surah}:${s.ayahRef.ayah}` : 'ayah'}
          type="button"
          onClick={actions.replayAyah}
          aria-label="أعد سماع الآية"
          className={cx(
            'relative flex w-full animate-[gh-swap_.45s_ease-out_both] cursor-pointer flex-col items-center gap-[14px] rounded-px-32 font-body text-text-dark',
            desktop
              ? 'bg-background px-[22px] pt-[30px] pb-[24px]'
              : 'bg-surface px-[18px] pt-[28px] pb-[22px] shadow-lesson-ayah-card',
            s.beat === 'reciting' ? 'border-[2px] border-primary' : 'border-[1.5px] border-border',
          )}
        >
          <AyahText
            text={s.ayahText ?? ''}
            className={cx(
              'flex items-center justify-center leading-[1.9]',
              desktop ? 'min-h-[112px] text-[34px]' : 'min-h-[108px] text-[31px]',
            )}
            bracketClassName={desktop ? 'text-[38px]' : 'text-[35px]'}
          />
          <span className={cx('font-bold text-text-muted', desktop ? 'text-[13.5px]' : 'text-[13px]')}>
            {s.ayahReference}
          </span>
          {s.playbackBlocked && <PlayFallback onTap={actions.play} />}
        </button>,
      );
    case 'surahDone':
      return <SurahDone state={s} glance={glance} />;
    case 'hadith':
      return box(<HadithCard state={s} actions={actions} desktop={desktop} />);
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

/** Small fallback play when the browser blocked autoplay (the only visible play control). */
function PlayFallback({ onTap }: { onTap: () => void }) {
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
      className="flex h-[48px] items-center justify-center gap-[8px] rounded-pill bg-green-tint px-[18px] text-[14px] font-extrabold text-deep-green"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 5.5 V18.5 L18.5 12 Z" fill={C.deepGreen} />
      </svg>
      اضغط لتسمع التلاوة
    </span>
  );
}

const BookIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
      stroke={C.deepGreen}
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <path d="M12 5.8 V18.8" stroke={C.deepGreen} strokeWidth="1.9" />
  </svg>
);
const HadithGlyph = ({ size = 21 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
const LeafIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20 C12 15.5 14.8 12.5 19 12 C19 16.5 16.2 19.6 12 20 Z" fill={C.goldDeep} />
    <path d="M12 20 C12 15.5 9.2 12.5 5 12 C5 16.5 7.8 19.6 12 20 Z" fill={C.goldMid} />
  </svg>
);
const Sparkle = ({ size, color, className }: { size: number; color: string; className: string }) => (
  <span className={cx('absolute', className)} aria-hidden="true">
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L14 9.4 L21.5 12 L14 14.6 L12 22 L10 14.6 L2.5 12 L10 9.4 Z" fill={color} />
    </svg>
  </span>
);

/** L1 «خطة اليوم». Lines: 0 greet · 1 plan · 2 surah · 3 count · 4 ready — no مكية/مدنية (no verified dataset yet). */
function Plan({ state: s, plan }: { state: LessonState; plan: LessonPlanInfo }) {
  const i = s.lineIndex;
  const row = (lit: boolean) =>
    cx(
      'flex flex-col gap-[8px] rounded-px-20 px-[13px] py-[11px] transition-colors duration-300',
      lit
        ? 'animate-[gh-pop_.45s_ease-out_both] border-[2px] border-primary bg-green-tint'
        : 'border-[1.5px] border-border bg-surface',
    );
  const head = (icon: React.ReactNode, title: string, meta: string) => (
    <div className="flex items-center gap-[12px]">
      <span
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-px-13 bg-surface"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="grow text-[15.5px] font-bold">{title}</span>
      <span className="text-[12.5px] font-extrabold text-text-muted">{meta}</span>
    </div>
  );
  const ayat = toArabicDigits(plan.surahAyat ?? 0);
  return (
    <section
      aria-labelledby="plan-title"
      className="flex animate-[gh-swap_.4s_ease-out_both] flex-col gap-[9px]"
    >
      <h2 id="plan-title" className="m-0 font-heading text-[17px] leading-[1.5] font-bold">
        خطة اليوم
      </h2>
      {plan.surahName && (
        <div className={row(i >= 1 && i <= 3)}>
          {head(<BookIcon />, `سورة ${plan.surahName}`, `${ayat} آيات`)}
          {i >= 3 && (
            <div className="flex gap-[7px] ps-[52px]">
              <span className="animate-[gh-pop-2_.4s_ease-out_both] rounded-pill bg-sky-tint px-[12px] py-[6px] text-[12px] font-extrabold text-sky-text">
                {ayat} آيات قصيرة
              </span>
            </div>
          )}
        </div>
      )}
      {plan.hadithTitle && (
        <div className={row(i === 1)}>{head(<HadithGlyph />, plan.hadithTitle, 'حديث واحد')}</div>
      )}
      {plan.hasProject && (
        <div className={row(i === 1)}>{head(<LeafIcon />, 'مشروع الأسبوع', 'في البيت')}</div>
      )}
    </section>
  );
}

function SurahDone({ state: s, glance }: { state: LessonState; glance: ChildGlance }) {
  const stat = (n: number, label: string, color: string, delay: string) => (
    <div
      className="flex grow basis-0 flex-col items-center gap-[4px] rounded-px-22 bg-surface px-[12px] py-[14px] shadow-child-card"
      style={{ animation: `gh-pop .45s ease-out ${delay} both` }}
    >
      <span className={cx('font-heading text-[28px] leading-[1.2] font-extrabold', color)}>
        {toArabicDigits(n)}
      </span>
      <span className="text-[12.5px] font-bold text-text-muted">{label}</span>
    </div>
  );
  return (
    <>
      <div className="relative flex shrink-0 items-center justify-center">
        <Sparkle
          size={26}
          color={C.gold}
          className="-top-[6px] right-[62px] animate-[gh-spark_1.8s_ease-in-out_.1s_infinite]"
        />
        <Sparkle
          size={21}
          color={C.sky}
          className="top-[30px] left-[54px] animate-[gh-spark_1.8s_ease-in-out_.6s_infinite]"
        />
        <Sparkle
          size={17}
          color={C.berry}
          className="right-[82px] bottom-[2px] animate-[gh-spark_1.8s_ease-in-out_1.1s_infinite]"
        />
        <span className="animate-[gh-float-2_3s_ease-in-out_infinite]">
          <svg width="132" height="132" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill={C.greenTint} />
            <path d="M50 80 V46" stroke={C.deepGreen} strokeWidth="6" strokeLinecap="round" />
            <path d="M50 60 C36 60 27 52 27 39 C41 39 50 47 50 60 Z" fill={C.primary} />
            <path d="M50 54 C64 54 73 46 73 33 C59 33 50 41 50 54 Z" fill={C.softGreen} />
            <circle cx="50" cy="30" r="10" fill={C.primary} />
            <circle cx="50" cy="82" r="5" fill={C.gold} />
            <circle cx="72" cy="26" r="3.6" fill={C.gold} />
            <circle cx="28" cy="28" r="3" fill={C.gold} />
          </svg>
        </span>
      </div>
      <h1 className="m-0 shrink-0 animate-[gh-pop_.5s_ease-out_.1s_both] text-center font-heading text-[29px] leading-[1.5] font-bold text-deep-green">
        أتممت سورة {s.surahName ?? ''}!
      </h1>
      <div className="flex shrink-0 gap-[10px]">
        {stat(s.surahAyahCount ?? 0, 'آيات اليوم', 'text-deep-green', '.6s')}
        {stat(glance.surahsTotal, 'سور مكتملة', 'text-warning-text', '.75s')}
        {stat(glance.streak, 'أيام متتالية', 'text-berry-deep', '.9s')}
      </div>
    </>
  );
}

function HadithCard({
  state: s,
  actions,
  desktop,
}: {
  state: LessonState;
  actions: LessonActions;
  desktop: boolean;
}) {
  const h = s.hadith;
  if (!h) return null;
  const surface = desktop ? 'bg-background' : 'bg-surface shadow-lesson-ayah-card';
  if (s.beat === 'speaking' && s.captionId === 'hadith.topic') {
    return (
      <div
        className={cx(
          'flex animate-[gh-swap_.45s_ease-out_both] flex-col items-center gap-[14px] rounded-px-32 border-[1.5px] border-border px-[20px] py-[32px]',
          surface,
        )}
      >
        <span
          className="flex h-[68px] w-[68px] items-center justify-center rounded-px-22 bg-berry-tint"
          aria-hidden="true"
        >
          <HadithGlyph size={34} />
        </span>
        <p className="m-0 text-center font-heading text-[28px] font-bold text-text-dark">{h.title}</p>
        <span className="rounded-pill bg-berry-tint px-[14px] py-[7px] text-[12.5px] font-extrabold text-berry-deep">
          من كلام النبي ﷺ
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={actions.replayAyah}
      aria-label="أعد سماع الحديث"
      className={cx(
        'relative flex w-full animate-[gh-swap_.45s_ease-out_both] cursor-pointer flex-col items-center gap-[12px] rounded-px-32 px-[18px] pt-[24px] pb-[20px] font-body text-text-dark',
        surface,
        s.beat === 'reciting' ? 'border-[2px] border-primary' : 'border-[1.5px] border-border',
      )}
    >
      <span className="rounded-pill bg-berry-tint px-[13px] py-[6px] text-[12px] font-extrabold text-berry-deep">
        حديث شريف
      </span>
      <span className="flex min-h-[100px] items-center justify-center text-center">
        {h.isApproved ? (
          // An approved, vetted hadith (content/hadith, approved: true) between « ».
          <span className="font-classical text-[24px] leading-[1.9]">«{h.displayText}»</span>
        ) : (
          // Never written by hand or by the AI — the marked placeholder until approved.
          <span className="block rounded-px-18 border-[1.5px] border-dashed border-avatar-cream bg-hadith-placeholder-bg p-[14px] text-[15px] leading-[1.85] font-bold text-warning-text">
            {h.displayText}
          </span>
        )}
      </span>
      <span className="text-[13px] font-bold text-text-subtle">{h.displayTakhrij}</span>
      {s.playbackBlocked && <PlayFallback onTap={actions.play} />}
    </button>
  );
}

const ProjectArt = ({ size }: { size: number }) => (
  <span className="animate-[gh-float-3_3.2s_ease-in-out_infinite]" aria-hidden="true">
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
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
);

function ProjectAssign({ state: s }: { state: LessonState }) {
  const p = s.project;
  if (!p) return null;
  return (
    <div className="flex shrink-0 flex-col gap-[9px] pt-[13px]">
      <div className="relative flex animate-[gh-pop-2_.5s_ease-out_both] flex-col items-center gap-[10px] rounded-px-28 border-[2px] border-gold-border bg-gold-tint px-[18px] pt-[22px] pb-[18px]">
        <span className="absolute -top-[13px] right-[24px] rounded-pill bg-gold px-[14px] py-[6px] text-[12px] font-extrabold text-on-gold">
          مشروع هذا الأسبوع
        </span>
        <ProjectArt size={62} />
        <p className="m-0 text-center font-heading text-[24px] leading-[1.55] font-bold text-on-gold">
          {p.title}
        </p>
        {s.lineIndex >= 1 && (
          <ol className="m-0 flex w-full list-none flex-col gap-[7px] p-0">
            {p.hints.map((h, i) => {
              const last = i === p.hints.length - 1;
              return (
                <li
                  key={h}
                  className={cx(
                    'flex items-center gap-[11px] rounded-px-18 bg-surface px-[13px] py-[11px] shadow-lesson-step-row',
                    last && 'border-[1.5px] border-gold-border',
                  )}
                  style={{ animation: `gh-rise-2 .4s ease-out ${0.05 + i * 0.15}s both` }}
                >
                  <span
                    className={cx(
                      'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-heading text-[15px] font-extrabold',
                      last ? 'bg-gold-tint text-warning-text' : 'bg-green-tint text-deep-green',
                    )}
                  >
                    {toArabicDigits(i + 1)}
                  </span>
                  <span className={cx('text-[14.5px] font-bold', last && 'text-warning-text')}>{h}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function ProjectReport({ state: s, actions }: { state: LessonState; actions: LessonActions }) {
  const recording = s.beat === 'recording';
  const saved = s.beat === 'recorded' || (s.beat === 'advancing' && s.recordedDurationMs !== null);
  return (
    <div className="flex min-h-[250px] shrink-0 flex-col justify-center gap-[9px] pt-[13px]">
      <div
        className={cx(
          'relative flex animate-[gh-pop-2_.5s_ease-out_both] flex-col items-center gap-[10px] rounded-px-28 bg-surface px-[18px] pt-[22px] pb-[18px] shadow-lesson-report-card',
          recording
            ? 'border-[2px] border-gold'
            : saved
              ? 'border-[2px] border-primary'
              : 'border-[1.5px] border-border',
        )}
      >
        <span className="absolute -top-[13px] right-[24px] rounded-pill border border-gold-border bg-gold-tint px-[14px] py-[6px] text-[12px] font-extrabold text-warning-text">
          مشروع الأمس
        </span>
        <ProjectArt size={58} />
        <p className="m-0 text-center font-heading text-[23px] leading-[1.55] font-bold text-text-dark">
          {s.project?.title ?? ''}
        </p>
        {recording && (
          <span className="flex animate-[gh-pop-2_.4s_ease-out_both] items-center gap-[8px] rounded-pill bg-berry-tint px-[15px] py-[8px]">
            <span className="h-[9px] w-[9px] animate-[gh-blink_1.1s_ease-in-out_infinite] rounded-full bg-berry" />
            <span className="text-[13px] font-extrabold text-berry-deep">
              جارٍ التسجيل · {shortClock(s.recordingElapsedMs)}
            </span>
          </span>
        )}
        {saved && (
          <span className="flex animate-[gh-pop-2_.4s_ease-out_both] items-center gap-[8px] rounded-pill bg-green-tint px-[15px] py-[8px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12.5 L10 17.5 L19 7"
                stroke={C.deepGreen}
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[13px] font-extrabold text-deep-green">
              حُفظ صوتك · {shortClock(s.recordedDurationMs ?? 0)}
            </span>
          </span>
        )}
      </div>
      {saved && (
        <div className="flex animate-[gh-rise-2_.4s_ease-out_both] flex-col gap-[8px]">
          <span className="text-center text-[12.5px] leading-[1.7] font-bold text-text-muted">
            يصل إلى لوحة والدك — لا يُنشر لأحد غيره.
          </span>
          <button
            type="button"
            onClick={actions.reRecord}
            disabled={s.beat !== 'recorded'}
            className="flex h-[48px] cursor-pointer items-center justify-center gap-[8px] rounded-px-16 border-[1.5px] border-input-border bg-surface font-body text-[14px] font-bold text-text-muted disabled:cursor-default disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4.5 12 A7.5 7.5 0 1 1 7.4 17.9"
                stroke={C.textMuted}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M4.5 7 V12 H9.5"
                stroke={C.textMuted}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            أعِد التسجيل
          </button>
        </div>
      )}
    </div>
  );
}

function LessonEnd({ glance }: { glance: ChildGlance }) {
  const days = glance.streakDays.length ? glance.streakDays : ['اليوم'];
  const n = glance.streak;
  return (
    <>
      <h1 className="m-0 shrink-0 animate-[gh-pop-3_.55s_ease-out_.1s_both] text-center font-heading text-[28px] leading-[1.5] font-bold text-deep-green">
        أكملت حصة اليوم!
      </h1>
      <div className="relative flex shrink-0 animate-[gh-rise_.45s_ease-out_.35s_both] items-center gap-[14px] rounded-px-26 bg-surface p-[16px] shadow-lesson-done-card">
        <Sparkle
          size={17}
          color={C.gold}
          className="top-[6px] left-[64px] animate-[gh-spark_1.8s_ease-in-out_.2s_infinite]"
        />
        <span className="shrink-0 animate-[gh-float_3s_ease-in-out_infinite]" aria-hidden="true">
          <svg width="92" height="92" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="46" fill={C.greenTint} />
            <path d="M50 84 V40" stroke={C.deepGreen} strokeWidth="6.5" strokeLinecap="round" />
            <path d="M50 62 C34 62 24 53 24 38 C40 38 50 47 50 62 Z" fill={C.primary} />
            <path d="M50 54 C66 54 76 45 76 30 C60 30 50 39 50 54 Z" fill={C.softGreen} />
            <g
              className="animate-[gh-grow-up_.8s_ease-out_.5s_both]"
              style={{ transformOrigin: '50px 30px' }}
            >
              <circle cx="50" cy="26" r="13" fill={C.primary} />
              <circle cx="38" cy="34" r="8" fill={C.leafLight} />
              <circle cx="62" cy="34" r="8" fill={C.leafLight} />
              <circle cx="44" cy="21" r="3.6" fill={C.gold} />
              <circle cx="58" cy="30" r="3" fill={C.gold} />
            </g>
            <circle cx="50" cy="86" r="5" fill={C.gold} />
          </svg>
        </span>
        <div className="flex min-w-0 grow flex-col gap-[9px]">
          <span className="flex items-center gap-[9px]">
            <span
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-green-tint"
              aria-hidden="true"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12.5 L10 17.5 L19 7"
                  stroke={C.deepGreen}
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="font-heading text-[20px] font-bold text-deep-green">أكملت درس اليوم</span>
          </span>
          <span className="self-start rounded-pill bg-green-tint px-[14px] py-[7px] text-[12.5px] font-extrabold text-deep-green">
            غرستك كبرت خطوة
          </span>
        </div>
      </div>
      <div className="flex shrink-0 animate-[gh-rise_.45s_ease-out_.6s_both] flex-col gap-[12px] rounded-px-26 bg-surface px-[16px] py-[15px] shadow-lesson-done-card">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-extrabold">أيامك المتتالية</span>
          <span className="rounded-pill bg-gold-tint px-[12px] py-[6px] text-[12.5px] font-extrabold text-warning-text">
            {toArabicDigits(n)} {n >= 3 && n <= 10 ? 'أيام' : 'يوم'}
          </span>
        </div>
        <div className="flex gap-[7px]">
          {days.map((d, i) => {
            const today = i === days.length - 1;
            return (
              <span
                key={`${d}-${i}`}
                className={cx(
                  'flex h-[34px] grow basis-0 items-center justify-center rounded-px-12 text-[12px] font-extrabold',
                  today
                    ? 'animate-[gh-pop-3_.5s_ease-out_1.1s_both] bg-gold text-on-gold'
                    : 'bg-green-tint text-deep-green',
                )}
              >
                {d}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Bottom: the one persistent mic control + hint ─────────────────────────────

const BARS = [9, 14, 7, 16, 11, 18, 6, 13, 17, 8, 15, 10, 18, 7, 14, 9, 16, 11, 6, 13, 8];

function VoiceBars({ active, level, height }: { active: boolean; level: LevelSource; height: number }) {
  const lvl = useSyncExternalStore(
    level.subscribe,
    () => level.value,
    () => 0,
  );
  return (
    <div
      className="flex items-center justify-center gap-[3px]"
      style={{ height, transform: active ? `scaleY(${0.55 + 0.45 * lvl})` : undefined }}
      aria-hidden="true"
    >
      {BARS.map((h, i) => (
        <span
          key={i}
          className={cx('w-[3px] shrink-0 rounded-px-2', active ? 'bg-deep-green' : 'bg-voice-bar-off')}
          style={{
            height: active ? h : 4,
            animation: active ? `gh-wave .8s ease-in-out ${(i * 0.05).toFixed(2)}s infinite` : 'none',
          }}
        />
      ))}
    </div>
  );
}

const MicGlyph = ({
  size,
  ink,
  slash,
  filled,
}: {
  size: number;
  ink: string;
  slash?: boolean;
  filled?: boolean;
}) => (
  <svg className="relative" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {filled ? (
      <rect x="9" y="3" width="6" height="11" rx="3" fill={ink} />
    ) : (
      <rect x="9" y="3" width="6" height="11" rx="3" stroke={ink} strokeWidth="2" />
    )}
    <path
      d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
      stroke={ink}
      strokeWidth={filled ? 2.2 : 2}
      strokeLinecap="round"
    />
    {slash && <path d="M4.2 19.8 L19.8 4.2" stroke={C.berryDeep} strokeWidth="2.4" strokeLinecap="round" />}
  </svg>
);

const Arrow = ({ size }: { size: number }) => (
  <svg className="relative" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15 5 L8 12 L15 19"
      stroke={C.surface}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Bottom({
  state: s,
  actions,
  level,
  desktop,
}: {
  state: LessonState;
  actions: LessonActions;
  level: LevelSource;
  desktop: boolean;
}) {
  const end = s.screen === 'lessonEnd';
  const size = desktop ? 124 : end ? 112 : 118;
  const glyph = desktop ? 52 : end ? 48 : 50;
  const bars = end ? 16 : 18;
  const circle = 'relative flex shrink-0 items-center justify-center rounded-full';
  const dims = { width: size, height: size };
  const pulse = (cls: string) => <span className={cx('absolute rounded-full', cls)} style={dims} />;

  let control: React.ReactNode;
  let voice = false;
  const live = isMicLive(s) || s.beat === 'recording';
  if (live) {
    voice = s.beat === 'listening' || s.beat === 'hearingAnswer' || s.beat === 'recording';
    const label =
      s.beat === 'recording'
        ? 'أنهيت كلامي'
        : s.beat === 'hearingAnswer' && s.screen === 'intro'
          ? 'قلت نعم'
          : 'كتم الميكروفون';
    control = (
      <button
        type="button"
        onClick={actions.micTap}
        aria-label={label}
        className={cx(circle, 'cursor-pointer border-0 bg-gold shadow-lesson-mic-live')}
        style={dims}
      >
        {pulse('animate-[gh-glow-2_1.5s_ease-out_infinite] bg-mic-pulse')}
        <MicGlyph size={glyph} ink={C.surface} filled />
      </button>
    );
  } else if (s.beat === 'praising') {
    control = (
      <span
        className={cx(
          circle,
          'border-[2px] border-input-border bg-surface opacity-45 shadow-lesson-mic-idle',
        )}
        style={dims}
        aria-hidden="true"
      >
        <MicGlyph size={glyph} ink={C.textMuted} slash />
      </span>
    );
  } else if (s.beat === 'awaitContinue') {
    control = (
      <button
        type="button"
        onClick={actions.continueTapped}
        aria-label="تابع بعد إتمام السورة"
        className={cx(circle, 'cursor-pointer border-0 bg-gold shadow-lesson-mic-live')}
        style={dims}
      >
        {pulse('animate-[gh-glow-2_1.5s_ease-out_infinite] bg-mic-pulse')}
        <Arrow size={48} />
      </button>
    );
  } else if (s.beat === 'advancing' || s.beat === 'recorded') {
    const label =
      s.screen === 'projectReport'
        ? 'ابدأ حديث اليوم'
        : s.screen === 'surahDone'
          ? 'هيا إلى الحديث'
          : s.screen === 'hadith'
            ? 'تابع إلى مشروع الأسبوع'
            : 'تابع';
    control = (
      <button
        type="button"
        onClick={actions.continueTapped}
        aria-label={label}
        className={cx(circle, 'cursor-pointer border-0 bg-deep-green shadow-lesson-go-next')}
        style={dims}
      >
        {pulse('animate-[gh-glow-2_1.5s_ease-out_infinite] bg-go-pulse')}
        <Arrow size={48} />
      </button>
    );
  } else {
    // awaitMic / speaking / reciting / done — the closed mic (slashed).
    const awaiting = s.beat === 'awaitMic';
    const prompt = awaiting && s.screen !== 'intro';
    const dim =
      s.beat === 'reciting' || ((s.beat === 'speaking' || s.beat === 'done') && s.screen !== 'intro');
    const label = awaiting
      ? s.screen === 'projectReport'
        ? 'افتح الميكروفون واحكِ للمعلّم'
        : s.screen === 'ayah' || s.screen === 'hadith'
          ? 'افتح الميكروفون وابدأ الترديد'
          : 'افتح الميكروفون وأجب بصوتك'
      : 'الميكروفون';
    control = (
      <span className={circle} style={dims}>
        {(prompt || (awaiting && desktop)) &&
          pulse('animate-[gh-glow-2_1.5s_ease-out_infinite] bg-mic-prompt-pulse')}
        <button
          type="button"
          onClick={actions.micTap}
          disabled={!awaiting}
          aria-label={label}
          className={cx(
            circle,
            'cursor-pointer border-[2px] bg-surface shadow-lesson-mic-closed disabled:cursor-default',
            prompt ? 'border-gold' : 'border-input-border',
            dim && 'opacity-50',
          )}
          style={dims}
        >
          <MicGlyph size={glyph} ink={prompt ? C.textDark : C.textMuted} slash />
        </button>
      </span>
    );
  }

  const hint = hintFor(s);
  const warm =
    live ||
    s.beat === 'hearingAnswer' ||
    (s.beat === 'awaitMic' && s.screen !== 'intro') ||
    (s.beat === 'awaitMic' && s.screen === 'intro');
  return (
    <div className={cx('mt-auto flex shrink-0 flex-col items-center', end ? 'gap-[7px]' : 'gap-[10px]')}>
      <div className="flex flex-col items-center gap-[8px]">
        {control}
        {live ? <VoiceBars active={voice} level={level} height={bars} /> : <span style={{ height: bars }} />}
      </div>
      <span
        className={cx('text-center text-[12.5px] font-bold', warm ? 'text-warning-text' : 'text-text-muted')}
        style={{ minHeight: end ? 17 : 18 }}
      >
        {hint}
      </span>
      {end && (
        <button
          type="button"
          onClick={actions.goHome}
          className="flex h-[64px] w-full cursor-pointer items-center justify-center gap-[10px] rounded-px-22 border-0 bg-deep-green font-heading text-[20px] font-bold text-surface shadow-lesson-home-button"
        >
          عودة للرئيسية
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 11 L12 4.5 L20 11 V19 C20 19.6 19.6 20 19 20 H5 C4.4 20 4 19.6 4 19 Z"
              stroke={C.surface}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function hintFor(s: LessonState): string {
  const question =
    !!s.captionId &&
    (s.captionId.endsWith('ask') || s.captionId === 'intro.ready' || s.captionId === 'surah.next_hadith');
  switch (s.screen) {
    case 'intro':
      return s.beat === 'speaking'
        ? 'اضغط المعلّم ليكمل'
        : s.beat === 'awaitMic'
          ? 'أجب بصوتك: اضغط الميكروفون'
          : s.beat === 'hearingAnswer'
            ? 'قل: نعم'
            : '';
    case 'ayah':
    case 'hadith':
      if (s.beat === 'reciting') return s.screen === 'ayah' ? 'الترديد يبدأ بعد التلاوة' : '';
      return (
        (
          {
            speaking: 'اضغط المعلّم ليكمل',
            awaitMic: 'اضغط الميكروفون مرة واحدة ويبقى مفتوحًا',
            listening: 'الميكروفون مفتوح — لا تضغط شيئًا',
            counted: 'الميكروفون ما زال مفتوحًا',
            nudging: 'الميكروفون ما زال مفتوحًا',
            awaitContinue: 'اضغط لتكمل مع المعلّم',
            advancing: 'ننتقل…',
          } as Partial<Record<LessonState['beat'], string>>
        )[s.beat] ?? ''
      );
    case 'surahDone':
      return s.beat === 'awaitMic' && question
        ? 'أجب بصوتك: اضغط الميكروفون'
        : s.beat === 'hearingAnswer'
          ? 'قل: نعم'
          : s.beat === 'advancing'
            ? 'ننتقل الآن…'
            : '';
    case 'projectAssign':
      return s.beat === 'awaitMic'
        ? 'أجب بصوتك: اضغط الميكروفون'
        : s.beat === 'hearingAnswer'
          ? 'قل: إن شاء الله'
          : s.beat === 'advancing'
            ? 'ننهي حصتنا…'
            : '';
    case 'projectReport':
      return (
        (
          {
            awaitMic: 'اضغط الميكروفون واحكِ بصوتك',
            recording: 'اضغط مرة أخرى حين تنتهي',
            recorded: 'أو أعد التسجيل إن أحببت',
            advancing: 'ننتقل للحديث…',
          } as Partial<Record<LessonState['beat'], string>>
        )[s.beat] ?? ''
      );
    case 'lessonEnd':
      return s.beat === 'awaitMic'
        ? 'أجب بصوتك: اضغط الميكروفون'
        : s.beat === 'hearingAnswer'
          ? 'قل: أبشر'
          : s.beat === 'done'
            ? 'إلى اللقاء غدًا'
            : '';
    default:
      return '';
  }
}
