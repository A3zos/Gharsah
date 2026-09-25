// The server-written `stats` on a child document (functions/src/progress.ts) —
// headline numbers only here; the dashboard parses the detail lists.
import { toArabicDigits } from '../lib/arabicDigits';
import type { ChildProfile } from './children';

export type Stage = 'seed' | 'sprout' | 'tree';
export const STAGE_LABEL: Record<Stage, string> = { seed: 'بذرة', sprout: 'غَرْسة', tree: 'شجرة' };

export interface Headline {
  started: boolean;
  planPct: number;
  stage: Stage;
  surahs: number;
  ayat: number;
  hadith: number;
  projects: number;
  streak: number;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

/** seed 0–33 / sprout 34–66 / tree 67–100 (CLAUDE.md §12). */
export const stageOf = (pct: number): Stage => (pct >= 67 ? 'tree' : pct >= 34 ? 'sprout' : 'seed');

export function headline(child: ChildProfile): Headline {
  const s = child.stats;
  const planPct = Math.min(100, num(s?.planPct));
  return {
    started: !!s,
    planPct,
    stage: stageOf(planPct),
    surahs: num(s?.surahs),
    ayat: num(s?.ayat),
    hadith: num(s?.hadith),
    projects: num(s?.projects),
    streak: num(s?.streak),
  };
}

/** «١٠ سنوات» / «١٢ سنة» */
export const ageLabel = (age: number) => `${toArabicDigits(age)} ${age <= 10 ? 'سنوات' : 'سنة'}`;

/** «٣ أبناء» / «ابن واحد» / «ابنان» */
export function childrenCount(n: number): string {
  if (n === 0) return 'لا أبناء بعد';
  if (n === 1) return 'ابن واحد';
  if (n === 2) return 'ابنان';
  return `${toArabicDigits(n)} ${n <= 10 ? 'أبناء' : 'ابنًا'}`;
}
