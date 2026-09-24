import { Timestamp } from 'firebase-admin/firestore';

import plan from './config/yearly_plan.json';

/// Progress checkpoint written by the child device (firestore.rules checks it).
export interface ProgressDoc {
  lessonId: string;
  doneRefs: string[]; // "112:1"
  surahsCompleted: number[];
  hadithDone: string[];
  projectAssigned?: string | null;
  reportedProject?: string | null;
  completed: boolean;
}

export interface Dated<T> {
  [key: string]: unknown;
  at: Timestamp;
}

/// `stats` on the child doc — read by the parent dashboard (12–16) and the
/// child home (17). Written ONLY by Cloud Functions.
export interface ChildStats {
  ayat: number;
  surahs: number;
  hadith: number;
  projects: number;
  streak: number;
  planPct: number;
  stage: 'seed' | 'sprout' | 'tree';
  surahsDone: { surah: number; at: Timestamp }[];
  surahInProgress: { surah: number; done: number } | null;
  hadithDone: { id: string; at: Timestamp }[];
  ayatBySurah: Record<string, number>;
  latestAyat: { surah: number; count: number; at: Timestamp } | null;
  pendingProject: string | null;
  lessonDays: string[]; // YYYY-MM-DD (plan time zone), newest last, capped
  updatedAt: Timestamp;
}

const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const PLAN_TOTAL_AYAT: number = plan.totalAyat;

/// Day key in the plan's time zone (Saudi Arabia, no DST).
export function dayKey(d: Date): string {
  return new Date(d.getTime() + plan.utcOffsetHours * 3600_000).toISOString().slice(0, 10);
}

function weekdayOfKey(key: string): (typeof WEEK)[number] {
  return WEEK[new Date(`${key}T12:00:00Z`).getUTCDay()];
}

function prevKey(key: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive *scheduled* lesson days completed (product-owner rule): walk back
 * from today over the child's scheduled weekdays; each scheduled day must have
 * a finished lesson. Today not done yet doesn't break the streak; unscheduled
 * days are skipped.
 */
export function streak(lessonDays: Iterable<string>, scheduleDays: string[], now: Date): number {
  const done = new Set(lessonDays);
  const scheduled = new Set(scheduleDays);
  if (scheduled.size === 0) return 0;
  const today = dayKey(now);
  let n = 0;
  let key = today;
  for (let i = 0; i < 400; i++, key = prevKey(key)) {
    if (!scheduled.has(weekdayOfKey(key))) continue;
    if (done.has(key)) n++;
    else if (key !== today) break;
  }
  return n;
}

export function stageOf(pct: number): ChildStats['stage'] {
  return pct <= 33 ? 'seed' : pct <= 66 ? 'sprout' : 'tree';
}

/** Recomputes the child's stats from all progress docs (pure). */
export function computeStats(input: {
  progress: ProgressDoc[];
  submissions: { projectId: string }[];
  prev: Partial<ChildStats> | undefined;
  scheduleDays: string[];
  /// A lesson became completed in this write → today counts as a lesson day.
  completedNow: boolean;
  now: Date;
}): ChildStats {
  const { progress, submissions, prev, scheduleDays, completedNow, now } = input;
  const at = Timestamp.fromDate(now);

  const refs = new Set<string>();
  for (const p of progress) for (const r of p.doneRefs ?? []) if (/^\d{1,3}:\d{1,3}$/.test(r)) refs.add(r);
  const bySurah: Record<string, number> = {};
  for (const r of refs) {
    const s = r.split(':')[0];
    bySurah[s] = (bySurah[s] ?? 0) + 1;
  }

  // Keep the first-completion date of each surah / hadith.
  const prevSurahAt = new Map((prev?.surahsDone ?? []).map((e) => [e.surah, e.at]));
  const surahSet = new Set<number>();
  for (const p of progress) for (const s of p.surahsCompleted ?? []) surahSet.add(s);
  const surahsDone = [...surahSet]
    .map((surah) => ({ surah, at: prevSurahAt.get(surah) ?? at }))
    .sort((a, b) => a.at.toMillis() - b.at.toMillis() || a.surah - b.surah);

  const prevHadithAt = new Map((prev?.hadithDone ?? []).map((e) => [e.id, e.at]));
  const hadithSet = new Set<string>();
  for (const p of progress) for (const h of p.hadithDone ?? []) hadithSet.add(h);
  const hadithDone = [...hadithSet]
    .map((id) => ({ id, at: prevHadithAt.get(id) ?? at }))
    .sort((a, b) => a.at.toMillis() - b.at.toMillis());

  const partial = Object.keys(bySurah)
    .map(Number)
    .filter((s) => !surahSet.has(s))
    .sort((a, b) => a - b);
  const surahInProgress = partial.length ? { surah: partial[0], done: bySurah[String(partial[0])] } : null;

  // Newest additions: surahs whose memorized count grew in this write.
  let latestAyat = prev?.latestAyat ?? null;
  for (const [s, c] of Object.entries(bySurah)) {
    const before = prev?.ayatBySurah?.[s] ?? 0;
    if (c > before) latestAyat = { surah: Number(s), count: c - before, at };
  }

  const reported = new Set<string>(submissions.map((s) => s.projectId));
  for (const p of progress) if (p.reportedProject) reported.add(p.reportedProject);
  let pendingProject: string | null = null;
  for (const p of progress) {
    if (p.projectAssigned && !reported.has(p.projectAssigned)) pendingProject = p.projectAssigned;
  }

  const days = new Set(prev?.lessonDays ?? []);
  if (completedNow) days.add(dayKey(now));
  const lessonDays = [...days].sort().slice(-120);

  const ayat = refs.size;
  const planPct = Math.min(100, Math.round((ayat * 100) / PLAN_TOTAL_AYAT));
  return {
    ayat,
    surahs: surahsDone.length,
    hadith: hadithDone.length,
    projects: submissions.length,
    streak: streak(lessonDays, scheduleDays, now),
    planPct,
    stage: stageOf(planPct),
    surahsDone,
    surahInProgress,
    hadithDone,
    ayatBySurah: bySurah,
    latestAyat,
    pendingProject,
    lessonDays,
    updatedAt: at,
  };
}
