// The teacher-line bank (ai/CONTRACT.md §5): approved Arabic templates with
// `{slot}`s. INTERIM copy — identical to app/lib/features/lesson/ai/teacher_lines.dart
// (teacherLines.drift.test.ts fails if the two ever differ). Lines marked
// `// REVIEW` aren't in the design and need review before release.
//
// No Quran or hadith text is ever a line or a slot value (GUARDRAILS §1).
//
// English / Indonesian: the same ids in teacherLinesI18n.ts, chosen by the UI language
// (`new TeacherLineBank(lang)`, `resolveIn`). The agent keeps passing the Arabic slot
// values; they are mapped to the language here (surah names, counts, ordinals, hadith
// topics, project copy). A value with no translation keeps that whole line Arabic.
import hadithJson from '@content/hadith/hadith.json';
import projectsJson from '@content/projects/projects.json';
import metaJson from '@content/quran/quran_meta.json';

import { toArabicDigits } from '../lib/arabicDigits';
import {
  HADITH_COPY_I18N,
  PROJECT_COPY_I18N,
  SURAH_NAMES_LATIN,
  TEACHER_CAPTIONS_I18N,
  TEACHER_LINES_I18N,
  WORDS_I18N,
  type LineLang,
  type OtherLang,
  type ProjectCopy,
} from './teacherLinesI18n';

export type { LineLang };

/** A line from the approved bank + its slot values. */
export interface TeacherLine {
  readonly id: string;
  readonly slots?: Readonly<Record<string, string>>;
}

export const line = (id: string, slots?: Record<string, string>): TeacherLine =>
  slots ? { id, slots } : { id };

export const TEACHER_LINES: Readonly<Record<string, string>> = {
  // Frame 18 — intro (no Makki/Madani line: scholars differ, GUARDRAILS §4).
  'greet.evening': 'مساء الخير {name}! أنا معك الآن.',
  'greet.morning': 'صباح الخير {name}! أنا معك الآن.', // REVIEW
  'intro.plan': 'اليوم نحفظ سورة، ثم حديث، وبعدهما مشروعك في البيت.',
  'intro.surah': 'نبدأ بسورة {surah}.',
  'intro.count': 'وهي قصيرة — {countWords} فقط!',
  'intro.ready': 'جاهز نبدأ نحفظ؟',
  // v0.2 — the three memorization stages (REVIEW: not in the design copy).
  'stage.1': 'المرحلة الأولى: نستمع للسورة كاملة، ثم تقرأها مرة.', // REVIEW
  'stage.2': 'المرحلة الثانية: آية آية… كل آية خمس مرات.', // REVIEW
  'stage.3': 'المرحلة الثالثة: السورة كاملة… اقرأها مرتين.', // REVIEW
  'stage1.your_turn': 'دورك… اقرأ السورة كاملة مرة واحدة.', // REVIEW
  'praise.good': 'أحسنت!', // REVIEW
  'full.start': 'اقرأ السورة كاملة… المرة {ordinalTime}.', // REVIEW
  'full.again': 'أحسنت! والآن المرة {ordinalTime}.', // REVIEW
  'full.done': 'ما شاء الله! قرأتها كاملة.', // REVIEW
  'nudge.full': 'أكمل السورة… أنا أسمعك.', // REVIEW
  'manners.redirect': 'نتكلم بهدوء وأدب يا {name}… ونكمل معًا.', // REVIEW
  'review.intro': 'اليوم يوم المراجعة يا {name}… نراجع ما حفظت.', // REVIEW
  'review.surah': 'نراجع سورة {surah}… اقرأها كاملة.', // REVIEW
  // Frame 18 — ayah loop.
  'ayah.repeat_now': 'الآن ردّد بصوتك… {times}.',
  'count.two_left': 'أحسنت… باقي مرتين.',
  'count.one_left': 'ممتاز… باقي مرة.',
  'count.more': 'أحسنت… باقي {remaining} مرات.', // REVIEW (only if repeats > 3)
  'nudge.one_left': 'باقي مرة، هيا…',
  'nudge.two_left': 'باقي مرتين، هيا…', // REVIEW
  'nudge.start': 'هيا… ردّد معي.', // REVIEW
  // Silence is never praised: a nudge + the ayah again; silent again → this, the ayah, then on.
  'nudge.hear_you': 'أنا أسمعك… ردّدها بصوتك', // REVIEW
  'ayah.move_on': 'نسمعها مرة ثانية من القارئ ونكمل', // REVIEW
  'praise.first': 'أحسنت يا {name}… ننتقل للآية {ordinal}.',
  'praise.next': 'ممتاز! ننتقل للآية {ordinal}.',
  'praise.last_left': 'رائع… بقيت الآية الأخيرة.',
  'praise.all_done': 'أحسنت! أتممتها كلها.',
  'surah.complete': 'أتممت سورة {surah} كاملة… أحسنت يا {name}!',
  // Frame 19.
  'surah.done': 'أحسنت يا {name}! أتممت سورة {surah} كاملة.',
  'surah.proud': '{countWords} بصوتك… فخور بك.',
  'surah.next_hadith': 'جاهز ننتقل للحديث؟',
  'surah.go_hadith': 'ممتاز! هيا بنا إلى حديث اليوم.',
  'surah.to_hadith': 'ننتقل الآن لحديث اليوم.',
  'nudge.answer': 'قل: نعم… وننتقل للحديث.', // REVIEW
  // Frame 20 (the hadith itself is never spoken by the teacher).
  'hadith.topic': 'والآن حديث اليوم يا {name}… {hadithTitle}.',
  'hadith.praise': 'أحسنت يا {name}… حفظت حديث اليوم.',
  'hadith.to_project': 'والآن… مشروع اليوم.',
  'hadith.today': 'حديث اليوم عن {topic}.',
  'hadith.soon': 'سنتعلّمه معًا قريبًا بإذن الله.',
  'end.saving': 'لحظة… نحفظ تقدّمك.', // REVIEW
  // Frame 21 (project copy comes from content/projects/projects.json).
  'project.intro': '{projectIntro}',
  'project.tomorrow': '{projectTomorrow}',
  'project.ask': 'تقدر تقول لي: إن شاء الله؟',
  'project.bye': 'أحسنت! أراك غدًا يا {name}.',
  'project.today': 'مشروعك اليوم: {projectTitle}.',
  'project.hint': '{hint}',
  // Frame 22.
  'report.greet.morning': 'صباح الخير يا {name}! اشتقت لك.',
  'report.greet.evening': 'مساء الخير يا {name}! اشتقت لك.', // REVIEW
  'report.ask': '{reportAsk}',
  'report.thanks': 'أحسنت يا {name}… سمعتك، وفرحت بك.',
  'report.to_hadith': 'والآن… حديث اليوم الجديد.',
  // Frame 23.
  'end.praise': 'أحسنت يا {name}! أكملت درس اليوم.',
  'end.ask': 'تقدر تقول لي: أبشر؟',
  'end.bye': 'أحسنت! أراك بكرة يا {name}.',
  'end.see_you': 'أراك غدًا يا {name}.',
  'offscript.ask_parent': 'سؤال جميل! اسأل بابا أو ماما.',
};

/** Captions shown while the teacher is silent — never spoken. */
export const TEACHER_CAPTIONS: Readonly<Record<string, string>> = {
  'ui.listen_ayah': 'استمع للآية… وأنا صامت معك',
  'ui.listen_hadith': 'استمع للحديث… وأنا صامت معك',
  'ui.hearing_ayah': 'أسمعك… ردّد الآية.',
  'ui.hearing_hadith': 'أسمعك… ردّد الحديث.',
  'ui.hearing': 'أسمعك…',
  'ui.hearing_report': 'أسمعك… احكِ لي.',
};

export class TeacherLineBank {
  /** `lang`: the language lines are resolved in (Arabic unless the UI says otherwise). */
  constructor(readonly lang: LineLang = 'ar') {}

  has(id: string): boolean {
    return id in TEACHER_LINES || id in TEACHER_CAPTIONS;
  }

  /** The resolved text. Unknown ids and unfilled slots throw — never a half-filled line. */
  resolve(l: TeacherLine): string {
    return this.lang === 'ar' ? resolveArabic(l) : resolveIn(this.lang, l).text;
  }

  /** «أربع آيات» — the ayah count in words (small counts), else «١٢ آية». */
  static ayatInWords(n: number): string {
    return ayatInWordsAr(n);
  }

  /** «مرة واحدة» / «ثلاث مرات» / «خمس مرات» — how many repeats, in words. */
  static timesInWords(n: number): string {
    return timesInWordsAr(n);
  }

  /** «الأولى» / «الثانية» — which full pass («المرة الأولى»). */
  static ordinalTime(n: number): string {
    return ordinalAr(n);
  }

  /** «الثانية»… feminine ordinal for «الآية». */
  static ordinal(n: number): string {
    return ordinalAr(n);
  }
}

function resolveArabic(l: TeacherLine): string {
  const template = TEACHER_LINES[l.id] ?? TEACHER_CAPTIONS[l.id];
  if (template === undefined) throw new TypeError(`Unknown teacher line ${l.id}`);
  return template.replace(/\{(\w+)\}/g, (_, slot: string) => {
    const v = l.slots?.[slot];
    if (v === undefined) throw new TypeError(`Line ${l.id} needs slot ${slot}`);
    return v;
  });
}

function ayatInWordsAr(n: number): string {
  const words: Record<number, string> = {
    3: 'ثلاث آيات',
    4: 'أربع آيات',
    5: 'خمس آيات',
    6: 'ست آيات',
    7: 'سبع آيات',
    8: 'ثماني آيات',
    9: 'تسع آيات',
    10: 'عشر آيات',
  };
  return words[n] ?? `${toArabicDigits(n)} آية`;
}

function timesInWordsAr(n: number): string {
  const words: Record<number, string> = {
    1: 'مرة واحدة',
    2: 'مرتين',
    3: 'ثلاث مرات',
    4: 'أربع مرات',
    5: 'خمس مرات',
  };
  return words[n] ?? `${toArabicDigits(n)} مرات`;
}

function ordinalAr(n: number): string {
  const words: Record<number, string> = {
    1: 'الأولى',
    2: 'الثانية',
    3: 'الثالثة',
    4: 'الرابعة',
    5: 'الخامسة',
    6: 'السادسة',
    7: 'السابعة',
    8: 'الثامنة',
    9: 'التاسعة',
    10: 'العاشرة',
  };
  return words[n] ?? `رقم ${toArabicDigits(n)}`;
}

// ── English / Indonesian ────────────────────────────────────────────────────

/** The slot that carries the child's first name — passed through as is (on-device only). */
const NAME = 'name';
/** The largest count / ordinal a slot can carry (the longest surah: 286 ayat). */
const MAX_N = 300;

type ProjectField = 'title' | 'intro' | 'tomorrow' | 'reportAsk';
interface ArabicIndex {
  surah: Map<string, number>;
  countWords: Map<string, number>;
  ordinal: Map<string, number>;
  times: Map<string, number>;
  hadith: Map<string, { id: string; field: 'title' | 'topic' }>;
  project: Map<string, { id: string; field: ProjectField }>;
  hint: Map<string, { id: string; index: number }>;
}
let index: ArabicIndex | null = null;

/** Arabic slot value → what it stands for (built once, from our verified content + the helpers). */
function arabicIndex(): ArabicIndex {
  if (index) return index;
  const i: ArabicIndex = {
    surah: new Map(),
    countWords: new Map(),
    ordinal: new Map(),
    times: new Map(),
    hadith: new Map(),
    project: new Map(),
    hint: new Map(),
  };
  for (const s of (metaJson as { surahs: { surah: number; name: string }[] }).surahs) {
    i.surah.set(s.name, s.surah);
  }
  for (let n = 1; n <= MAX_N; n++) {
    i.countWords.set(ayatInWordsAr(n), n);
    i.ordinal.set(ordinalAr(n), n);
    i.times.set(timesInWordsAr(n), n);
  }
  for (const h of (hadithJson as { hadith: { id: string; title: string; topic?: string }[] }).hadith) {
    i.hadith.set(h.title, { id: h.id, field: 'title' });
    if (h.topic) i.hadith.set(h.topic, { id: h.id, field: 'topic' });
  }
  type P = { id: string; hints: string[] } & Record<ProjectField, string>;
  for (const p of (projectsJson as { projects: P[] }).projects) {
    for (const field of ['title', 'intro', 'tomorrow', 'reportAsk'] as const) {
      i.project.set(p[field], { id: p.id, field });
    }
    p.hints.forEach((h, k) => i.hint.set(h, { id: p.id, index: k }));
  }
  index = i;
  return i;
}

const fromArabicDigits = (s: string): number | null => {
  const latin = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  return /^\d+$/.test(latin) ? Number(latin) : null;
};

const PROJECT_SLOT: Record<string, ProjectField> = {
  projectTitle: 'title',
  projectIntro: 'intro',
  projectTomorrow: 'tomorrow',
  reportAsk: 'reportAsk',
};

/** One Arabic slot value in `lang`, or null when it has no translation. */
export function localizeSlot(lang: LineLang, key: string, value: string): string | null {
  if (lang === 'ar' || key === NAME) return value;
  const i = arabicIndex();
  const words = WORDS_I18N[lang];
  switch (key) {
    case 'surah': {
      const s = i.surah.get(value);
      return s ? (SURAH_NAMES_LATIN[s - 1] ?? null) : null;
    }
    case 'countWords': {
      const c = i.countWords.get(value);
      return c ? words.ayatInWords(c) : null;
    }
    case 'ordinal':
    case 'ordinalTime': {
      const o = i.ordinal.get(value);
      return o ? words.ordinal(o) : null;
    }
    case 'times': {
      const t = i.times.get(value);
      return t ? words.timesInWords(t) : null;
    }
    case 'remaining': {
      const r = fromArabicDigits(value);
      return r === null ? null : String(r);
    }
    case 'hadithTitle':
    case 'topic': {
      const h = i.hadith.get(value);
      if (!h || h.field !== (key === 'topic' ? 'topic' : 'title')) return null;
      return HADITH_COPY_I18N[lang][h.id]?.[h.field] ?? null;
    }
    case 'projectTitle':
    case 'projectIntro':
    case 'projectTomorrow':
    case 'reportAsk': {
      const p = i.project.get(value);
      if (!p || p.field !== PROJECT_SLOT[key]) return null;
      return PROJECT_COPY_I18N[lang][p.id]?.[p.field] ?? null;
    }
    case 'hint': {
      const h = i.hint.get(value);
      return h ? (PROJECT_COPY_I18N[lang][h.id]?.hints[h.index] ?? null) : null;
    }
    default:
      return null;
  }
}

const slotKeys = (template: string) => [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];

const templateIn = (lang: OtherLang, id: string): string | undefined =>
  TEACHER_LINES_I18N[lang][id] ?? TEACHER_CAPTIONS_I18N[lang][id];

/**
 * The line's own slots (only those its template uses) with values in `lang`; null when
 * one has no translation. A missing slot throws, as in Arabic.
 */
export function localizedSlots(lang: OtherLang, l: TeacherLine): Record<string, string> | null {
  const template = templateIn(lang, l.id);
  if (template === undefined) return null;
  const out: Record<string, string> = {};
  for (const k of slotKeys(template)) {
    const v = l.slots?.[k];
    if (v === undefined) throw new TypeError(`Line ${l.id} needs slot ${k}`);
    const loc = localizeSlot(lang, k, v);
    if (loc === null) return null;
    out[k] = loc;
  }
  return out;
}

/**
 * Fills an en / id template with already-localized slot values — exactly as ai-speak's
 * resolve.ts does (no case changes), so the server says what the screen would show.
 */
export const fillTemplate = (template: string, slots: Readonly<Record<string, string>>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);

/**
 * The line in `lang` (+ the language it actually came out in): Arabic for 'ar', or when
 * a slot value has no translation yet — never half-translated.
 */
export function resolveIn(lang: LineLang, l: TeacherLine): { text: string; lang: LineLang } {
  if (lang === 'ar') return { text: resolveArabic(l), lang: 'ar' };
  const template = templateIn(lang, l.id);
  if (template === undefined) return { text: resolveArabic(l), lang: 'ar' };
  const slots = localizedSlots(lang, l);
  if (slots === null) return { text: resolveArabic(l), lang: 'ar' };
  return { text: fillTemplate(template, slots), lang };
}

/** The language a line is voiced in for this UI language (Arabic if it can't be translated). */
export function lineLanguage(lang: LineLang, l: TeacherLine): LineLang {
  if (lang === 'ar') return 'ar';
  try {
    return resolveIn(lang, l).lang;
  } catch {
    return 'ar';
  }
}

// ── Display helpers for the lesson screens (Arabic content → the UI language) ──

/** «الإخلاص» → «Al-Ikhlas» in en / id; unknown names stay as they are. */
export function surahNameIn(lang: LineLang, arabicName: string): string {
  return localizeSlot(lang, 'surah', arabicName) ?? arabicName;
}

/** A hadith's title / topic copy in the UI language (Arabic when not translated) — never hadith text. */
export function hadithCopyIn(
  lang: LineLang,
  h: { readonly id?: string; readonly title: string; readonly topic: string },
): { title: string; topic: string } {
  if (lang === 'ar') return { title: h.title, topic: h.topic };
  const known = arabicIndex().hadith;
  const id = h.id ?? known.get(h.title)?.id ?? known.get(h.topic)?.id;
  const copy = id ? HADITH_COPY_I18N[lang][id] : undefined;
  return copy ? { title: copy.title, topic: copy.topic } : { title: h.title, topic: h.topic };
}

/** A server hadith label (its Arabic title or topic) in the UI language, when known. */
export function hadithLabelIn(lang: LineLang, arabic: string): string {
  if (lang === 'ar') return arabic;
  const h = arabicIndex().hadith.get(arabic);
  const copy = h ? HADITH_COPY_I18N[lang][h.id] : undefined;
  return h && copy ? copy[h.field] : arabic;
}

/** A weekly project's copy in the UI language (Arabic when not translated). */
export function projectCopyIn(lang: LineLang, p: ProjectCopy & { readonly id: string }): ProjectCopy {
  if (lang === 'ar') return p;
  return PROJECT_COPY_I18N[lang][p.id] ?? p;
}
