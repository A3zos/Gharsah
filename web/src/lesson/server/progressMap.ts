// AI-server stages → our Supabase `progress` rows, so stars, streak, the parent
// dashboard and the leaderboard keep working. The database awards a star for
// every stage left behind and refuses to move a stage backwards, so only the
// furthest stage reached (`max_stage_index`) is ever written.
import type { ProgressStage } from '../web/progressSink';
import type { ServerTurn } from './parse';

/**
 * The day's lesson (a pilot day: one surah + one hadith) on our 5-stage ladder —
 * the same row the built-in lesson writes. The surah part fills the first three
 * stages; finishing it moves the day to «hadith» (the surah's star); finishing the
 * hadith session finishes the day.
 */
const QURAN: Record<string, ProgressStage> = {
  greet: 'listen_full',
  name: 'listen_full',
  surah: 'listen_full',
  lesson_intro: 'listen_full',
  tafsir: 'listen_full',
  fadl: 'listen_full',
  recitation: 'ayah_repeat',
  tajweed: 'full_twice',
  plan: 'hadith',
  done: 'hadith',
};

/** Hadith session stages: the day stays on «hadith» until the session is done. */
const HADITH_DONE = 'done';

const RANK: readonly ProgressStage[] = ['listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'done'];
export const stageRank = (s: ProgressStage): number => RANK.indexOf(s);
export const maxStage = (a: ProgressStage, b: ProgressStage): ProgressStage =>
  stageRank(a) >= stageRank(b) ? a : b;

/** The furthest stage this turn has reached, in our ladder (review sessions → null). */
export function mappedStage(turn: ServerTurn): ProgressStage | null {
  if (turn.kind === 'hadith') {
    const reached = turn.stages.slice(0, turn.maxStageIndex + 1).some((s) => s.id === HADITH_DONE);
    return reached || turn.stage === HADITH_DONE ? 'done' : 'hadith';
  }
  if (turn.kind !== 'quran') return null;
  let best: ProgressStage | null = null;
  // Everything up to max_stage_index was reached; take the highest mapped one.
  for (let i = 0; i <= turn.maxStageIndex && i < turn.stages.length; i++) {
    const s = QURAN[turn.stages[i]!.id];
    if (s) best = best ? maxStage(best, s) : s;
  }
  const current = QURAN[turn.stage];
  if (current) best = best ? maxStage(best, current) : current;
  return best;
}

/** Matches the server's hadith title to the day's topic (any spelling; «لا تغضب» ~ «الغضب»). */
export function hadithMatchesTopic(title: string, topic: string, normalize: (t: string) => string): boolean {
  const t = normalize(title);
  const words = normalize(topic)
    .split(' ')
    .map((w) => w.replace(/^ال/, ''))
    .filter((w) => w.length >= 3);
  return words.length > 0 && words.every((w) => t.includes(w));
}

export interface ProgressUpdate {
  readonly lessonId: string;
  readonly stage: ProgressStage;
  /** «surah:ayah» refs memorized (quran) — feeds the dashboard's ayat counts. */
  readonly doneRefs: readonly string[];
  /** The server's stage index (our step_index column; 0–99). */
  readonly stepIndex: number;
  /** The quiz was answered on-device (no words known) — «لم يُقيَّم» for the parent. */
  readonly quizUnscored?: boolean;
}

/** Where server-lesson progress goes (Supabase in the app, a fake in tests). */
export interface ServerProgressSink {
  record(update: ProgressUpdate): Promise<void>;
}

/** The whole day's surah once its part is done; before that the recited ayat. */
export function doneRefsOf(
  turn: ServerTurn,
  stage: ProgressStage,
  surah: number,
  ayahCount: (surah: number) => number,
): string[] {
  if (turn.kind !== 'quran' && stage !== 'done') return [];
  const ayat =
    stage === 'hadith' || stage === 'done'
      ? Array.from({ length: ayahCount(surah) }, (_, i) => i + 1)
      : turn.recitedAyat;
  return [...new Set(ayat)].filter((a) => a >= 1 && a <= 300).map((a) => `${surah}:${a}`);
}
