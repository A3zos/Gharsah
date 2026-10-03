// Fails when Arabic text appears in a component (.tsx) outside the allow-list: every
// user-facing word must come from the locale files (ar.json / ar/<area>.json are the
// source of truth). Quran / hadith content and the brand are the allowed exceptions.
const sources = import.meta.glob<string>(['../**/*.tsx', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const AR = /[؀-ۿ]/;
const BRAND = 'غَرْسة';

/** file → Arabic literals allowed there, each with its reason. */
const ALLOWED: Record<string, readonly string[]> = {
  // content lookup keys (the verified hadith topic / surah name passed to the mushaf
  // banner and the basmala) — data, not UI words
  '../components/landing/LivePhone.tsx': ['برّ الوالدين', 'الإخلاص'],
  // the Arabic branch / default of a surah heading (en / id pass their own label)
  '../components/lesson/LessonView.tsx': ["سورة ${s.surahName ?? ''}"],
  '../components/lesson/Mushaf.tsx': ['سورة ${name}'],
  // the avatar square when a parent has no name (a punctuation mark)
  '../components/parent/ParentData.tsx': ['؟'],
  // the route meta (prerender / first paint, Arabic); the tab title follows the language
  '../routes/child/lesson.tsx': ['الحصة — غَرْسة'],
};

function arabicLiterals(src: string): string[] {
  const code = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out: string[] = [];
  for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (AR.test(m[2]!)) out.push(m[2]!);
  // JSX text between tags (strings already found are removed first)
  const noStrings = code.replace(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g, '""');
  for (const m of noStrings.matchAll(/>([^<>{}]*)</g)) if (AR.test(m[1]!)) out.push(m[1]!.trim());
  return out;
}

test.each(Object.keys(sources))('%s: no Arabic UI text outside the locale files', (file) => {
  const allowed = new Set([BRAND, ...(ALLOWED[file] ?? [])]);
  const found = arabicLiterals(sources[file]!).filter((s) => !allowed.has(s));
  expect(found, `move these to src/i18n/ar…json (or allow-list them with a reason)`).toEqual([]);
});
