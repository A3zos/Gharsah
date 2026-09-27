// The child device's view of its own data (Supabase). RLS lets a paired device
// read its own child row, progress and stars, write its own progress and
// reports, and read the weekly board through get_leaderboard() (others anonymous).
import { hadithStepIndex, lessonScripts } from '../content/library';
import type { LessonScript } from '../lesson/script';
import type { LessonProgress } from '../lesson/state';
import { toArabicDigits } from '../lib/arabicDigits';
import { supabase } from '../supabase/client';
import { watch } from '../supabase/live';
import { CHILD_COLUMNS, childFromRow, type ChildProfile } from './children';

/** The lesson sequence (interim until the yearly plan is delivered). */
export const LESSON_SEQUENCE = ['m01-w03-ikhlas', 'm01-w03-day2'] as const;

export interface ChildRef {
  parentUid: string;
  childId: string;
}

type Row = Record<string, unknown>;

/** The board + this child's own standing (in the old `leader` shape the UI reads). */
async function loadBoard(): Promise<{ board: LeaderBoard | null; own: Row | null }> {
  const { data, error } = await supabase().rpc('get_leaderboard');
  if (error || !data) return { board: null, own: null };
  const d = data as Row;
  const weekKey = String(d.weekKey ?? '');
  const rows = (Array.isArray(d.rows) ? (d.rows as Row[]) : [])
    .filter((r) => typeof r.rank === 'number' && typeof r.stars === 'number')
    .map((r) => [r.rank as number, r.stars as number] as [number, number]);
  const own = d.own && typeof d.own === 'object' ? (d.own as Row) : null;
  return {
    board: { weekKey, total: typeof d.total === 'number' ? d.total : 0, rows },
    own: own
      ? { weekKey, rank: own.rank, points: own.stars, topPercent: own.topPercent, gapToAbove: own.gapToAbove }
      : null,
  };
}

export function watchStudent(
  s: ChildRef,
  next: (c: ChildProfile | null) => void,
  error?: (e: unknown) => void,
) {
  return watch(
    [
      { table: 'children', filter: `id=eq.${s.childId}` },
      { table: 'progress', filter: `child_id=eq.${s.childId}` },
      { table: 'star_events', filter: `child_id=eq.${s.childId}` },
      { table: 'submissions', filter: `child_id=eq.${s.childId}` },
    ],
    async () => {
      const db = supabase();
      const { data, error: e } = await db
        .from('children')
        .select(CHILD_COLUMNS)
        .eq('id', s.childId)
        .maybeSingle();
      if (e) throw e;
      if (!data) return null;
      const [stats, board] = await Promise.all([db.rpc('child_stats', { c: s.childId }), loadBoard()]);
      const child = childFromRow(data, { stats: (stats.data as Row | null) ?? null });
      return { ...child, leader: board.own };
    },
    next,
    error,
  );
}

export interface StoredProgress {
  progress: LessonProgress;
  updatedAt: Date | null;
}

/** A progress row → the LessonAgent's checkpoint (same meaning as the Firestore one). */
export function progressFromRow(lessonId: string, r: Row): LessonProgress {
  const script = lessonScripts.get(lessonId);
  const stepIndex = typeof r.step_index === 'number' ? r.step_index : 0;
  const completed = r.stage === 'done';
  const intro = script?.steps.find((x) => x.type === 'intro');
  const surahDone = !!intro && (completed || r.stage === 'hadith');
  const hIdx = script ? hadithStepIndex(script) : -1;
  const hadithStep = hIdx >= 0 ? script!.steps[hIdx] : undefined;
  const hadithDone = hadithStep?.type === 'hadith_loop' && (completed || stepIndex > hIdx);
  return {
    lessonId,
    stepIndex,
    doneRefs: new Set(
      (Array.isArray(r.done_refs) ? r.done_refs : []).filter(
        (x): x is string => typeof x === 'string' && x.includes(':'),
      ),
    ),
    surahsCompleted: new Set(surahDone && intro?.type === 'intro' ? [intro.surah] : []),
    hadithDone: new Set(hadithDone && hadithStep?.type === 'hadith_loop' ? [hadithStep.hadithId] : []),
    projectAssigned: typeof r.project_assigned === 'string' ? r.project_assigned : null,
    reportedProject: typeof r.reported_project === 'string' ? r.reported_project : null,
    completed,
  };
}

/** Checkpoints of the lessons in LESSON_SEQUENCE. */
export function watchProgress(
  s: ChildRef,
  next: (m: Map<string, StoredProgress>) => void,
  error?: (e: unknown) => void,
) {
  return watch(
    [{ table: 'progress', filter: `child_id=eq.${s.childId}` }],
    async () => {
      const { data, error: e } = await supabase()
        .from('progress')
        .select('lesson_id, stage, step_index, done_refs, project_assigned, reported_project, updated_at')
        .eq('child_id', s.childId)
        .in('lesson_id', [...LESSON_SEQUENCE]);
      if (e) throw e;
      return new Map(
        (data ?? []).map((r) => [
          String(r.lesson_id),
          {
            progress: progressFromRow(String(r.lesson_id), r),
            updatedAt: typeof r.updated_at === 'string' ? new Date(r.updated_at) : null,
          },
        ]),
      );
    },
    next,
    error,
  );
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

// ── Leaderboard (anonymous; stars this week) ────────────────────────────────

export interface LeaderBoard {
  weekKey: string;
  total: number;
  /** (rank, stars) only — other children are never identified. */
  rows: [number, number][];
}

/** The board refreshes every 30 minutes (pg_cron) — re-read on own stars and every 5 minutes. */
export function watchLeaderboard(next: (b: LeaderBoard | null) => void) {
  let stop = false;
  const load = () =>
    loadBoard()
      .then((b) => {
        if (!stop) next(b.board);
      })
      .catch(() => {
        if (!stop) next(null);
      });
  void load();
  const t = setInterval(load, 5 * 60_000);
  return () => {
    stop = true;
    clearInterval(t);
  };
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
        : `أنت ضمن أفضل ${toArabicDigits(pct)}٪ هذا الأسبوع — باقي ${toArabicDigits(gap)} نجمة لتلحق ب${other(myRank - 1)}.`;
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
