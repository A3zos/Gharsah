// What the ai-speak function may voice in a slot: an allow-list built ONLY from our
// verified content (Tanzil surah names + ayah counts, content/hadith titles/topics,
// content/projects copy) and the line bank's own word helpers. Mirrored to
// supabase/functions/ai-speak/slots.json — aiSpeakSlots.test.ts fails if they differ
// (regenerate: UPDATE_AI_SPEAK_SLOTS=1 npx vitest run src/lesson/aiSpeakSlots.test.ts).
//
// The child's name is never in it: lines with a {name} slot stay on the device
// (browser voice), and ai-speak rejects any request carrying a `name` slot.
import hadithJson from '@content/hadith/hadith.json';
import projectsJson from '@content/projects/projects.json';

import { toArabicDigits } from '../lib/arabicDigits';
import { quranMeta } from '../content/library';
import { TEACHER_LINES, TeacherLineBank } from './teacherLines';

/** The slot that carries the child's first name — never sent off the device. */
export const NAME_SLOT = 'name';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const uniq = (xs: readonly string[]) => [...new Set(xs)].sort();

/** A line of the spoken bank (captions are never voiced by the server). */
export const isBankLine = (id: string): boolean => Object.hasOwn(TEACHER_LINES, id);

/** The `{slot}` keys a bank line uses (empty for an unknown line). */
export function slotKeysOf(id: string): string[] {
  const template = TEACHER_LINES[id];
  return template ? [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!) : [];
}

export function aiSpeakSlotAllowList(): Record<string, string[]> {
  const surahs = range(1, 114);
  const maxAyat = Math.max(...surahs.map((s) => quranMeta.ayahCount(s)));
  const hadith = (hadithJson as { hadith: { title: string; topic: string }[] }).hadith;
  const projects = (
    projectsJson as {
      projects: { title: string; intro: string; tomorrow: string; reportAsk: string; hints: string[] }[];
    }
  ).projects;
  const list: Record<string, string[]> = {
    surah: uniq(surahs.map((s) => quranMeta.surahName(s))),
    countWords: uniq(surahs.map((s) => TeacherLineBank.ayatInWords(quranMeta.ayahCount(s)))),
    ordinal: uniq(range(1, maxAyat).map((n) => TeacherLineBank.ordinal(n))),
    ordinalTime: uniq(range(1, 10).map((n) => TeacherLineBank.ordinalTime(n))),
    times: uniq(range(1, 10).map((n) => TeacherLineBank.timesInWords(n))),
    remaining: uniq(range(1, 10).map((n) => toArabicDigits(n))),
    hadithTitle: uniq(hadith.map((h) => h.title)),
    topic: uniq(hadith.map((h) => h.topic)),
    projectTitle: uniq(projects.map((p) => p.title)),
    projectIntro: uniq(projects.map((p) => p.intro)),
    projectTomorrow: uniq(projects.map((p) => p.tomorrow)),
    reportAsk: uniq(projects.map((p) => p.reportAsk)),
    hint: uniq(projects.flatMap((p) => p.hints)),
  };
  return list;
}
