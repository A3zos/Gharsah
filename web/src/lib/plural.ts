import { toArabicDigits } from './arabicDigits';

/**
 * Arabic count phrases: 1 → `one`, 2 → `two`, 3–10 (and 0) → «N few»,
 * 11+ → «N many». e.g. plural(8, { one: 'سورة واحدة', two: 'سورتان', few: 'سور', many: 'سورة' }) → «٨ سور».
 */
export function plural(n: number, f: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  return `${toArabicDigits(n)} ${n >= 3 && n <= 10 ? f.few : n === 0 ? f.few : f.many}`;
}

export const daysPhrase = (n: number) =>
  plural(n, { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يومًا' });
