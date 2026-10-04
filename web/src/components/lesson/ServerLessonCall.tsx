// The lesson on the AI server (VITE_AI_AGENT=1): wires a ServerLesson to the
// browser and to navigation. ✕ and the browser back open ExitConfirm; «خروج» →
// child home. When the server can't run the lesson, `onFallback` hands over to
// today's built-in lesson so the child is never stuck.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useBlocker, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { aiLessonLanguage, useI18n } from '../../i18n/i18n';
import { getTeacher } from '../../content/teachers';
import { preloadTeacher } from '../child/teacherCharacter';
import type { ChildProfile } from '../../data/children';
import { unlockLessonAudio } from '../../lesson/web/audioUnlock';
import { createServerLesson, type WebServerLesson } from '../../lesson/web/createServerLesson';
import { initialServerState, type LessonPlan } from '../../lesson/server/serverLesson';
import { DESKTOP, useMedia } from '../../lib/useMedia';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { ServerLessonView, type ServerLessonActions } from './ServerLessonView';

export function ServerLessonCall({
  baseUrl,
  plan,
  child,
  session,
  startAt = 'quran',
  onFallback,
}: {
  baseUrl: string;
  plan: LessonPlan;
  /** The surah (default) or the hadith (today's surah finished earlier today). */
  startAt?: 'quran' | 'hadith';
  child: ChildProfile;
  session: { parentUid: string; childId: string };
  /** `quranDone`: today's surah part is finished → the built-in lesson resumes at the hadith. */
  onFallback: (quranDone: boolean) => void;
}) {
  const { m } = useI18n();
  const navigate = useNavigate();
  const desktop = useMedia(DESKTOP);
  const [web, setWeb] = useState<WebServerLesson | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const leaving = useRef(false);
  const planRef = useRef(plan);
  const { lang: uiLang } = useI18n();
  const aiLang = useRef(aiLessonLanguage(uiLang));
  // The teacher (UI language + gender) is locked for the call — a language change applies
  // from the next lesson; frames preloaded now, a 404 → the Arabic teacher of the same gender.
  const [lockedTeacher] = useState(() => getTeacher(uiLang, child.gender));
  const [teacher, setTeacher] = useState(lockedTeacher);
  useEffect(() => {
    let alive = true;
    void preloadTeacher(lockedTeacher).then((t) => alive && setTeacher(t));
    return () => {
      alive = false;
    };
  }, [lockedTeacher]);
  const startAtRef = useRef(startAt);
  // The first name goes in /agent/start; the full name scrubs the child's own words (read once).
  const childName = useRef(child.name);
  const fallbackRef = useRef(onFallback);
  useEffect(() => {
    fallbackRef.current = onFallback;
  }, [onFallback]);

  useEffect(() => {
    let alive = true;
    let made: WebServerLesson | null = null;
    const onVis = () => made?.lesson.setForeground(document.visibilityState === 'visible');
    void createServerLesson({
      baseUrl,
      plan: planRef.current,
      startAt: startAtRef.current,
      session: { parentUid: session.parentUid, childId: session.childId },
      gender: child.gender,
      childName: childName.current,
      // Arabic unless AI_LESSON_FOLLOWS_UI (i18n.ts) — read once
      lang: aiLang.current,
    }).then(
      (w) => {
        if (!alive) return w.dispose();
        made = w;
        setWeb(w);
        document.addEventListener('visibilitychange', onVis);
        w.lesson.start().catch((e: unknown) => {
          console.warn('[gharsah] AI lesson failed to start', e);
          if (alive) fallbackRef.current(false);
        });
      },
      () => alive && fallbackRef.current(false),
    );
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      made?.dispose();
    };
  }, [baseUrl, session.parentUid, session.childId, child.gender]);

  const lesson = web?.lesson;
  const subscribe = useCallback(
    (cb: () => void) => (lesson ? lesson.state.subscribe(cb) : () => {}),
    [lesson],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => lesson?.state.value ?? initialServerState,
    () => initialServerState,
  );

  const goHome = useCallback(() => {
    leaving.current = true;
    navigate(paths.child.home, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (state.phase === 'fallback') {
      // One engine at a time: the AI engine (requests, voice, reciter, mic) is torn down
      // completely BEFORE the built-in lesson is mounted.
      web?.dispose();
      // Kept for support: open the console, or sessionStorage «gharsah.aiFallback».
      try {
        sessionStorage.setItem(
          'gharsah.aiFallback',
          JSON.stringify({ at: new Date().toISOString(), reason: state.fallbackReason }),
        );
      } catch {
        // storage blocked — the console warning is still there
      }
      fallbackRef.current(state.quranDone);
    }
    if (state.phase === 'ended') goHome();
  }, [state.phase, state.quranDone, state.fallbackReason, goHome, web]);

  const blocker = useBlocker(() => !leaving.current && state.phase !== 'fallback');
  const blocked = blocker.state === 'blocked';
  useEffect(() => {
    if (blocked) lesson?.pause();
  }, [blocked, lesson]);
  const closeSheet = () => {
    setExitOpen(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const actions: ServerLessonActions = useMemo(
    () => ({
      allowTapped: () => {
        unlockLessonAudio(); // the tap also unlocks the sound
        lesson?.allowTapped();
      },
      exit: () => {
        lesson?.pause();
        setExitOpen(true);
      },
      goHome: () => {
        lesson?.end();
        goHome();
      },
    }),
    [lesson, goHome],
  );

  if (state.phase === 'fallback' || state.phase === 'ended') {
    return <main className="min-h-dvh bg-background" aria-busy="true" aria-label={m.lesson.busy} />;
  }
  return (
    <>
      <ServerLessonView
        state={state}
        actions={actions}
        desktop={desktop}
        gender={child.gender}
        teacher={teacher}
        mouth={web?.mouth}
      />
      <ConfirmSheet
        open={exitOpen || blocked}
        title={m.lesson.exit.title}
        body={m.lesson.exit.serverBody}
        confirmLabel={m.lesson.exit.confirm}
        cancelLabel={m.lesson.exit.cancel}
        onConfirm={() => {
          unlockLessonAudio();
          closeSheet();
          lesson?.resume();
        }}
        onDismiss={() => {
          closeSheet();
          lesson?.resume();
        }}
        onCancel={() => {
          leaving.current = true;
          closeSheet();
          lesson?.end();
          goHome();
        }}
      />
    </>
  );
}
