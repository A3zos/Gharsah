// The child device's view of its own data. Port of
// app/lib/features/student/data/{student_repository,leaderboard}.dart.
// Rules: the device may `get` its own child doc and progress docs, create
// submissions + upload its recording, and `get` the anonymous leaderboard.
import { doc, onSnapshot, Timestamp, type DocumentData } from 'firebase/firestore';

import { firebase } from '../firebase/app';
import { toArabicDigits } from '../lib/arabicDigits';
import type { LessonScript } from '../lesson/script';
import type { LessonProgress } from '../lesson/state';
import { childFromDoc, type ChildProfile } from './children';

/** The lesson sequence (interim until the yearly plan is delivered). */
export const LESSON_SEQUENCE = ['m01-w03-ikhlas', 'm01-w03-day2'] as const;

export interface ChildRef {
  parentUid: string;
  childId: string;
}

export const childPath = (s: ChildRef) => `parents/${s.parentUid}/children/${s.childId}`;

export function watchStudent(
  s: ChildRef,
  next: (c: ChildProfile | null) => void,
  error?: (e: unknown) => void,
) {
  return onSnapshot(
    doc(firebase().db, childPath(s)),
    (d) => next(d.exists() ? childFromDoc(d.id, d.data()) : null),
    error,
  );
}

export interface StoredProgress {
  progress: LessonProgress;
  updatedAt: Date | null;
}

export function progressFromMap(lessonId: string, d: DocumentData): LessonProgress {
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    lessonId,
    stepIndex: typeof d.stepIndex === 'number' ? d.stepIndex : 0,
    doneRefs: new Set(list(d.doneRefs).filter((r): r is string => typeof r === 'string' && r.includes(':'))),
    surahsCompleted: new Set(list(d.surahsCompleted).filter((s): s is number => typeof s === 'number')),
    hadithDone: new Set(list(d.hadithDone).filter((h): h is string => typeof h === 'string')),
    projectAssigned: typeof d.projectAssigned === 'string' ? d.projectAssigned : null,
    reportedProject: typeof d.reportedProject === 'string' ? d.reportedProject : null,
    completed: d.completed === true,
  };
}

/** Checkpoints of the lessons in LESSON_SEQUENCE (the device can only get by id). */
export function watchProgress(
  s: ChildRef,
  next: (m: Map<string, StoredProgress>) => void,
  error?: (e: unknown) => void,
) {
  const latest = new Map<string, StoredProgress>();
  const seen = new Set<string>();
  const unsubs = LESSON_SEQUENCE.map((id) =>
    onSnapshot(
      doc(firebase().db, `${childPath(s)}/progress/${id}`),
      (d) => {
        seen.add(id);
        if (d.exists()) {
          const data = d.data();
          latest.set(id, {
            progress: progressFromMap(id, data),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
          });
        } else latest.delete(id);
        if (seen.size === LESSON_SEQUENCE.length) next(new Map(latest));
      },
      error,
    ),
  );
  return () => unsubs.forEach((u) => u());
}

// ── Today's lesson ──────────────────────────────────────────────────────────

export type TodayLesson =
  | { kind: 'available'; lessonId: string; resume: LessonProgress | null }
  /** Finished today; the next lesson opens tomorrow. TODO(design): no designed «done for today» hero. */
  | { kind: 'doneToday'; lessonId: string };

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The first unfinished lesson; one that follows a lesson finished *today* waits until tomorrow. */
export function pickTodayLesson(stored: Map<string, StoredProgress>, now = new Date()): TodayLesson {
  let lastDone: Date | null = null;
  let lastId: string = LESSON_SEQUENCE[0];
  for (const id of LESSON_SEQUENCE) {
    const s = stored.get(id);
    if (s?.progress.completed) {
      lastDone = s.updatedAt;
      lastId = id;
      continue;
    }
    if (lastDone && sameDay(lastDone, now)) return { kind: 'doneToday', lessonId: lastId };
    return { kind: 'available', lessonId: id, resume: s && s.progress.stepIndex > 0 ? s.progress : null };
  }
  return { kind: 'doneToday', lessonId: lastId };
}

/** Script step indices where a visible "step" starts (the ayah loops count as one with the intro). */
export function lessonStepGroups(s: LessonScript): number[] {
  const starts: number[] = [];
  s.steps.forEach((st, i) => {
    const prev = s.steps[i - 1];
    const joins = st.type === 'ayah_loop' && !!prev && (prev.type === 'ayah_loop' || prev.type === 'intro');
    if (!joins) starts.push(i);
  });
  return starts;
}

// ── Leaderboard (anonymous) ─────────────────────────────────────────────────

export interface LeaderBoard {
  weekKey: string;
  total: number;
  /** (rank, points) only — other children are never identified. */
  rows: [number, number][];
}

export function watchLeaderboard(next: (b: LeaderBoard | null) => void) {
  return onSnapshot(
    doc(firebase().db, 'leaderboard/current'),
    (d) => {
      if (!d.exists()) return next(null);
      const m = d.data();
      next({
        weekKey: typeof m.weekKey === 'string' ? m.weekKey : '',
        total: typeof m.total === 'number' ? m.total : 0,
        rows: (Array.isArray(m.rows) ? m.rows : [])
          .filter((r) => typeof r?.rank === 'number' && typeof r?.points === 'number')
          .map((r) => [r.rank, r.points] as [number, number]),
      });
    },
    () => next(null),
  );
}

export interface BoardRow {
  rank: number;
  points: number;
  /** «طالب ٣» for others; the child's own first name for `me`. */
  label: string;
  me: boolean;
}

const TOP_ROWS = 5;

/** Top 5 (anonymous) with the child's own row in place, or top 4 + the child's row. */
export function buildBoard(
  board: LeaderBoard | null,
  own: Record<string, unknown> | null,
  myName: string,
): { rows: BoardRow[]; note: string | null } {
  const other = (rank: number) => `طالب ${toArabicDigits(rank)}`;
  const ownThisWeek = !!own && !!board && own.weekKey === board.weekKey;
  const myRank = ownThisWeek && typeof own!.rank === 'number' ? (own!.rank as number) : null;
  const myPoints = ownThisWeek && typeof own!.points === 'number' ? (own!.points as number) : 0;
  const rows: BoardRow[] = (board?.rows ?? [])
    .slice(0, TOP_ROWS)
    .map(([rank, points]) =>
      rank === myRank
        ? { rank, points, label: myName, me: true }
        : { rank, points, label: other(rank), me: false },
    );
  if (!rows.some((r) => r.me)) {
    if (rows.length >= TOP_ROWS) rows.pop();
    rows.push({ rank: myRank ?? (board?.total ?? 0) + 1, points: myPoints, label: myName, me: true });
  }
  let note: string | null = null;
  if (myRank !== null) {
    const pct = typeof own!.topPercent === 'number' ? (own!.topPercent as number) : 100;
    const gap = typeof own!.gapToAbove === 'number' ? (own!.gapToAbove as number) : null;
    // REVIEW: copy adapted from the design so it names no other child.
    note =
      myRank === 1 || gap === null
        ? 'أنت في المركز الأول هذا الأسبوع — استمر!'
        : `أنت ضمن أفضل ${toArabicDigits(pct)}٪ هذا الأسبوع — باقي ${toArabicDigits(gap)} نقطة لتلحق ب${other(myRank - 1)}.`;
  }
  return { rows, note };
}

/** Whole days until the board resets (Saturday 00:00 Riyadh, UTC+3). */
export function daysUntilReset(now = new Date()): number {
  const riyadh = new Date(now.getTime() + 3 * 3_600_000);
  const sinceSat = (riyadh.getUTCDay() + 1) % 7; // sat=0 … fri=6
  const left = 7 - sinceSat;
  return left === 0 ? 7 : left;
}
