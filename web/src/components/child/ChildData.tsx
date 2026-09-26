// Live data of the linked child device: its child doc (stats, leader), lesson
// checkpoints and the anonymous leaderboard. Provided by the /child layout.
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import type { ChildProfile } from '../../data/children';
import {
  watchLeaderboard,
  watchProgress,
  watchStudent,
  type ChildRef,
  type LeaderBoard,
  type StoredProgress,
} from '../../data/student';

export interface ChildData {
  session: ChildRef & { deviceUid: string };
  /** undefined while loading. */
  child: ChildProfile | null | undefined;
  progress: Map<string, StoredProgress> | undefined;
  board: LeaderBoard | null;
}

const Ctx = createContext<ChildData | null>(null);

export function ChildDataProvider({
  session,
  children: node,
}: {
  session: ChildData['session'];
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [child, setChild] = useState<ChildProfile | null | undefined>(undefined);
  const [progress, setProgress] = useState<Map<string, StoredProgress> | undefined>(undefined);
  const [board, setBoard] = useState<LeaderBoard | null>(null);

  useEffect(() => {
    // permission-denied = the parent revoked this device (or removed the child).
    const revoked = (e: unknown) => {
      if ((e as { code?: string }).code === 'permission-denied') navigate(paths.childCode, { replace: true });
    };
    const unsubs = [
      watchStudent(session, (c) => (c ? setChild(c) : navigate(paths.childCode, { replace: true })), revoked),
      watchProgress(session, setProgress, revoked),
      watchLeaderboard(setBoard),
    ];
    return () => unsubs.forEach((u) => u());
  }, [session, navigate]);

  return <Ctx.Provider value={{ session, child, progress, board }}>{node}</Ctx.Provider>;
}

export function useChildData(): ChildData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChildData outside the child layout');
  return v;
}
