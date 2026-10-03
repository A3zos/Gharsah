// The child's CURRENT plan as a timeline: its steps in order (from the plan data, never
// from the card), each step's state, and progress = done steps ÷ total steps.
// Today every child is on the pilot plan (content/pilot.ts); a paid plan adds its own
// steps here later. Used by the parent dashboard and children page.
import { PILOT_DAYS, pilotCopy } from '../content/pilot';
import { fill, MESSAGES, type UiLanguage } from '../i18n/i18n';
import { riyadhDay } from '../lib/dates';
import type { ChildProfile } from './children';
import type { Stage } from './stats';

export interface PlanStep {
  /** The lesson behind the step (progress.lesson_id). */
  id: string;
  /** «اليوم ١» */
  title: string;
  /** «سورة الإخلاص + حديث برّ الوالدين» */
  detail: string;
}

export interface Plan {
  name: string;
  /** «حصة واحدة يوميًا» */
  cadence: string;
  steps: readonly PlanStep[];
}

/** The pilot plan in a UI language (Arabic: the verified surah names and hadith titles). */
export function pilotPlan(lang: UiLanguage = 'ar'): Plan {
  const t = MESSAGES[lang].parent.plan;
  const names = MESSAGES[lang].plans.names;
  const surah = (d: (typeof PILOT_DAYS)[number]) =>
    lang === 'ar' ? d.surahName : ((names.surah as Record<string, string>)[d.surah] ?? d.surahName);
  const hadith = (d: (typeof PILOT_DAYS)[number]) =>
    lang === 'ar' ? d.hadithTitle : ((names.hadith as Record<string, string>)[d.hadithId] ?? d.hadithTitle);
  return {
    name: pilotCopy(lang).name,
    cadence: t.cadence,
    steps: PILOT_DAYS.map((d) => ({
      id: d.lessonId,
      title: fill(lang, t.stepTitle, { n: d.day }),
      detail: fill(lang, t.stepDetail, { surah: surah(d), hadith: hadith(d) }),
    })),
  };
}

export const PILOT_PLAN: Plan = pilotPlan('ar');

/** The plan the child is on. TODO: paid plans get their own steps when they launch. */
export const currentPlan = (child: ChildProfile, lang: UiLanguage = 'ar'): Plan => {
  void child;
  return lang === 'ar' ? PILOT_PLAN : pilotPlan(lang);
};

/**
 * done — finished (with its date); today — open now; missed — open since an earlier day
 * and not done yet (a day passed without a lesson); locked — not open yet (`tomorrow`
 * on the first locked step: it opens tomorrow at the earliest).
 */
export type StepState = 'done' | 'today' | 'missed' | 'locked';

export interface TimelineStep extends PlanStep {
  state: StepState;
  doneAt: Date | null;
  tomorrow: boolean;
}

export interface PlanProgress {
  plan: Plan;
  steps: TimelineStep[];
  done: number;
  total: number;
  /** done ÷ total, 0–100 */
  pct: number;
  stage: Stage;
}

/** The growth badge from the plan %: بذرة 0–33, غَرْسة 34–99, شجرة 100. */
export const planStage = (pct: number): Stage => (pct >= 100 ? 'tree' : pct >= 34 ? 'sprout' : 'seed');

export const planPct = (done: number, total: number): number =>
  total > 0 ? Math.round((Math.min(total, Math.max(0, done)) * 100) / total) : 0;

const nextDay = (ymd: string): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * One step a day, in order (the pilot rule — student.ts pickTodayLesson): a step opens
 * the Riyadh day after the previous one was finished; the first one when the child was
 * added.
 */
export function planProgress(child: ChildProfile, now = new Date(), lang: UiLanguage = 'ar'): PlanProgress {
  const plan = currentPlan(child, lang);
  const today = riyadhDay(now);
  let prevDone: string | null = null;
  let current = -1;
  const steps = plan.steps.map((s, i): TimelineStep => {
    const at = child.pilotDoneAt[s.id] ?? null;
    const finished = at !== null || (current === -1 && i < child.pilotDaysDone);
    if (current === -1 && finished) {
      prevDone = at ? riyadhDay(at) : today;
      return { ...s, state: 'done', doneAt: at, tomorrow: false };
    }
    if (current === -1) {
      current = i;
      if (i > 0 && prevDone === today) return { ...s, state: 'locked', doneAt: null, tomorrow: true };
      const openedOn =
        i === 0 ? (child.createdAt ? riyadhDay(child.createdAt) : today) : nextDay(prevDone ?? today);
      return { ...s, state: openedOn < today ? 'missed' : 'today', doneAt: null, tomorrow: false };
    }
    return { ...s, state: 'locked', doneAt: null, tomorrow: false };
  });
  // the first locked step after an open one opens tomorrow at the earliest
  const firstLocked = steps.findIndex((s) => s.state === 'locked');
  if (firstLocked > 0 && steps[firstLocked - 1]!.state !== 'done') steps[firstLocked]!.tomorrow = true;
  const done = steps.filter((s) => s.state === 'done').length;
  const pct = planPct(done, steps.length);
  return { plan, steps, done, total: steps.length, pct, stage: planStage(pct) };
}

/** «أتمّ ١ من ٣ أيام (٣٣٪) من الباقة التجريبية» / «أكمل الباقة التجريبية 🎉» */
export function planSentence(p: PlanProgress, lang: UiLanguage = 'ar'): string {
  const t = MESSAGES[lang].parent.plan;
  if (p.total > 0 && p.done >= p.total) return fill(lang, t.sentenceDone, { plan: p.plan.name });
  return fill(lang, t.sentence, { done: p.done, total: p.total, pct: p.pct, plan: p.plan.name });
}

/** «١٠ سنوات · حصة واحدة يوميًا · الباقة التجريبية» */
export function planSubtitle(age: string, p: PlanProgress): string {
  return `${age} · ${p.plan.cadence} · ${p.plan.name}`;
}
