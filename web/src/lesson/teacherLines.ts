// The teacher-line bank (ai/CONTRACT.md §5): approved Arabic templates with
// `{slot}`s. INTERIM copy — identical to app/lib/features/lesson/ai/teacher_lines.dart
// (teacherLines.drift.test.ts fails if the two ever differ). Lines marked
// `// REVIEW` aren't in the design and need review before release.
//
// No Quran or hadith text is ever a line or a slot value (GUARDRAILS §1).
import { toArabicDigits } from '../lib/arabicDigits';

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
  has(id: string): boolean {
    return id in TEACHER_LINES || id in TEACHER_CAPTIONS;
  }

  /** The resolved text. Unknown ids and unfilled slots throw — never a half-filled line. */
  resolve(l: TeacherLine): string {
    const template = TEACHER_LINES[l.id] ?? TEACHER_CAPTIONS[l.id];
    if (template === undefined) throw new TypeError(`Unknown teacher line ${l.id}`);
    return template.replace(/\{(\w+)\}/g, (_, slot: string) => {
      const v = l.slots?.[slot];
      if (v === undefined) throw new TypeError(`Line ${l.id} needs slot ${slot}`);
      return v;
    });
  }

  /** «أربع آيات» — the ayah count in words (small counts), else «١٢ آية». */
  static ayatInWords(n: number): string {
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

  /** «مرة واحدة» / «ثلاث مرات» / «خمس مرات» — how many repeats, in words. */
  static timesInWords(n: number): string {
    const words: Record<number, string> = {
      1: 'مرة واحدة',
      2: 'مرتين',
      3: 'ثلاث مرات',
      4: 'أربع مرات',
      5: 'خمس مرات',
    };
    return words[n] ?? `${toArabicDigits(n)} مرات`;
  }

  /** «الأولى» / «الثانية» — which full pass («المرة الأولى»). */
  static ordinalTime(n: number): string {
    return TeacherLineBank.ordinal(n);
  }

  /** «الثانية»… feminine ordinal for «الآية». */
  static ordinal(n: number): string {
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
}
