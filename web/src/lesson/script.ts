// A lesson in the ai/CONTRACT.md format (Draft v0.1). Port of lesson_script.dart.
// Religious content is referenced (Quran by surah:ayah, hadith by id), never embedded.
import { FormatError, parseRef, refKey, type QuranMeta, type QuranRef } from './quran';

export const SUPPORTED_CONTRACT = '0.1';

/** Frame 18 (plan). Surah facts: ayah count only — no Makki/Madani. */
export interface IntroStep {
  readonly type: 'intro';
  readonly surah: number;
  readonly lines: readonly string[];
}
/** Frame 18 (ayah state). */
export interface AyahLoopStep {
  readonly type: 'ayah_loop';
  readonly ref: QuranRef;
  readonly repeats: number;
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
  if (j.contractVersion !== SUPPORTED_CONTRACT) {
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
    case 'ayah_loop':
      return { type: 'ayah_loop', ref: parseRef(j.ref), repeats: repeats() };
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

/** Every Quran ref the lesson recites (to prefetch audio before starting). */
export const quranRefsOf = (s: LessonScript): QuranRef[] =>
  s.steps.filter((x): x is AyahLoopStep => x.type === 'ayah_loop').map((x) => x.ref);

/** Checks refs against the mushaf; throws [FormatError] if invalid. */
export function validateLessonScript(s: LessonScript, meta: QuranMeta): void {
  for (const r of quranRefsOf(s)) {
    if (!meta.isValid(r)) throw new FormatError(`Invalid ayah ${refKey(r)}`);
  }
  for (const step of s.steps) if (step.type === 'intro') meta.ayahCount(step.surah);
}
