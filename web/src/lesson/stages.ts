// The three memorization stages (review notes C9 as updated by the product owner;
// ai/CONTRACT.md §8 PROPOSAL):
//   1 «استمع وردّد»  — the reciter plays the WHOLE surah, then the child recites it STAGE1_PASSES time
//   2 «آية آية»      — each ayah: the reciter, then AYAH_REPEATS repeats
//   3 «السورة كاملة» — the whole surah recited FULL_SURAH_PASSES times (no reciter)
// A v0.1 script (intro + ayah_loop per ayah) is expanded here, so the lesson JSON
// in content/ keeps working and the step index stays the resume point.
// Port: app/lib/features/lesson/agent/lesson_stages.dart (same constants, same output).
import type { AyahLoopStep, LessonScript, LessonStep } from './script';

export const STAGE1_PASSES = 1;
export const AYAH_REPEATS = 5;
export const FULL_SURAH_PASSES = 2;

/** A full pass = the child spoke for this share of the reciter's duration, then paused (D3). */
export const FULL_PASS_VOICED_SHARE = 0.5;
export const FULL_PASS_PAUSE_MS = 2500;

/** v0.1's intro question — the lesson starts without waiting (C8). */
const QUESTION_LINES = new Set(['intro.ready']);

/** True when the script already has v0.2 stage steps. */
const isExpanded = (s: LessonScript) =>
  s.steps.some((x) => x.type === 'stage_intro' || x.type === 'full_surah');

/** v0.1 → v0.2: each run of one surah's ayah_loops becomes the three stages. Idempotent. */
export function expandLesson(s: LessonScript): LessonScript {
  if (isExpanded(s)) return s;
  const src = s.steps;
  const out: LessonStep[] = [];
  let i = 0;
  while (i < src.length) {
    const st = src[i]!;
    if (st.type === 'intro') {
      out.push({ ...st, lines: st.lines.filter((l) => !QUESTION_LINES.has(l)) });
      i++;
      continue;
    }
    if (st.type === 'ayah_loop') {
      const run: AyahLoopStep[] = [];
      while (i < src.length) {
        const x = src[i]!;
        if (x.type !== 'ayah_loop' || x.ref.surah !== st.ref.surah) break;
        run.push(x);
        i++;
      }
      const surah = st.ref.surah;
      out.push({ type: 'stage_intro', stage: 1, surah });
      out.push({ type: 'listen_surah', surah });
      out.push({ type: 'full_surah', surah, passes: STAGE1_PASSES, stage: 1 });
      out.push({ type: 'stage_intro', stage: 2, surah });
      for (const r of run) out.push({ type: 'ayah_loop', ref: r.ref, repeats: AYAH_REPEATS, stage: 2 });
      out.push({ type: 'stage_intro', stage: 3, surah });
      out.push({ type: 'full_surah', surah, passes: FULL_SURAH_PASSES, stage: 3 });
      continue;
    }
    out.push(st);
    i++;
  }
  return { ...s, steps: out };
}

/**
 * The weekly review lesson (§8.6), built from what the child has memorized:
 * each surah recited once in full; approved hadith repeated once. Unapproved
 * hadith topics are never reviewed (nothing to recite).
 */
export function buildReviewScript(o: {
  memorizedSurahs: readonly number[];
  approvedHadithIds: readonly string[];
}): LessonScript {
  const steps: LessonStep[] = [{ type: 'review_intro', lines: ['review.intro'] }];
  for (const surah of [...new Set(o.memorizedSurahs)]) {
    steps.push({ type: 'stage_intro', stage: 3, surah });
    steps.push({ type: 'full_surah', surah, passes: 1, stage: 3 });
  }
  for (const hadithId of [...new Set(o.approvedHadithIds)]) {
    steps.push({ type: 'hadith_loop', hadithId, repeats: 1 });
  }
  steps.push({ type: 'lesson_end', lines: ['end.praise'], question: null });
  return { lessonId: 'weekly-review', title: 'المراجعة الأسبوعية', steps, interim: false };
}

/** Which of the three stages a step belongs to (0 = not a memorization step). */
export function stageOfStep(st: LessonStep | undefined): 0 | 1 | 2 | 3 {
  if (!st) return 0;
  if (st.type === 'stage_intro') return st.stage;
  if (st.type === 'ayah_loop') return st.stage ?? 2;
  if (st.type === 'listen_surah') return 1;
  if (st.type === 'full_surah') return st.stage;
  return 0;
}
