// What the ai-speak function may voice in a slot: an allow-list built ONLY from our
// verified content (Tanzil surah names + ayah counts, content/hadith titles/topics,
// content/projects copy) and the line bank's own word helpers. Mirrored to
// supabase/functions/ai-speak/slots.json — aiSpeakSlots.test.ts fails if they differ
// (regenerate: UPDATE_AI_SPEAK_SLOTS=1 npx vitest run src/lesson/aiSpeakSlots.test.ts).
// English / Indonesian: the same slots with the values teacherLines.ts `localizeSlot`
// produces (teacherLinesI18n.ts) → slots.en.json / slots.id.json, same command.
//
// The child's name is never in it: lines with a {name} slot stay on the device
// (browser voice), and ai-speak rejects any request carrying a `name` slot.
import hadithJson from '@content/hadith/hadith.json';
import projectsJson from '@content/projects/projects.json';

import { toArabicDigits } from '../lib/arabicDigits';
import { quranMeta } from '../content/library';
import { TEACHER_LINES, TeacherLineBank } from './teacherLines';
import {
  HADITH_COPY_I18N,
  PROJECT_COPY_I18N,
  SURAH_NAMES_LATIN,
  WORDS_I18N,
  type LineLang,
  type OtherLang,
} from './teacherLinesI18n';

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

export function aiSpeakSlotAllowList(lang: LineLang = 'ar'): Record<string, string[]> {
  if (lang !== 'ar') return otherAllowList(lang);
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

/** The en / id allow-list: exactly the values teacherLines.ts `localizeSlot` produces for our content. */
function otherAllowList(lang: OtherLang): Record<string, string[]> {
  const surahs = range(1, 114);
  const maxAyat = Math.max(...surahs.map((s) => quranMeta.ayahCount(s)));
  const w = WORDS_I18N[lang];
  const hadith = (hadithJson as { hadith: { id: string }[] }).hadith.flatMap(
    (h) => HADITH_COPY_I18N[lang][h.id] ?? [],
  );
  const projects = (projectsJson as { projects: { id: string }[] }).projects.flatMap(
    (p) => PROJECT_COPY_I18N[lang][p.id] ?? [],
  );
  return {
    surah: uniq(SURAH_NAMES_LATIN),
    countWords: uniq(surahs.map((s) => w.ayatInWords(quranMeta.ayahCount(s)))),
    ordinal: uniq(range(1, maxAyat).map((n) => w.ordinal(n))),
    ordinalTime: uniq(range(1, 10).map((n) => w.ordinal(n))),
    times: uniq(range(1, 10).map((n) => w.timesInWords(n))),
    remaining: uniq(range(1, 10).map((n) => String(n))),
    hadithTitle: uniq(hadith.map((h) => h.title)),
    topic: uniq(hadith.map((h) => h.topic)),
    projectTitle: uniq(projects.map((p) => p.title)),
    projectIntro: uniq(projects.map((p) => p.intro)),
    projectTomorrow: uniq(projects.map((p) => p.tomorrow)),
    reportAsk: uniq(projects.map((p) => p.reportAsk)),
    hint: uniq(projects.flatMap((p) => p.hints)),
  };
}
