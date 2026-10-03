// The teacher-line bank in English and Indonesian: the SAME line ids as the Arabic
// bank (teacherLines.ts — Arabic stays the source of truth, byte-identical), chosen
// by the UI language at runtime. Translated for meaning, warm and simple, never adding
// a claim the Arabic doesn't make (GLOSSARY.md: champ / jagoan, Setoran / Menirukan…).
//
// Never Quran or hadith text, and never a translation of either: ayat and hadith are
// played by the reciter / shown in Arabic only. Slot values (surah names, counts,
// ordinals, hadith topics, project copy) have per-language values below; a value with
// no translation keeps the whole line in Arabic (teacherLines.ts `resolveIn`).
//
// Mirrored to supabase/functions/ai-speak/lines.{en,id}.json (+ slots.{en,id}.json) —
// teacherLines.drift.test.ts / aiSpeakSlots.test.ts fail if they drift.

/** A language the teacher's fixed lines exist in. */
export type LineLang = 'ar' | 'en' | 'id';
export type OtherLang = Exclude<LineLang, 'ar'>;
export const OTHER_LANGS: readonly OtherLang[] = ['en', 'id'];

export const TEACHER_LINES_I18N: Readonly<Record<OtherLang, Readonly<Record<string, string>>>> = {
  en: {
    'greet.evening': "Hi {name}! I'm here with you now.",
    'greet.morning': "Good morning, {name}! I'm here with you now.",
    'intro.plan': "Today we'll memorize a surah, then a hadith, and after that comes your project at home.",
    'intro.surah': "Let's start with Surah {surah}.",
    'intro.count': "It's short — only {countWords}!",
    'intro.ready': 'Ready to start memorizing?',
    'stage.1': 'Stage one: we listen to the whole surah, then you read it once.',
    'stage.2': 'Stage two: ayah by ayah… each ayah five times.',
    'stage.3': 'Stage three: the whole surah… read it twice.',
    'stage1.your_turn': 'Your turn… read the whole surah once.',
    'praise.good': 'Well done!',
    'full.start': 'Read the whole surah… for the {ordinalTime} time.',
    'full.again': 'Well done! Now for the {ordinalTime} time.',
    'full.done': 'Masha Allah! You read it all the way through.',
    'nudge.full': "Keep going with the surah… I'm listening.",
    'manners.redirect': "Let's speak calmly and politely, {name}… and carry on together.",
    'review.intro': "Today is review day, {name}… let's review what you've memorized.",
    'review.surah': "Let's review Surah {surah}… read the whole surah.",
    'ayah.repeat_now': 'Now repeat it out loud… {times}.',
    'count.two_left': 'Well done… two more times.',
    'count.one_left': 'Excellent… one more time.',
    'count.more': 'Well done… {remaining} more times.',
    'nudge.one_left': 'One more time, come on…',
    'nudge.two_left': 'Two more times, come on…',
    'nudge.start': 'Come on… repeat after me.',
    'nudge.hear_you': "I'm listening… say it out loud",
    'ayah.move_on': "Let's hear it once more from the reciter, then carry on",
    'praise.first': 'Well done, {name}… on to the {ordinal} ayah.',
    'praise.next': 'Excellent! On to the {ordinal} ayah.',
    'praise.last_left': 'Wonderful… just the last ayah left.',
    'praise.all_done': 'Well done! You finished them all.',
    'surah.complete': 'You finished all of Surah {surah}… well done, {name}!',
    'surah.done': 'Well done, {name}! You finished all of Surah {surah}.',
    'surah.proud': "You said {countWords} in your own voice… I'm proud of you.",
    'surah.next_hadith': 'Ready to move on to the hadith?',
    'surah.go_hadith': "Excellent! Let's go to today's hadith.",
    'surah.to_hadith': "Now let's move on to today's hadith.",
    'nudge.answer': "Say: yes… and we'll move on to the hadith.",
    'hadith.topic': "And now today's hadith, {name}… {hadithTitle}.",
    'hadith.praise': "Well done, {name}… you memorized today's hadith.",
    'hadith.to_project': "And now… today's project.",
    'hadith.today': "Today's hadith is about {topic}.",
    'hadith.soon': "We'll learn it together soon, in sha Allah.",
    'end.saving': 'One moment… saving your progress.',
    'project.intro': '{projectIntro}',
    'project.tomorrow': '{projectTomorrow}',
    'project.ask': 'Can you say to me: in sha Allah?',
    'project.bye': 'Well done! See you tomorrow, {name}.',
    'project.today': 'Your project today: {projectTitle}.',
    'project.hint': '{hint}',
    'report.greet.morning': 'Good morning, {name}! I missed you.',
    'report.greet.evening': 'Hi {name}! I missed you.',
    'report.ask': '{reportAsk}',
    'report.thanks': "Well done, {name}… I heard you, and I'm so happy.",
    'report.to_hadith': "And now… today's new hadith.",
    'end.praise': "Well done, {name}! You finished today's lesson.",
    'end.ask': 'Can you say to me: I will?',
    'end.bye': 'Well done! See you tomorrow, {name}.',
    'end.see_you': 'See you tomorrow, {name}.',
    'offscript.ask_parent': 'Great question! Ask Mom or Dad.',
  },
  id: {
    'greet.evening': 'Selamat sore, {name}! Aku di sini bersamamu sekarang.',
    'greet.morning': 'Selamat pagi, {name}! Aku di sini bersamamu sekarang.',
    'intro.plan': 'Hari ini kita menghafal satu surah, lalu satu hadis, setelah itu proyekmu di rumah.',
    'intro.surah': 'Kita mulai dengan Surah {surah}.',
    'intro.count': 'Surahnya pendek — hanya {countWords}!',
    'intro.ready': 'Siap mulai menghafal?',
    'stage.1': 'Tahap pertama: kita dengarkan seluruh surahnya, lalu kamu membacanya sekali.',
    'stage.2': 'Tahap kedua: ayat demi ayat… setiap ayat lima kali.',
    'stage.3': 'Tahap ketiga: seluruh surah… bacalah dua kali.',
    'stage1.your_turn': 'Giliranmu… baca seluruh surahnya satu kali.',
    'praise.good': 'Bagus sekali!',
    'full.start': 'Baca seluruh surahnya… kali {ordinalTime}.',
    'full.again': 'Bagus sekali! Sekarang kali {ordinalTime}.',
    'full.done': 'Masya Allah! Kamu membacanya sampai selesai.',
    'nudge.full': 'Lanjutkan surahnya… aku mendengarkan.',
    'manners.redirect': 'Kita bicara dengan tenang dan sopan ya, {name}… lalu kita lanjutkan bersama.',
    'review.intro': 'Hari ini hari murajaah, {name}… kita ulang hafalanmu.',
    'review.surah': 'Kita murajaah Surah {surah}… bacalah seluruhnya.',
    'ayah.repeat_now': 'Sekarang tirukan dengan suaramu… {times}.',
    'count.two_left': 'Bagus… tinggal dua kali lagi.',
    'count.one_left': 'Hebat… tinggal sekali lagi.',
    'count.more': 'Bagus… tinggal {remaining} kali lagi.',
    'nudge.one_left': 'Sekali lagi, ayo…',
    'nudge.two_left': 'Dua kali lagi, ayo…',
    'nudge.start': 'Ayo… tirukan bersamaku.',
    'nudge.hear_you': 'Aku mendengarkan… ucapkan dengan suaramu',
    'ayah.move_on': 'Kita dengarkan sekali lagi dari qari, lalu kita lanjutkan',
    'praise.first': 'Bagus sekali, {name}… kita lanjut ke ayat {ordinal}.',
    'praise.next': 'Hebat! Kita lanjut ke ayat {ordinal}.',
    'praise.last_left': 'Luar biasa… tinggal ayat terakhir.',
    'praise.all_done': 'Bagus sekali! Kamu sudah menyelesaikan semuanya.',
    'surah.complete': 'Kamu sudah menyelesaikan seluruh Surah {surah}… bagus sekali, {name}!',
    'surah.done': 'Bagus sekali, {name}! Kamu sudah menyelesaikan seluruh Surah {surah}.',
    'surah.proud': 'Kamu membaca {countWords} dengan suaramu sendiri… aku bangga padamu.',
    'surah.next_hadith': 'Siap lanjut ke hadis?',
    'surah.go_hadith': 'Hebat! Ayo kita ke hadis hari ini.',
    'surah.to_hadith': 'Sekarang kita lanjut ke hadis hari ini.',
    'nudge.answer': 'Katakan: ya… lalu kita lanjut ke hadis.',
    'hadith.topic': 'Dan sekarang hadis hari ini, {name}… {hadithTitle}.',
    'hadith.praise': 'Bagus sekali, {name}… kamu sudah menghafal hadis hari ini.',
    'hadith.to_project': 'Dan sekarang… proyek hari ini.',
    'hadith.today': 'Hadis hari ini tentang {topic}.',
    'hadith.soon': 'Kita akan mempelajarinya bersama sebentar lagi, insya Allah.',
    'end.saving': 'Sebentar… kita simpan kemajuanmu.',
    'project.intro': '{projectIntro}',
    'project.tomorrow': '{projectTomorrow}',
    'project.ask': 'Bisa bilang ke aku: insya Allah?',
    'project.bye': 'Bagus sekali! Sampai jumpa besok, {name}.',
    'project.today': 'Proyekmu hari ini: {projectTitle}.',
    'project.hint': '{hint}',
    'report.greet.morning': 'Selamat pagi, {name}! Aku kangen kamu.',
    'report.greet.evening': 'Selamat sore, {name}! Aku kangen kamu.',
    'report.ask': '{reportAsk}',
    'report.thanks': 'Bagus sekali, {name}… aku sudah mendengarmu, dan aku senang sekali.',
    'report.to_hadith': 'Dan sekarang… hadis baru hari ini.',
    'end.praise': 'Bagus sekali, {name}! Kamu sudah menyelesaikan pelajaran hari ini.',
    'end.ask': 'Bisa bilang ke aku: siap?',
    'end.bye': 'Bagus sekali! Sampai jumpa besok, {name}.',
    'end.see_you': 'Sampai jumpa besok, {name}.',
    'offscript.ask_parent': 'Pertanyaan yang bagus! Tanyakan ke Ayah atau Ibu.',
  },
};

/** Captions shown while the teacher is silent — never spoken. */
export const TEACHER_CAPTIONS_I18N: Readonly<Record<OtherLang, Readonly<Record<string, string>>>> = {
  en: {
    'ui.listen_ayah': "Listen to the ayah… I'm quiet with you",
    'ui.listen_hadith': "Listen to the hadith… I'm quiet with you",
    'ui.hearing_ayah': "I'm listening… repeat the ayah.",
    'ui.hearing_hadith': "I'm listening… repeat the hadith.",
    'ui.hearing': "I'm listening…",
    'ui.hearing_report': "I'm listening… tell me.",
  },
  id: {
    'ui.listen_ayah': 'Dengarkan ayatnya… aku diam bersamamu',
    'ui.listen_hadith': 'Dengarkan hadisnya… aku diam bersamamu',
    'ui.hearing_ayah': 'Aku mendengarkan… tirukan ayatnya.',
    'ui.hearing_hadith': 'Aku mendengarkan… tirukan hadisnya.',
    'ui.hearing': 'Aku mendengarkan…',
    'ui.hearing_report': 'Aku mendengarkan… ceritakan padaku.',
  },
};

/** The 114 surah names, standard transliteration (GLOSSARY.md) — the same in English and Indonesian. */
export const SURAH_NAMES_LATIN: readonly string[] = [
  'Al-Fatihah',
  'Al-Baqarah',
  "Ali 'Imran",
  "An-Nisa'",
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  'Al-Anfal',
  'At-Tawbah',
  'Yunus',
  'Hud',
  'Yusuf',
  "Ar-Ra'd",
  'Ibrahim',
  'Al-Hijr',
  'An-Nahl',
  "Al-Isra'",
  'Al-Kahf',
  'Maryam',
  'Taha',
  "Al-Anbiya'",
  'Al-Hajj',
  "Al-Mu'minun",
  'An-Nur',
  'Al-Furqan',
  "Ash-Shu'ara'",
  'An-Naml',
  'Al-Qasas',
  "Al-'Ankabut",
  'Ar-Rum',
  'Luqman',
  'As-Sajdah',
  'Al-Ahzab',
  "Saba'",
  'Fatir',
  'Ya-Sin',
  'As-Saffat',
  'Sad',
  'Az-Zumar',
  'Ghafir',
  'Fussilat',
  'Ash-Shura',
  'Az-Zukhruf',
  'Ad-Dukhan',
  'Al-Jathiyah',
  'Al-Ahqaf',
  'Muhammad',
  'Al-Fath',
  'Al-Hujurat',
  'Qaf',
  'Adh-Dhariyat',
  'At-Tur',
  'An-Najm',
  'Al-Qamar',
  'Ar-Rahman',
  "Al-Waqi'ah",
  'Al-Hadid',
  'Al-Mujadilah',
  'Al-Hashr',
  'Al-Mumtahanah',
  'As-Saff',
  "Al-Jumu'ah",
  'Al-Munafiqun',
  'At-Taghabun',
  'At-Talaq',
  'At-Tahrim',
  'Al-Mulk',
  'Al-Qalam',
  'Al-Haqqah',
  "Al-Ma'arij",
  'Nuh',
  'Al-Jinn',
  'Al-Muzzammil',
  'Al-Muddaththir',
  'Al-Qiyamah',
  'Al-Insan',
  'Al-Mursalat',
  "An-Naba'",
  "An-Nazi'at",
  "'Abasa",
  'At-Takwir',
  'Al-Infitar',
  'Al-Mutaffifin',
  'Al-Inshiqaq',
  'Al-Buruj',
  'At-Tariq',
  "Al-A'la",
  'Al-Ghashiyah',
  'Al-Fajr',
  'Al-Balad',
  'Ash-Shams',
  'Al-Layl',
  'Ad-Duha',
  'Ash-Sharh',
  'At-Tin',
  "Al-'Alaq",
  'Al-Qadr',
  'Al-Bayyinah',
  'Az-Zalzalah',
  "Al-'Adiyat",
  "Al-Qari'ah",
  'At-Takathur',
  "Al-'Asr",
  'Al-Humazah',
  'Al-Fil',
  'Quraysh',
  "Al-Ma'un",
  'Al-Kawthar',
  'Al-Kafirun',
  'An-Nasr',
  'Al-Masad',
  'Al-Ikhlas',
  'Al-Falaq',
  'An-Nas',
];

/** Hadith topic copy (content/hadith/hadith.json `title` / `topic`) — never hadith text. */
export const HADITH_COPY_I18N: Readonly<
  Record<OtherLang, Readonly<Record<string, { title: string; topic: string }>>>
> = {
  en: {
    'PLACEHOLDER-birr-alwalidayn': { title: 'Hadith on kindness to parents', topic: 'kindness to parents' },
    'PLACEHOLDER-al-kadhib': { title: 'Hadith on lying', topic: 'lying' },
    'PLACEHOLDER-al-ghadab': { title: 'Hadith on anger', topic: 'anger' },
  },
  id: {
    'PLACEHOLDER-birr-alwalidayn': {
      title: 'Hadis tentang berbakti kepada orang tua',
      topic: 'berbakti kepada orang tua',
    },
    'PLACEHOLDER-al-kadhib': { title: 'Hadis tentang berbohong', topic: 'berbohong' },
    'PLACEHOLDER-al-ghadab': { title: 'Hadis tentang amarah', topic: 'amarah' },
  },
};

export interface ProjectCopy {
  readonly title: string;
  readonly intro: string;
  readonly tomorrow: string;
  readonly reportAsk: string;
  readonly hints: readonly string[];
}

/** Weekly project copy (content/projects/projects.json) — not religious text. */
export const PROJECT_COPY_I18N: Readonly<Record<OtherLang, Readonly<Record<string, ProjectCopy>>>> = {
  en: {
    'birr-3-acts': {
      title: 'Be kind to your parents today with a good deed',
      intro:
        'Your project: be kind to your parents today with a good deed — help your mom, do what your dad asks, or make them both happy.',
      tomorrow: 'Tomorrow, before the lesson, tell me how you were kind to your parents.',
      reportAsk: 'Tell me how you were kind to your parents yesterday.',
      hints: [
        'Choose one good deed for your parents today',
        'Do it just between you and them',
        'Tomorrow, tell me what you did',
      ],
    },
  },
  id: {
    'birr-3-acts': {
      title: 'Berbakti kepada orang tuamu hari ini dengan satu perbuatan',
      intro:
        'Proyekmu: berbakti kepada orang tuamu hari ini dengan satu perbuatan — bantu ibumu, patuhi ayahmu, atau buat mereka berdua senang.',
      tomorrow: 'Besok, sebelum pelajaran, ceritakan padaku bagaimana kamu berbakti kepada orang tuamu.',
      reportAsk: 'Ceritakan padaku bagaimana kamu berbakti kepada orang tuamu kemarin.',
      hints: [
        'Pilih satu perbuatan untuk berbakti kepada orang tuamu hari ini',
        'Lakukan cukup antara kamu dan mereka',
        'Besok ceritakan padaku apa yang kamu lakukan',
      ],
    },
  },
};

const EN_SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ID_SMALL = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
];
const EN_ORD = [
  '',
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];
const ID_ORD = [
  '',
  'pertama',
  'kedua',
  'ketiga',
  'keempat',
  'kelima',
  'keenam',
  'ketujuh',
  'kedelapan',
  'kesembilan',
  'kesepuluh',
];

const enSuffix = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
};

/** The bank's word helpers (TeacherLineBank.ayatInWords / timesInWords / ordinal) per language. */
export const WORDS_I18N: Readonly<
  Record<
    OtherLang,
    {
      ayatInWords(n: number): string;
      timesInWords(n: number): string;
      ordinal(n: number): string;
    }
  >
> = {
  en: {
    ayatInWords: (n) =>
      n === 1 ? 'one ayah' : n >= 2 && n <= 10 ? `${EN_SMALL[n]} ayat` : `${n} ${n === 1 ? 'ayah' : 'ayat'}`,
    timesInWords: (n) =>
      n === 1 ? 'once' : n === 2 ? 'twice' : n <= 10 ? `${EN_SMALL[n]} times` : `${n} times`,
    ordinal: (n) => (n >= 1 && n <= 10 ? EN_ORD[n]! : `${n}${enSuffix(n)}`),
  },
  id: {
    ayatInWords: (n) => (n >= 1 && n <= 10 ? `${ID_SMALL[n]} ayat` : `${n} ayat`),
    timesInWords: (n) => (n === 1 ? 'sekali' : n >= 2 && n <= 10 ? `${ID_SMALL[n]} kali` : `${n} kali`),
    ordinal: (n) => (n >= 1 && n <= 10 ? ID_ORD[n]! : `ke-${n}`),
  },
};
