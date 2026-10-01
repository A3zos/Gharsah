import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router';

import { paths } from '../../app/paths';
import { useChildData } from '../../components/child/ChildData';
import {
  LessonView,
  type ChildGlance,
  type LessonActions,
  type LessonPlanInfo,
} from '../../components/lesson/LessonView';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { C } from '../../components/ui/color';
import { Note } from '../../components/ui/Note';
import { hadithRepo, lessonScripts, quranMeta } from '../../content/library';
import { WEEK_DAYS, type ChildProfile, type WeekDay } from '../../data/children';
import { pickTodayLesson } from '../../data/student';
import type { LessonScript } from '../../lesson/script';
import { initialLessonState, type LessonProgress, type LessonState } from '../../lesson/state';
import { PreviewProgressSink } from '../../dev/childPreview';
import { createWebLesson, type WebLesson } from '../../lesson/web/createLesson';
import { toArabicDigits } from '../../lib/arabicDigits';
import { DESKTOP, useMedia } from '../../lib/useMedia';
import type { Route } from './+types/lesson';

export const meta: Route.MetaFunction = () => [{ title: 'الحصة — غَرْسة' }];

function planOf(script: LessonScript): LessonPlanInfo {
  let surah: number | undefined;
  let hadithTitle: string | undefined;
  let hasProject = false;
  for (const s of script.steps) {
    if (s.type === 'intro' || s.type === 'ayah_loop') surah ??= s.type === 'intro' ? s.surah : s.ref.surah;
    if (s.type === 'hadith_loop') hadithTitle ??= hadithRepo.byId(s.hadithId).title;
    if (s.type === 'project_assign') hasProject = true;
  }
  return {
    surahName: surah ? quranMeta.surahName(surah) : undefined,
    surahAyat: surah ? quranMeta.ayahCount(surah) : undefined,
    hadithTitle,
    hasProject,
  };
}

/** The child's totals for L6/L10 — the streak's last scheduled days, ending «اليوم». */
function glanceOf(c: ChildProfile | null | undefined, now = new Date()): ChildGlance {
  const stats = (c?.stats ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const streak = num(stats.streak);
  const days = new Set<WeekDay>(c?.schedule?.days ?? []);
  const labels = ['اليوم'];
  const d = new Date(now);
  const want = Math.min(Math.max(streak, 1), 5);
  for (let i = 0; i < 14 && labels.length < want; i++) {
    d.setDate(d.getDate() - 1);
    const w = WEEK_DAYS[(d.getDay() + 1) % 7]!; // JS Sun=0 → index 1 (sat=0)
    if (days.has(w.id)) labels.unshift(w.short);
  }
  return { surahsTotal: num(stats.surahs), streak, streakDays: labels };
}

/** ExitConfirm «مكانك المحفوظ». */
function placeOf(s: LessonState): string {
  switch (s.screen) {
    case 'ayah':
      return `سورة ${s.surahName ?? ''} — الآية ${toArabicDigits(s.ayahRef?.ayah ?? 1)} من ${toArabicDigits(s.surahAyahCount ?? 0)}`;
    case 'surahDone':
      return `أتممت سورة ${s.surahName ?? ''}`;
    case 'hadith':
      return s.hadith?.title ?? 'حديث اليوم';
    case 'projectAssign':
      return 'مشروع الأسبوع';
    case 'projectReport':
      return 'تقرير مشروع الأمس';
    case 'lessonEnd':
      return 'نهاية الحصة';
    default:
      return s.surahName ? `بداية الحصة — سورة ${s.surahName}` : 'بداية الحصة';
  }
}

/**
 * design/v3 L1Intro → L10Done + ExitConfirm (+ LessonDesktop ≥1024). The
 * LessonAgent (src/lesson, tested) is the only brain; this route wires it to the
 * browser (speech, mic, reciter, Firestore/Storage) and to navigation: ✕ and the
 * browser back both open ExitConfirm; «خروج» saves the checkpoint → child home.
 */
export default function LessonRoute() {
  const { lessonId = '' } = useParams();
  const { child, progress, session } = useChildData();
  // Decided once on entry: the call keeps running when its own checkpoints
  // later mark the lesson completed (L10 must still show).
  const [entry, setEntry] = useState<{ lessonId: string; resume: LessonProgress | null } | 'denied' | null>(
    null,
  );
  const script = lessonScripts.get(lessonId);
  const ready = child !== undefined && progress !== undefined;
  if (script && ready && child && (entry === null || (entry !== 'denied' && entry.lessonId !== lessonId))) {
    const today = pickTodayLesson(progress);
    // Only today's available lesson opens (a finished one waits for tomorrow).
    setEntry(
      today.kind === 'available' && today.lessonId === lessonId
        ? { lessonId, resume: today.resume }
        : 'denied',
    );
  }
  if (!script || entry === 'denied' || (ready && !child)) return <Navigate to={paths.child.home} replace />;
  if (!child || !entry || entry.lessonId !== lessonId) return <Busy />;
  return <LessonCall key={lessonId} script={script} child={child} session={session} resume={entry.resume} />;
}

function Busy() {
  return <main className="min-h-dvh bg-background" aria-busy="true" aria-label="جارٍ تجهيز الحصة" />;
}

function LessonCall({
  script,
  child,
  session,
  resume,
}: {
  script: LessonScript;
  child: ChildProfile;
  session: ReturnType<typeof useChildData>['session'];
  resume: LessonProgress | null;
}) {
  const navigate = useNavigate();
  const desktop = useMedia(DESKTOP);
  const [attempt, setAttempt] = useState(0);
  const [lesson, setLesson] = useState<WebLesson | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const leaving = useRef(false);
  const firstName = child.name.trim().split(/\s+/)[0] ?? child.name;
  // The resume point is read once per call (later checkpoints must not restart it).
  const resumeRef = useRef(resume);

  useEffect(() => {
    const l = createWebLesson({
      script,
      session: { parentUid: session.parentUid, childId: session.childId },
      childFirstName: firstName,
      progressFrom: resumeRef.current ?? undefined,
      // DEV-only preview: progress stays in memory, the report is never uploaded.
      sink: import.meta.env.DEV && session.childId === 'preview' ? new PreviewProgressSink() : undefined,
    });
    setLesson(l);
    void l.agent.start(l.progressFrom);
    const onVis = () => l.agent.setForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void l.dispose();
    };
  }, [script, session.parentUid, session.childId, firstName, attempt]);

  const agent = lesson?.agent;
  const voiceMissing = useSyncExternalStore(
    useCallback((cb: () => void) => (lesson ? lesson.voiceMissing.subscribe(cb) : () => {}), [lesson]),
    () => lesson?.voiceMissing.value ?? false,
    () => false,
  );
  const subscribe = useCallback((cb: () => void) => (agent ? agent.state.subscribe(cb) : () => {}), [agent]);
  const state = useSyncExternalStore(
    subscribe,
    () => agent?.state.value ?? initialLessonState,
    () => initialLessonState,
  );

  const goHome = useCallback(() => {
    leaving.current = true;
    navigate(paths.child.home, { replace: true });
  }, [navigate]);

  // The agent ended the call (✕ → خروج, or L10 «عودة للرئيسية») → child home.
  useEffect(() => {
    if (state.screen === 'ended') goHome();
  }, [state.screen, goHome]);

  // Browser back / any in-app navigation away = the ✕ (ExitConfirm first).
  const blocker = useBlocker(() => !leaving.current && state.screen !== 'failed');
  const blocked = blocker.state === 'blocked';
  useEffect(() => {
    if (blocked) agent?.pause();
  }, [blocked, agent]);
  const sheetOpen = exitOpen || blocked;
  const closeSheet = () => {
    setExitOpen(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const actions: LessonActions = useMemo(
    () => ({
      tapTeacher: () => agent?.tapTeacher(),
      micTap: () => agent?.micTap(),
      continueTapped: () => agent?.continueTapped(),
      replayAyah: () => agent?.replayAyah(),
      play: () => agent?.play(),
      reRecord: () => agent?.reRecord(),
      repeatTapped: () => agent?.repeatTapped(),
      exit: () => {
        agent?.pause();
        setExitOpen(true);
      },
      goHome: () => (agent ? void agent.endCall() : goHome()),
    }),
    [agent, goHome],
  );

  const plan = useMemo(() => planOf(script), [script]);
  const glance = glanceOf(child);

  if (!agent || state.screen === 'loading' || state.screen === 'ended') return <Busy />;
  if (state.screen === 'failed') {
    return (
      <Failed
        onRetry={() => {
          setLesson(null);
          setAttempt((a) => a + 1);
        }}
        onHome={goHome}
      />
    );
  }
  return (
    <>
      <LessonView
        state={state}
        plan={plan}
        glance={glance}
        actions={actions}
        level={agent.level}
        desktop={desktop}
        voiceMissing={voiceMissing}
      />
      <ConfirmSheet
        open={sheetOpen}
        title="تخرج من الحصة؟"
        body="نحفظ مكانك وتكمل بعدين من نفس النقطة."
        icon={
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M6.5 3.5 H17.5 C18.3 3.5 19 4.2 19 5 V20.5 L12 16.3 L5 20.5 V5 C5 4.2 5.7 3.5 6.5 3.5 Z"
              fill={C.gold}
            />
            <path
              d="M9 9.5 L11.3 11.8 L15.4 7.6"
              stroke={C.warningText}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        confirmLabel="أكمل الحصة"
        cancelLabel="خروج"
        footnote="لن تفقد أي تكرار أنجزته."
        onConfirm={() => {
          closeSheet();
          agent.resume();
        }}
        onDismiss={() => {
          closeSheet();
          agent.resume();
        }}
        onCancel={() => {
          leaving.current = true;
          closeSheet();
          void agent.endCall();
        }}
      >
        <div className="flex items-center gap-[12px] rounded-px-22 border-[1.5px] border-border bg-background px-[16px] py-[14px]">
          <span
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15 bg-green-tint"
            aria-hidden="true"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
                stroke={C.deepGreen}
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
              <path d="M12 5.8 V18.8" stroke={C.deepGreen} strokeWidth="1.9" />
            </svg>
          </span>
          <span className="flex min-w-0 grow flex-col gap-[4px]">
            <span className="text-[12.5px] font-bold text-text-muted">مكانك المحفوظ</span>
            <span className="text-[15px] font-extrabold">{placeOf(state)}</span>
          </span>
          <span className="rounded-pill bg-green-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-deep-green">
            محفوظ ✓
          </span>
        </div>
      </ConfirmSheet>
    </>
  );
}

/** TODO(design): Tier 3 SOffline — the lesson audio couldn't be prepared. Retry + back to the child home. */
function Failed({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  return (
    <main className="flex min-h-dvh justify-center bg-background px-[20px] py-[40px]">
      <div className="flex w-full max-w-[520px] flex-col justify-center gap-[16px]">
        <Note tone="gold" className="text-[14px] leading-[1.8] font-bold">
          <span role="alert">لا يوجد اتصال لتحميل الحصة — اتصل بالإنترنت ثم حاول مجددًا.</span>
        </Note>
        <button
          type="button"
          onClick={onRetry}
          className="flex h-[60px] cursor-pointer items-center justify-center rounded-px-20 border-0 bg-deep-green font-heading text-[19px] font-bold text-surface"
        >
          حاول مجددًا
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex h-[54px] cursor-pointer items-center justify-center rounded-px-20 border-[1.5px] border-input-border bg-surface text-[15.5px] font-extrabold text-text-muted"
        >
          عودة للرئيسية
        </button>
      </div>
    </main>
  );
}
