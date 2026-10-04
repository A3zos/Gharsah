import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Navigate, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';

import { paths } from '../../app/paths';
import { useChildData } from '../../components/child/ChildData';
import { useChildTitle } from '../../components/child/useChildTitle';
import {
  LessonView,
  ReadyingCall,
  type ChildGlance,
  type LessonActions,
  type LessonPlanInfo,
} from '../../components/lesson/LessonView';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { C } from '../../components/ui/color';
import { Note } from '../../components/ui/Note';
import { hadithRepo, hadithStepIndex, lessonScripts, quranMeta } from '../../content/library';
import { pilotDay } from '../../content/pilot';
import { WEEK_DAYS, type ChildProfile, type WeekDay } from '../../data/children';
import { pickTodayLesson, progressFromRow, surahDoneToday } from '../../data/student';
import type { LessonScript } from '../../lesson/script';
import { initialLessonState, type LessonProgress, type LessonState } from '../../lesson/state';
import { PreviewProgressSink } from '../../dev/childPreview';
import { agentBaseUrl, SPEAK_WARM_TIMEOUT_MS } from '../../lesson/server/api';
import { preloadTeacher } from '../../components/child/teacherCharacter';
import { getTeacher } from '../../content/teachers';
import { unlockLessonAudio } from '../../lesson/web/audioUnlock';
import { createWebLesson, type WebLesson } from '../../lesson/web/createLesson';
import { fill, MESSAGES, useI18n, type Messages, type UiLanguage } from '../../i18n/i18n';
import { hadithCopyIn, surahNameIn } from '../../lesson/teacherLines';
import { DESKTOP, useMedia } from '../../lib/useMedia';
import { ServerLessonCall } from '../../components/lesson/ServerLessonCall';
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
function glanceOf(
  c: ChildProfile | null | undefined,
  words: { today: string; weekdays: Record<WeekDay, string> },
  now = new Date(),
): ChildGlance {
  const stats = (c?.stats ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const streak = num(stats.streak);
  const days = new Set<WeekDay>(c?.schedule?.days ?? []);
  const labels = [words.today];
  const d = new Date(now);
  const want = Math.min(Math.max(streak, 1), 5);
  for (let i = 0; i < 14 && labels.length < want; i++) {
    d.setDate(d.getDate() - 1);
    const w = WEEK_DAYS[(d.getDay() + 1) % 7]!; // JS Sun=0 → index 1 (sat=0)
    if (days.has(w.id)) labels.unshift(words.weekdays[w.id]);
  }
  return { surahsTotal: num(stats.surahs), streak, streakDays: labels };
}

/** ExitConfirm «مكانك المحفوظ». */
function placeOf(s: LessonState, lang: UiLanguage, m: Messages): string {
  const p = m.lesson.place;
  const name = surahNameIn(lang, s.surahName ?? '');
  switch (s.screen) {
    case 'ayah':
      return fill(lang, p.ayah, { name, n: s.ayahRef?.ayah ?? 1, total: s.surahAyahCount ?? 0 });
    case 'surahDone':
      return fill(lang, p.surahDone, { name });
    case 'hadith':
      return s.hadith ? hadithCopyIn(lang, s.hadith).title : p.hadith;
    case 'projectAssign':
      return p.project;
    case 'projectReport':
      return p.report;
    case 'lessonEnd':
      return p.end;
    default:
      return s.surahName ? fill(lang, p.startSurah, { name }) : p.start;
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
  // DEV only: ?resetLesson=1 ignores today's saved part progress (start from the surah).
  const [params] = useSearchParams();
  const resetLesson = import.meta.env.DEV && params.get('resetLesson') === '1';
  // the tab title in the chosen language (the route meta keeps the Arabic one)
  useChildTitle(useI18n().m.lesson.meta);
  // Decided once on entry: the call keeps running when its own checkpoints
  // later mark the lesson completed (L10 must still show).
  const [entry, setEntry] = useState<{ lessonId: string; resume: LessonProgress | null } | 'denied' | null>(
    null,
  );
  // VITE_AI_AGENT=1: the AI server runs the lesson; any failure → today's built-in lesson
  // (from the hadith when the AI already finished today's surah).
  const [builtIn, setBuiltIn] = useState<false | { resume: LessonProgress | null }>(false);
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
  const agentUrl = agentBaseUrl();
  const day = pilotDay(lessonId);
  // The day plan runs in order — surah, then hadith. The surah is skipped only when it
  // was really finished earlier TODAY; older saved progress starts at the surah again.
  const hadithIdx = hadithStepIndex(script);
  const surahDone = !resetLesson && surahDoneToday(progress?.get(lessonId), hadithIdx);
  const entryResume =
    resetLesson || (entry.resume && entry.resume.stepIndex >= hadithIdx && !surahDone) ? null : entry.resume;
  if (agentUrl && day && !builtIn && session.childId !== 'preview') {
    const hIdx = hadithStepIndex(script);
    return (
      <ServerLessonCall
        key={lessonId}
        baseUrl={agentUrl}
        plan={{
          lessonId,
          surahNo: day.surah,
          surahName: day.surahName,
          hadithTopic: day.hadithTopic,
          hadithStepIndex: hIdx,
          lastStepIndex: script.steps.length - 1,
          quranStages: day.quranStages,
        }}
        child={child}
        session={session}
        startAt={surahDone ? 'hadith' : 'quran'}
        onFallback={(quranDone) =>
          setBuiltIn({
            resume: quranDone
              ? progressFromRow(lessonId, {
                  stage: 'hadith',
                  step_index: hIdx,
                  done_refs: Array.from(
                    { length: quranMeta.ayahCount(day.surah) },
                    (_, i) => `${day.surah}:${i + 1}`,
                  ),
                })
              : entryResume,
          })
        }
      />
    );
  }
  const resume = builtIn ? builtIn.resume : entryResume;
  return <LessonCall key={lessonId} script={script} child={child} session={session} resume={resume} />;
}

function Busy() {
  const { m } = useI18n();
  return <main className="min-h-dvh bg-background" aria-busy="true" aria-label={m.lesson.busy} />;
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
  const { lang, m } = useI18n();
  // The teacher's language is read once per call (switching mid-call never restarts it).
  const langRef = useRef(lang);
  const navigate = useNavigate();
  const desktop = useMedia(DESKTOP);
  const [attempt, setAttempt] = useState(0);
  const [lesson, setLesson] = useState<WebLesson | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const leaving = useRef(false);
  const firstName = child.name.trim().split(/\s+/)[0] ?? child.name;
  // The resume point is read once per call (later checkpoints must not restart it).
  const resumeRef = useRef(resume);
  const gender = child.gender;
  // The teacher (UI language + gender) is locked for the call: a language change applies
  // from the next lesson. Its frames are preloaded before the call starts; a 404 → the
  // Arabic teacher of the same gender.
  const [lockedTeacher] = useState(() => getTeacher(lang, gender));
  const [teacher, setTeacher] = useState(lockedTeacher);
  const [readyFor, setReadyFor] = useState<number | null>(null);

  useEffect(() => {
    const l = createWebLesson({
      script,
      session: { parentUid: session.parentUid, childId: session.childId },
      childFirstName: firstName,
      progressFrom: resumeRef.current ?? undefined,
      // DEV-only preview: progress stays in memory, the report is never uploaded.
      sink: import.meta.env.DEV && session.childId === 'preview' ? new PreviewProgressSink() : undefined,
      lang: langRef.current,
      gender,
      verifyBusyMessage: MESSAGES[langRef.current].lesson.project.busy,
    });
    setLesson(l);
    // «المعلم يتجهز…» first: the server voice (≤ ~45 s) and the character's frames —
    // never the browser voice or the old SVG while they are still coming.
    let disposed = false;
    const timeout = new Promise((r) => setTimeout(r, SPEAK_WARM_TIMEOUT_MS));
    const frames = preloadTeacher(lockedTeacher).then((t) => {
      if (!disposed) setTeacher(t);
    });
    void Promise.race([Promise.all([l.voiceReady(), frames]), timeout]).then(() => {
      if (disposed) return;
      setReadyFor(attempt);
      void l.agent.start(l.progressFrom);
    });
    const onVis = () => l.agent.setForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVis);
      void l.dispose();
    };
  }, [script, session.parentUid, session.childId, firstName, attempt, gender, lockedTeacher]);
  const readying = readyFor !== attempt;

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
      micTap: () => {
        unlockLessonAudio(); // «سماح» is a tap: it also unlocks the sound
        agent?.micTap();
      },
      continueTapped: () => agent?.continueTapped(),
      replayAyah: () => agent?.replayAyah(),
      play: () => {
        unlockLessonAudio();
        agent?.play();
      },
      reRecord: () => agent?.reRecord(),
      retryVerify: () => agent?.retryVerify(),
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
  const glance = glanceOf(child, { today: m.lesson.end.today, weekdays: m.lesson.weekdays });

  if (agent && readying)
    return <ReadyingCall gender={gender} teacher={teacher} desktop={desktop} onExit={goHome} />;
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
        gender={child.gender}
        teacher={teacher}
        mouth={lesson?.mouth}
      />
      <ConfirmSheet
        open={sheetOpen}
        title={m.lesson.exit.title}
        body={m.lesson.exit.body}
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
        confirmLabel={m.lesson.exit.confirm}
        cancelLabel={m.lesson.exit.cancel}
        footnote={m.lesson.exit.footnote}
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
            <span className="text-[12.5px] font-bold text-text-muted">{m.lesson.exit.placeLabel}</span>
            <span className="text-[15px] font-extrabold">{placeOf(state, lang, m)}</span>
          </span>
          <span className="rounded-pill bg-green-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-deep-green">
            {m.lesson.exit.saved}
          </span>
        </div>
      </ConfirmSheet>
    </>
  );
}

/** TODO(design): Tier 3 SOffline — the lesson audio couldn't be prepared. Retry + back to the child home. */
function Failed({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  const { m } = useI18n();
  return (
    <main className="flex min-h-dvh justify-center bg-background px-[20px] py-[40px]">
      <div className="flex w-full max-w-[520px] flex-col justify-center gap-[16px]">
        <Note tone="gold" className="text-[14px] leading-[1.8] font-bold">
          <span role="alert">{m.lesson.failed.text}</span>
        </Note>
        <button
          type="button"
          onClick={onRetry}
          className="flex h-[60px] cursor-pointer items-center justify-center rounded-px-20 border-0 bg-deep-green font-heading text-[19px] font-bold text-surface"
        >
          {m.lesson.failed.retry}
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex h-[54px] cursor-pointer items-center justify-center rounded-px-20 border-[1.5px] border-input-border bg-surface text-[15.5px] font-extrabold text-text-muted"
        >
          {m.lesson.failed.home}
        </button>
      </div>
    </main>
  );
}
