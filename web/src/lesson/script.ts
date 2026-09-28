// A lesson in the ai/CONTRACT.md format (v0.1, + the v0.2 PROPOSAL §8 step types).
// Port of lesson_script.dart. Religious content is referenced (Quran by
// surah:ayah, hadith by id), never embedded. v0.1 scripts are expanded into the
// three memorization stages by stages.ts.
import { FormatError, parseRef, refKey, type QuranMeta, type QuranRef } from './quran';

export const SUPPORTED_CONTRACTS = ['0.1', '0.2'] as const;

/** Frame 18 (plan). Surah facts: ayah count only — no Makki/Madani. */
export interface IntroStep {
  readonly type: 'intro';
  readonly surah: number;
  readonly lines: readonly string[];
}
/** Frame 18 (ayah state). `stage` 1 = «استمع وردّد», 2 = «آية آية» (v0.2). */
export interface AyahLoopStep {
  readonly type: 'ayah_loop';
  readonly ref: QuranRef;
  readonly repeats: number;
  readonly stage?: 1 | 2;
}
/** v0.2: the short line between memorization stages (auto-advances). */
export interface StageIntroStep {
  readonly type: 'stage_intro';
  readonly stage: 1 | 2 | 3;
  readonly surah: number;
}
/** v0.2 stage 1: the reciter plays the whole surah, ayah by ayah (the highlight follows it). */
export interface ListenSurahStep {
  readonly type: 'listen_surah';
  readonly surah: number;
}
/** v0.2 stages 1 and 3 (and the weekly review): the child recites the whole surah `passes` times. */
export interface FullSurahStep {
  readonly type: 'full_surah';
  readonly surah: number;
  readonly passes: number;
  readonly stage: 1 | 3;
}
/** v0.2: opens the weekly review lesson. */
export interface ReviewIntroStep {
  readonly type: 'review_intro';
  readonly lines: readonly string[];
}
/** Frame 19. */
export interface SurahDoneStep {
  readonly type: 'surah_done';
  readonly lines: readonly string[];
  readonly question: string;
}
/** Frame 20. */
export interface HadithLoopStep {
  readonly type: 'hadith_loop';
  readonly hadithId: string;
  readonly repeats: number;
}
/** Frame 21. The hints come from the project content, not the script. */
export interface ProjectAssignStep {
  readonly type: 'project_assign';
  readonly projectId: string;
  readonly lines: readonly string[];
  readonly question: string;
}
/** Frame 22 (next day, first). */
export interface ProjectReportStep {
  readonly type: 'project_report';
  readonly projectId: string;
  readonly question: string;
}
/** Frame 23. `question` = optional «تقدر تقول لي: أبشر؟» (app-side contract addition). */
export interface LessonEndStep {
  readonly type: 'lesson_end';
  readonly lines: readonly string[];
  readonly question: string | null;
}

export type LessonStep =
  | IntroStep
  | AyahLoopStep
  | StageIntroStep
  | ListenSurahStep
  | FullSurahStep
  | ReviewIntroStep
  | SurahDoneStep
  | HadithLoopStep
  | ProjectAssignStep
  | ProjectReportStep
  | LessonEndStep;

export interface LessonScript {
  readonly lessonId: string;
  readonly title: string;
  readonly steps: readonly LessonStep[];
  /** A clearly-marked placeholder script (e.g. the day-2 lesson). */
  readonly interim: boolean;
}

type Json = Record<string, unknown>;

export function parseLessonScript(j: Json): LessonScript {
  if (!(SUPPORTED_CONTRACTS as readonly unknown[]).includes(j.contractVersion)) {
    throw new FormatError(`Unsupported lesson contract version ${String(j.contractVersion)}`);
  }
  const steps = (j.steps as Json[]).map(parseStep);
  if (steps.length === 0) throw new FormatError('Lesson has no steps');
  return {
    lessonId: j.lessonId as string,
    title: j.title as string,
    steps,
    interim: (j.interim as boolean | undefined) ?? false,
  };
}

function parseStep(j: Json): LessonStep {
  const lines = () => [...((j.lines as string[] | undefined) ?? [])];
  const repeats = () => {
    const r = (j.repeats as number | undefined) ?? 3;
    if (r < 1 || r > 10) throw new FormatError(`Bad repeats ${r}`);
    return r;
  };
  switch (j.type) {
    case 'intro':
      return { type: 'intro', surah: j.surah as number, lines: lines() };
    case 'ayah_loop': {
      const stage = j.stage === 1 || j.stage === 2 ? j.stage : undefined;
      return { type: 'ayah_loop', ref: parseRef(j.ref), repeats: repeats(), ...(stage ? { stage } : {}) };
    }
    case 'stage_intro': {
      if (j.stage !== 1 && j.stage !== 2 && j.stage !== 3)
        throw new FormatError(`Bad stage ${String(j.stage)}`);
      return { type: 'stage_intro', stage: j.stage, surah: j.surah as number };
    }
    case 'listen_surah':
      return { type: 'listen_surah', surah: j.surah as number };
    case 'full_surah': {
      const passes = (j.passes as number | undefined) ?? 2;
      if (passes < 1 || passes > 5) throw new FormatError(`Bad passes ${passes}`);
      return { type: 'full_surah', surah: j.surah as number, passes, stage: j.stage === 1 ? 1 : 3 };
    }
    case 'review_intro':
      return { type: 'review_intro', lines: lines() };
    case 'surah_done':
      return { type: 'surah_done', lines: lines(), question: j.question as string };
    case 'hadith_loop':
      return { type: 'hadith_loop', hadithId: j.hadithId as string, repeats: repeats() };
    case 'project_assign':
      return {
        type: 'project_assign',
        projectId: j.projectId as string,
        lines: lines(),
        question: (j.question as string | undefined) ?? 'project.ask',
      };
    case 'project_report':
      return { type: 'project_report', projectId: j.projectId as string, question: j.question as string };
    case 'lesson_end':
      return { type: 'lesson_end', lines: lines(), question: (j.question as string | undefined) ?? null };
    default:
      throw new FormatError(`Unknown step type ${String(j.type)}`);
  }
}

/** Every Quran ref the lesson recites via ayah steps (stage 2 covers each surah's ayat). */
export function quranRefsOf(s: LessonScript): QuranRef[] {
  const out = new Map<string, QuranRef>();
  for (const x of s.steps) if (x.type === 'ayah_loop') out.set(refKey(x.ref), x.ref);
  return [...out.values()];
}

/** Checks refs against the mushaf; throws [FormatError] if invalid. */
export function validateLessonScript(s: LessonScript, meta: QuranMeta): void {
  for (const r of quranRefsOf(s)) {
    if (!meta.isValid(r)) throw new FormatError(`Invalid ayah ${refKey(r)}`);
  }
  for (const step of s.steps) {
    if (
      step.type === 'intro' ||
      step.type === 'stage_intro' ||
      step.type === 'listen_surah' ||
      step.type === 'full_surah'
    ) {
      meta.ayahCount(step.surah); // throws for an invalid surah
    }
  }
}
