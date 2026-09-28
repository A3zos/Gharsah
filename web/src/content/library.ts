// The verified local content the child app reads (content/ is the source of
// truth; nothing here is typed by hand or generated).
import hadithJson from '@content/hadith/hadith.json';
import day2 from '@content/lessons/m01-w03-day2.json';
import ikhlas from '@content/lessons/m01-w03-ikhlas.json';
import projectsJson from '@content/projects/projects.json';
import metaJson from '@content/quran/quran_meta.json';

import { HadithRepository } from '../lesson/hadith';
import { ProjectRepository } from '../lesson/projects';
import { QuranMeta } from '../lesson/quran';
import { parseLessonScript, type LessonScript } from '../lesson/script';
import { expandLesson } from '../lesson/stages';

export const quranMeta = QuranMeta.fromJson(metaJson);
export const hadithRepo = HadithRepository.fromJson(hadithJson as { hadith: Record<string, unknown>[] });
export const projectRepo = ProjectRepository.fromJson(projectsJson);

export const lessonScripts: ReadonlyMap<string, LessonScript> = new Map(
  [ikhlas, day2].map((j) => {
    // Expanded once here (the three stages), so resume, progress and the home all see the same steps.
    const s = expandLesson(parseLessonScript(j as Record<string, unknown>));
    return [s.lessonId, s];
  }),
);

/** Index of the lesson's hadith step (-1 when it has none). */
export const hadithStepIndex = (s: LessonScript): number =>
  s.steps.findIndex((x) => x.type === 'hadith_loop');

const VALUES = new Map([ikhlas, day2].map((j) => [j.lessonId, (j as { value?: string }).value ?? '']));

/** The lesson's value («برّ الوالدين»), from the lesson JSON. */
export const lessonValue = (lessonId: string): string => VALUES.get(lessonId) ?? '';

/** The value («برّ الوالدين») of the lesson that assigns `projectId`. */
export function projectValue(projectId: string): string {
  for (const [id, s] of lessonScripts) {
    if (s.steps.some((st) => st.type === 'project_assign' && st.projectId === projectId))
      return lessonValue(id);
  }
  return '';
}

/** «سورة الإخلاص» / hadith title chips of a lesson (frame 17 hero). */
export function lessonChips(s: LessonScript): { label: string; kind: 'surah' | 'hadith' | 'report' }[] {
  const chips: { label: string; kind: 'surah' | 'hadith' | 'report' }[] = [];
  for (const st of s.steps) {
    if (st.type === 'project_report') chips.push({ label: 'أولًا: تقرير المشروع', kind: 'report' });
    if (st.type === 'intro') chips.push({ label: `سورة ${quranMeta.surahName(st.surah)}`, kind: 'surah' });
    if (st.type === 'hadith_loop') chips.push({ label: hadithRepo.byId(st.hadithId).title, kind: 'hadith' });
  }
  return chips;
}
