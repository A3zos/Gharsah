// The lesson on the AI server (VITE_AI_AGENT=1): wires a ServerLesson to the
// browser and to navigation. ✕ and the browser back open ExitConfirm; «خروج» →
// child home. When the server can't run the lesson, `onFallback` hands over to
// today's built-in lesson so the child is never stuck.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useBlocker, useNavigate } from 'react-router';

import { paths } from '../../app/paths';
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
  onFallback,
}: {
  baseUrl: string;
  plan: LessonPlan;
  child: ChildProfile;
  session: { parentUid: string; childId: string };
  /** `quranDone`: today's surah part is finished → the built-in lesson resumes at the hadith. */
  onFallback: (quranDone: boolean) => void;
}) {
  const navigate = useNavigate();
  const desktop = useMedia(DESKTOP);
  const [web, setWeb] = useState<WebServerLesson | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const leaving = useRef(false);
  // Read once on entry: a consent change applies from the next lesson.
  const consent = useRef(child.aiVoiceConsent);
  const planRef = useRef(plan);
  // Only for scrubbing the child's own words — never sent (read once, like consent).
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
      session: { parentUid: session.parentUid, childId: session.childId },
      gender: child.gender,
      childName: childName.current,
      consent: consent.current,
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
  }, [state.phase, state.quranDone, state.fallbackReason, goHome]);

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
    return <main className="min-h-dvh bg-background" aria-busy="true" aria-label="جارٍ تجهيز الحصة" />;
  }
  return (
    <>
      <ServerLessonView
        state={state}
        actions={actions}
        desktop={desktop}
        gender={child.gender}
        mouth={web?.mouth}
      />
      <ConfirmSheet
        open={exitOpen || blocked}
        title="تخرج من الحصة؟"
        body="نجومك وتقدّمك محفوظة، وتكمل الحصة لاحقًا."
        confirmLabel="أكمل الحصة"
        cancelLabel="خروج"
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
