// The server-written `stats` on a child document (functions/src/progress.ts) —
// headline numbers only here; the dashboard parses the detail lists.
import { PILOT_DAYS } from '../content/pilot';
import { countPhrase, fill, MESSAGES, type UiLanguage } from '../i18n/i18n';
import { planStage } from './planProgress';
import type { ChildProfile } from './children';

export type Stage = 'seed' | 'sprout' | 'tree';
/** «بذرة» … in a UI language (parent.json → stage). */
export const stageLabel = (stage: Stage, lang: UiLanguage = 'ar'): string =>
  MESSAGES[lang].parent.stage[stage];
/** The Arabic stage names (the child area). */
export const STAGE_LABEL: Record<Stage, string> = {
  seed: stageLabel('seed'),
  sprout: stageLabel('sprout'),
  tree: stageLabel('tree'),
};

export interface Headline {
  started: boolean;
  /** Of the pilot package (days finished ÷ days) — the plan in force (2026-10-02). */
  planPct: number;
  stage: Stage;
  surahs: number;
  ayat: number;
  hadith: number;
  projects: number;
  streak: number;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

export function headline(child: ChildProfile): Headline {
  const s = child.stats;
  const planPct = pilotPct(child.pilotDaysDone);
  return {
    started: !!s,
    planPct,
    // the badge follows the plan: بذرة 0–33, غَرْسة 34–99, شجرة 100
    stage: planStage(planPct),
    surahs: num(s?.surahs),
    ayat: num(s?.ayat),
    hadith: num(s?.hadith),
    projects: num(s?.projects),
    streak: num(s?.streak),
  };
}

/** Share of the pilot package finished, 0–100. */
export const pilotPct = (daysDone: number): number =>
  Math.round((Math.min(PILOT_DAYS.length, Math.max(0, daysDone)) * 100) / PILOT_DAYS.length);

/** «اليوم ٢ من ٣» — the day the child is on; «أتمّ الباقة التجريبية» after the last one. */
export function pilotChip(daysDone: number, lang: UiLanguage = 'ar'): string {
  const t = MESSAGES[lang].parent.pilotChip;
  if (daysDone >= PILOT_DAYS.length) return t.done;
  return fill(lang, t.day, { n: daysDone + 1, total: PILOT_DAYS.length });
}

/** «١٠ سنوات» / «١٢ سنة» */
export const ageLabel = (age: number, lang: UiLanguage = 'ar') => {
  const t = MESSAGES[lang].parent.age;
  return fill(lang, age <= 10 ? t.young : t.old, { n: age });
};

/** «٣ أبناء» / «ابن واحد» / «ابنان» */
export function childrenCount(n: number, lang: UiLanguage = 'ar'): string {
  const t = MESSAGES[lang].parent.childrenCount;
  return n === 0 ? t.none : countPhrase(lang, n, t);
}
