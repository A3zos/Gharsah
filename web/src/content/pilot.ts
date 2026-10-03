// The PILOT PLAN (product-owner decision 2026-10-02): three days, one lesson a day,
// each day one surah + one hadith, in this order, with no choosing. Read from the
// day scripts in content/lessons/pilot-day-*.json (the single source of truth) —
// the built-in lesson and the AI-server lesson both follow it.
import day1 from '@content/lessons/pilot-day-1.json';
import day2 from '@content/lessons/pilot-day-2.json';
import day3 from '@content/lessons/pilot-day-3.json';

import { fill, MESSAGES, type UiLanguage } from '../i18n/i18n';
import { PILOT_MAX_CHILDREN } from './plans';
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

/**
 * The pilot plan's copy in a UI language (src/i18n/*.json → plans.pilot). The names
 * come from plans.names; in Arabic they equal the verified content (pilot.test.ts).
 */
export function pilotCopy(lang: UiLanguage) {
  const m = MESSAGES[lang].plans;
  const surah = (d: PilotDay) => (m.names.surah as Record<string, string>)[d.surah] ?? d.surahName;
  const hadith = (d: PilotDay) => (m.names.hadith as Record<string, string>)[d.hadithId] ?? d.hadithTitle;
  const vars = {
    count: PILOT_DAYS.length,
    surahs: PILOT_DAYS.map(surah).join(m.listSep),
    children: PILOT_MAX_CHILDREN,
  };
  return {
    name: m.pilot.name,
    /** The pilot is free — no payment step; signing up starts it. */
    price: m.pilot.price,
    cta: m.pilot.cta,
    tag: fill(lang, m.pilot.tag, { n: PILOT_DAYS.length }),
    /** What the package contains — shown wherever the app shows the plan. */
    items: m.pilot.items.map((t) => fill(lang, t, vars)),
    days: PILOT_DAYS.map((d) => fill(lang, m.pilot.day, { n: d.day, surah: surah(d), hadith: hadith(d) })),
  };
}

const AR = pilotCopy('ar');
export const PILOT_NAME = AR.name;
export const PILOT_PRICE = AR.price;
export const PILOT_CTA = AR.cta;
export const PILOT_ITEMS: readonly string[] = AR.items;
