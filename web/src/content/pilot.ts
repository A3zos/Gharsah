// The PILOT PLAN (product-owner decision 2026-10-02): three days, one lesson a day,
// each day one surah + one hadith, in this order, with no choosing. Read from the
// day scripts in content/lessons/pilot-day-*.json (the single source of truth) —
// the built-in lesson and the AI-server lesson both follow it.
import day1 from '@content/lessons/pilot-day-1.json';
import day2 from '@content/lessons/pilot-day-2.json';
import day3 from '@content/lessons/pilot-day-3.json';

import { toArabicDigits } from '../lib/arabicDigits';
import { hadithRepo, quranMeta } from './library';

export interface PilotDay {
  /** 1-based. */
  readonly day: number;
  readonly lessonId: string;
  readonly surah: number;
  /** «الإخلاص» */
  readonly surahName: string;
  readonly hadithId: string;
  /** «برّ الوالدين» — matched against the AI server's hadith title. */
  readonly hadithTopic: string;
  /** «حديث برّ الوالدين» */
  readonly hadithTitle: string;
}

type Step = { type: string; surah?: number; hadithId?: string };

function dayOf(j: { lessonId: string; pilotDay: number; steps: Step[] }): PilotDay {
  const surah = j.steps.find((s) => s.type === 'intro')?.surah;
  const hadithId = j.steps.find((s) => s.type === 'hadith_loop')?.hadithId;
  if (!surah || !hadithId) throw new Error(`${j.lessonId}: a pilot day needs a surah and a hadith`);
  const h = hadithRepo.byId(hadithId);
  return {
    day: j.pilotDay,
    lessonId: j.lessonId,
    surah,
    surahName: quranMeta.surahName(surah),
    hadithId,
    hadithTopic: h.topic,
    hadithTitle: h.title,
  };
}

export const PILOT_DAYS: readonly PilotDay[] = [day1, day2, day3]
  .map((j) => dayOf(j as unknown as { lessonId: string; pilotDay: number; steps: Step[] }))
  .sort((a, b) => a.day - b.day);

export const pilotDay = (lessonId: string): PilotDay | undefined =>
  PILOT_DAYS.find((d) => d.lessonId === lessonId);

export const PILOT_NAME = 'الباقة التجريبية';

/** What the package contains — shown wherever the app shows the plan. */
export const PILOT_ITEMS: readonly string[] = [
  `${toArabicDigits(PILOT_DAYS.length)} سور: ${PILOT_DAYS.map((d) => d.surahName).join('، ')}`,
  `${toArabicDigits(PILOT_DAYS.length)} أحاديث: ${PILOT_DAYS.map((d) => d.hadithTopic).join('، ')}`,
  'حصة واحدة كل يوم',
];
