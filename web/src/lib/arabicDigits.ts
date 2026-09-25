// Arabic-Indic numeral helpers — the UI shows ٠١٢٣٤٥٦٧٨٩ everywhere (CLAUDE.md §4).
// Same behavior as app/lib/core/arabic_digits.dart.
const LATIN = '0123456789';
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹'; // Eastern (Persian/Urdu) keyboards

function map(input: string, from: string[], to: string): string {
  let out = '';
  for (const ch of input) {
    let i = -1;
    for (const set of from) {
      i = set.indexOf(ch);
      if (i >= 0) break;
    }
    out += i >= 0 ? to[i] : ch;
  }
  return out;
}

/** Replaces Latin (and Persian) digits with Arabic-Indic digits. Other characters are kept. */
export const toArabicDigits = (input: string | number): string =>
  map(String(input), [LATIN, PERSIAN], ARABIC_INDIC);

/** Replaces Arabic-Indic (and Persian) digits with Latin digits — for storage/comparison. */
export const toLatinDigits = (input: string): string => map(input, [ARABIC_INDIC, PERSIAN], LATIN);

/** The single Arabic-Indic digit for [ch] if it is any kind of digit, otherwise null. */
export function normalizeDigit(ch: string): string | null {
  if ([...ch].length !== 1) return null;
  if (ARABIC_INDIC.includes(ch)) return ch;
  const i = Math.max(LATIN.indexOf(ch), PERSIAN.indexOf(ch));
  return i >= 0 ? ARABIC_INDIC[i]! : null;
}
