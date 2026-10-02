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
import { PILOT_DAYS } from '../content/pilot';
import { riyadhDay } from '../lib/dates';

/** The lesson sequence: the pilot plan's three days, in order (content/pilot.ts). */
export const LESSON_SEQUENCE: readonly string[] = PILOT_DAYS.map((d) => d.lessonId);

export interface ChildRef {
  parentUid: string;
  childId: string;
}

type Row = Record<string, unknown>;

/** The weekly board from get_leaderboard(): top 5 (anonymous) + this child's own standing. */
async function loadBoard(): Promise<LeaderBoard | null> {
  const { data, error } = await supabase().rpc('get_leaderboard');
  if (error || !data) return null;
  return parseBoard(data as Row);
}

/**
 * get_leaderboard() payload → LeaderBoard. Also reads the previous payload
 * ({rows, own} with `stars`) so the site works whichever of web/db deploys first.
 */
export function parseBoard(d: Row): LeaderBoard {
  const rawTop = Array.isArray(d.top) ? (d.top as Row[]) : Array.isArray(d.rows) ? (d.rows as Row[]) : [];
  const pts = (r: Row) =>
    typeof r.points === 'number' ? r.points : typeof r.stars === 'number' ? r.stars : null;
  const top = rawTop
    .filter((r) => typeof r.rank === 'number' && pts(r) !== null)
    .slice(0, TOP_ROWS)
    .map((r) => ({ rank: r.rank as number, points: pts(r)!, me: r.me === true }));
  const m =
    d.me && typeof d.me === 'object'
      ? (d.me as Row)
      : d.own && typeof d.own === 'object'
        ? (d.own as Row)
        : null;
  return {
    weekKey: String(d.weekKey ?? ''),
    total: typeof d.total === 'number' ? d.total : 0,
    top,
    me:
      m && typeof m.rank === 'number'
        ? {
            rank: m.rank,
            points: pts(m) ?? 0,
            gapToAbove: typeof m.gapToAbove === 'number' ? m.gapToAbove : null,
            inTop5: typeof m.inTop5 === 'boolean' ? m.inTop5 : top.some((r) => r.me),
          }
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
      const [stats, pilot] = await Promise.all([
        db.rpc('child_stats', { c: s.childId }),
        db
          .from('progress')
          .select('lesson_id')
          .eq('child_id', s.childId)
          .like('lesson_id', 'pilot-day-%')
          .eq('stage', 'done'),
      ]);
      return childFromRow(data, {
        stats: (stats.data as Row | null) ?? null,
        pilotDaysDone: pilot.data?.length ?? 0,
      });
    },
    next,
    error,
  );
}

export interface StoredProgress {
  progress: LessonProgress;
  updatedAt: Date | null;
  /** Set by the database when the lesson reached «done» (server time). */
  completedAt?: Date | null;
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
        .select(
          'lesson_id, stage, step_index, done_refs, project_assigned, reported_project, updated_at, completed_at',
        )
        .eq('child_id', s.childId)
        .in('lesson_id', [...LESSON_SEQUENCE]);
      if (e) throw e;
      return new Map(
        (data ?? []).map((r) => [
          String(r.lesson_id),
          {
            progress: progressFromRow(String(r.lesson_id), r),
            updatedAt: typeof r.updated_at === 'string' ? new Date(r.updated_at) : null,
            completedAt: typeof r.completed_at === 'string' ? new Date(r.completed_at) : null,
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
  | { kind: 'available'; lessonId: string; day: number; resume: LessonProgress | null }
  /** Today's lesson is finished; the next day opens tomorrow (Riyadh). TODO(design): no designed «done for today» hero. */
  | { kind: 'doneToday'; lessonId: string; day: number }
  /** All pilot days are finished. TODO(design): no designed plan-complete hero. */
  | { kind: 'planDone'; lessonId: string; day: number };

/**
 * The pilot plan: one lesson a day, in order, no choosing. Day N opens only once
 * day N-1 is completed AND on a later Riyadh calendar day (the database enforces
 * the same rule — pilot_day_guard). A started day stays open until finished.
 */
export function pickTodayLesson(stored: Map<string, StoredProgress>, now = new Date()): TodayLesson {
  const today = riyadhDay(now);
  let prevDoneOn: string | null = null;
  for (let i = 0; i < LESSON_SEQUENCE.length; i++) {
    const id = LESSON_SEQUENCE[i]!;
    const s = stored.get(id);
    if (s?.progress.completed) {
      const at = s.completedAt ?? s.updatedAt;
      prevDoneOn = at ? riyadhDay(at) : today;
      continue;
    }
    if (i > 0 && prevDoneOn === today && !(s && s.progress.stepIndex > 0)) {
      return { kind: 'doneToday', lessonId: LESSON_SEQUENCE[i - 1]!, day: i };
    }
    return {
      kind: 'available',
      lessonId: id,
      day: i + 1,
      resume: s && s.progress.stepIndex > 0 ? s.progress : null,
    };
  }
  const last = LESSON_SEQUENCE.length;
  return { kind: 'planDone', lessonId: LESSON_SEQUENCE[last - 1]!, day: last };
}

const MEMORIZE = new Set(['intro', 'stage_intro', 'listen_surah', 'ayah_loop', 'full_surah']);

/** Script step indices where a visible "step" starts (the intro and all three stages count as one). */
export function lessonStepGroups(s: LessonScript): number[] {
  const starts: number[] = [];
  s.steps.forEach((st, i) => {
    const prev = s.steps[i - 1];
    const joins = st.type !== 'intro' && MEMORIZE.has(st.type) && !!prev && MEMORIZE.has(prev.type);
    if (!joins) starts.push(i);
  });
  return starts;
}

// ── Leaderboard (anonymous; stars this week) ────────────────────────────────

const TOP_ROWS = 5;

export interface BoardEntry {
  rank: number;
  points: number;
  me: boolean;
}

export interface LeaderBoard {
  weekKey: string;
  total: number;
  /** Ranks 1–5 (dense; ties share a rank) — other children are never identified. */
  top: BoardEntry[];
  /** This child's own standing (always present for a paired device). */
  me: { rank: number; points: number; gapToAbove: number | null; inTop5: boolean } | null;
}

/** get_leaderboard() is live — re-read every 5 minutes and when the child's own stars change. */
export function watchLeaderboard(next: (b: LeaderBoard | null) => void, childId?: string) {
  let stop = false;
  const load = () =>
    loadBoard()
      .then((b) => {
        if (!stop) next(b);
      })
      .catch(() => {
        if (!stop) next(null);
      });
  void load();
  const t = setInterval(load, 5 * 60_000);
  const unwatch = childId
    ? watch([{ table: 'star_events', filter: `child_id=eq.${childId}` }], loadBoard, (b) => {
        if (!stop) next(b);
      })
    : () => {};
  return () => {
    stop = true;
    clearInterval(t);
    unwatch();
  };
}

export interface BoardRow {
  rank: number;
  points: number;
  me: boolean;
  /** Only the child's own row has a label («بدر — أنت»); others show rank + avatar + points only. */
  label: string | null;
}

/** «نجمة واحدة» / «نجمتان» / «٣ نجوم» / «١١ نجمة» */
export function starsPhrase(n: number): string {
  if (n === 1) return 'نجمة واحدة';
  if (n === 2) return 'نجمتان';
  if (n >= 3 && n <= 10) return `${toArabicDigits(n)} نجوم`;
  return `${toArabicDigits(n)} نجمة`;
}

/**
 * Top 5 (anonymous) with the child's own row in place — or, when the child isn't
 * in the top 5, the five rows, a «⋯» separator, then the child's own row with the
 * real rank. The note motivates with the gap to the rank above.
 */
export function buildBoard(
  board: LeaderBoard | null,
  myLabel: string,
): { rows: BoardRow[]; own: BoardRow | null; separator: boolean; note: string | null } {
  const top = (board?.top ?? []).slice(0, TOP_ROWS);
  const me = board?.me ?? null;
  const rows: BoardRow[] = top.map((r) => ({ ...r, label: r.me ? myLabel : null }));
  const own: BoardRow | null =
    me && !rows.some((r) => r.me) ? { rank: me.rank, points: me.points, me: true, label: myLabel } : null;
  let note: string | null = null;
  if (me && (me.points > 0 || (board?.total ?? 0) > 0)) {
    // To pass the rank above, one star more than the gap (a tie would share the rank).
    note =
      me.rank === 1 || me.gapToAbove === null
        ? 'أنت في المركز الأول هذا الأسبوع — استمر!'
        : `باقي لك ${starsPhrase(me.gapToAbove + 1)} وتسبق المركز ${toArabicDigits(me.rank - 1)}`;
  }
  return { rows, own, separator: !!own && rows.length >= TOP_ROWS, note };
}

/** Whole days until the board resets (Saturday 00:00 Riyadh, UTC+3). */
export function daysUntilReset(now = new Date()): number {
  const riyadh = new Date(now.getTime() + 3 * 3_600_000);
  const sinceSat = (riyadh.getUTCDay() + 1) % 7; // sat=0 … fri=6
  const left = 7 - sinceSat;
  return left === 0 ? 7 : left;
}
