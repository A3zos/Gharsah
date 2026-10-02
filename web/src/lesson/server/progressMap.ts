// AI-server stages → our Supabase `progress` rows, so stars, streak, the parent
// dashboard and the leaderboard keep working. The database awards a star for
// every stage left behind and refuses to move a stage backwards, so only the
// furthest stage reached (`max_stage_index`) is ever written.
import type { ProgressStage } from '../web/progressSink';
import type { ServerTurn } from './parse';

/** Server quran stages (greet → … → done) in our 5-stage ladder. */
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
  done: 'done',
};

/** Server hadith stages. Leaving `action`/`project` → the hadith counts on the dashboard. */
const HADITH: Record<string, ProgressStage> = {
  greet: 'listen_full',
  name: 'listen_full',
  intro: 'listen_full',
  text: 'listen_full',
  words: 'listen_full',
  meaning: 'listen_full',
  example: 'listen_full',
  memorize: 'ayah_repeat',
  quiz: 'full_twice',
  action: 'hadith',
  project: 'hadith',
  done: 'done',
};

const RANK: readonly ProgressStage[] = ['listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'done'];
export const stageRank = (s: ProgressStage): number => RANK.indexOf(s);
export const maxStage = (a: ProgressStage, b: ProgressStage): ProgressStage =>
  stageRank(a) >= stageRank(b) ? a : b;

/** Server hadith id → our catalogue lesson (supabase/migrations …lessons_catalogue.sql). */
export const HADITH_LESSON: Readonly<Record<number, string>> = {
  9: 'hadith-birr-alwalidayn',
  10: 'hadith-al-kadhib',
  6: 'hadith-al-ghadab',
};
/** Surahs the server teaches (pilot + the Fatiha intro) → our catalogue lesson. */
export const SURAH_LESSONS: readonly number[] = [1, 112, 113, 114];

export function quranLessonId(surahNo: number | null): string | null {
  return surahNo !== null && SURAH_LESSONS.includes(surahNo) ? `surah-${surahNo}` : null;
}

export function hadithLessonId(hadithId: number | null): string | null {
  return hadithId !== null ? (HADITH_LESSON[hadithId] ?? null) : null;
}

/** The furthest stage this turn has reached, in our ladder (an unknown stage id → null). */
export function mappedStage(turn: ServerTurn): ProgressStage | null {
  if (turn.kind !== 'quran' && turn.kind !== 'hadith') return null; // taseem: review only
  const table = turn.kind === 'quran' ? QURAN : HADITH;
  let best: ProgressStage | null = null;
  // Everything up to max_stage_index was reached; take the highest mapped one.
  for (let i = 0; i <= turn.maxStageIndex && i < turn.stages.length; i++) {
    const s = table[turn.stages[i]!.id];
    if (s) best = best ? maxStage(best, s) : s;
  }
  const current = table[turn.stage];
  if (current) best = best ? maxStage(best, current) : current;
  return best;
}

export interface ProgressUpdate {
  readonly lessonId: string;
  readonly stage: ProgressStage;
  /** «surah:ayah» refs memorized (quran) — feeds the dashboard's ayat counts. */
  readonly doneRefs: readonly string[];
  /** The server's stage index (our step_index column; 0–99). */
  readonly stepIndex: number;
}

/** Where server-lesson progress goes (Supabase in the app, a fake in tests). */
export interface ServerProgressSink {
  record(update: ProgressUpdate): Promise<void>;
}

/** All ayat of the surah once the quran lesson is done; before that the recited ones. */
export function doneRefsOf(
  turn: ServerTurn,
  stage: ProgressStage,
  ayahCount: (surah: number) => number,
): string[] {
  if (turn.kind !== 'quran' || turn.surahNo === null) return [];
  const s = turn.surahNo;
  const ayat = stage === 'done' ? Array.from({ length: ayahCount(s) }, (_, i) => i + 1) : turn.recitedAyat;
  return [...new Set(ayat)].filter((a) => a >= 1 && a <= 300).map((a) => `${s}:${a}`);
}
