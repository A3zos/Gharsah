// What the child has memorized (and what's this week) — names/topics only,
// for the weekly review screen and cards. Built from the server-written stats.
import type { ChildProfile } from '../data/children';
import type { StoredProgress } from '../data/student';
import { hijriDayMonth, toDateOrNull } from '../lib/dates';
import { plural } from '../lib/plural';
import { hadithRepo, lessonScripts, quranMeta } from './library';

export interface ReviewItem {
  kind: 'surah' | 'hadith';
  label: string;
  meta: string;
  state: 'done' | 'now';
}

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const asDate = toDateOrNull;
const ayat = (n: number) => plural(n, { one: 'آية واحدة', two: 'آيتان', few: 'آيات', many: 'آية' });

export function reviewItems(child: ChildProfile, progress?: Map<string, StoredProgress>): ReviewItem[] {
  const s = child.stats ?? {};
  const items: ReviewItem[] = [];
  const doneSurahs = new Set<number>();
  for (const e of list(s.surahsDone)) {
    const n = e.surah;
    if (typeof n !== 'number' || n < 1 || n > 114) continue;
    doneSurahs.add(n);
    const at = asDate(e.at);
    items.push({
      kind: 'surah',
      label: `سورة ${quranMeta.surahName(n)}`,
      meta: `${ayat(quranMeta.ayahCount(n))}${at ? ` · اكتملت في ${hijriDayMonth(at)}` : ''}`,
      state: 'done',
    });
  }
  const doneHadith = new Set<string>();
  const hadithItems: ReviewItem[] = [];
  for (const e of list(s.hadithDone)) {
    try {
      const h = hadithRepo.byId(String(e.id));
      doneHadith.add(h.id);
      const at = asDate(e.at);
      hadithItems.push({
        kind: 'hadith',
        label: `حديث عن ${h.topic}`,
        meta: at ? `اكتمل في ${hijriDayMonth(at)}` : '',
        state: 'done',
      });
    } catch {
      // unknown id — skip
    }
  }
  // This week: the surah and hadith of the lessons not finished yet.
  for (const [id, script] of lessonScripts) {
    if (progress?.get(id)?.progress.completed) continue;
    for (const st of script.steps) {
      if (st.type === 'intro' && !doneSurahs.has(st.surah)) {
        doneSurahs.add(st.surah);
        items.push({
          kind: 'surah',
          label: `سورة ${quranMeta.surahName(st.surah)}`,
          meta: `${ayat(quranMeta.ayahCount(st.surah))} · سورة هذا الأسبوع`,
          state: 'now',
        });
      }
      if (st.type === 'hadith_loop' && !doneHadith.has(st.hadithId)) {
        doneHadith.add(st.hadithId);
        hadithItems.push({
          kind: 'hadith',
          label: `حديث عن ${hadithRepo.byId(st.hadithId).topic}`,
          meta: 'حديث هذا الأسبوع',
          state: 'now',
        });
      }
    }
  }
  return [...items, ...hadithItems];
}
