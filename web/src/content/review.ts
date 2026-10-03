// What the child has memorized (and what's this week) — names/topics only,
// for the weekly review screen and cards. Built from the server-written stats.
import type { ChildProfile } from '../data/children';
import type { StoredProgress } from '../data/student';
import { countPhrase, fill, MESSAGES, type UiLanguage } from '../i18n/i18n';
import { hijriDayMonth, toDateOrNull } from '../lib/dates';
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
const lookup = (map: Record<string, string>, key: string | number): string | undefined => map[String(key)];

/** «سورة الإخلاص» / «Surah Al-Ikhlas» (en / id names from child.json; else the verified Arabic name). */
export function surahLabel(lang: UiLanguage, n: number): string {
  const t = MESSAGES[lang].child;
  const name = lang === 'ar' ? quranMeta.surahName(n) : (lookup(t.surahs, n) ?? quranMeta.surahName(n));
  return fill(lang, t.surahName, { name });
}

/** A hadith's topic («برّ الوالدين» / «Kindness to parents») — never its text. */
export function hadithTopic(lang: UiLanguage, id: string): string {
  const h = hadithRepo.byId(id);
  return lang === 'ar' ? h.topic : (lookup(MESSAGES[lang].child.hadithTopics, h.id) ?? h.topic);
}

/** A hadith's title («حديث برّ الوالدين» / «Hadith on kindness to parents») — never its text. */
export function hadithTitle(lang: UiLanguage, id: string): string {
  const h = hadithRepo.byId(id);
  return lang === 'ar' ? h.title : (lookup(MESSAGES[lang].child.hadithTitles, h.id) ?? h.title);
}

/** «١٤ رجب» in Arabic (as before); the Hijri day + month in en / id. */
export function dayMonth(lang: UiLanguage, d: Date): string {
  if (lang === 'ar') return hijriDayMonth(d);
  return new Intl.DateTimeFormat(`${lang}-u-ca-islamic-umalqura`, {
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function reviewItems(
  child: ChildProfile,
  progress?: Map<string, StoredProgress>,
  lang: UiLanguage = 'ar',
): ReviewItem[] {
  const t = MESSAGES[lang].child;
  const ayat = (n: number) => countPhrase(lang, n, t.count.ayat);
  const about = (id: string) => fill(lang, t.hadithAbout, { topic: hadithTopic(lang, id) });
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
      label: surahLabel(lang, n),
      meta: `${ayat(quranMeta.ayahCount(n))}${at ? fill(lang, t.reviewItems.completedOn, { date: dayMonth(lang, at) }) : ''}`,
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
        label: about(h.id),
        meta: at ? fill(lang, t.reviewItems.hadithDoneOn, { date: dayMonth(lang, at) }) : '',
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
          label: surahLabel(lang, st.surah),
          meta: `${ayat(quranMeta.ayahCount(st.surah))}${t.reviewItems.surahThisWeek}`,
          state: 'now',
        });
      }
      if (st.type === 'hadith_loop' && !doneHadith.has(st.hadithId)) {
        doneHadith.add(st.hadithId);
        hadithItems.push({
          kind: 'hadith',
          label: about(st.hadithId),
          meta: t.reviewItems.hadithThisWeek,
          state: 'now',
        });
      }
    }
  }
  return [...items, ...hadithItems];
}
