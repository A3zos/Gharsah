// Pure (no Deno / network): resolves an approved teacher line from its id + slot
// values. Shared by the ai-speak function and its unit test (web/ vitest).
// Only a bank line; its slots must be exactly the ones the line uses, each value
// from the allow-list (slots.json, built from our verified content). The child's
// name never comes here: any `name` slot is refused. The Quranic-mark check is a
// second layer on top of the allow-list.

export const MAX_TEXT_CHARS = 400;
export const NAME_SLOT = 'name';
// ﴾ ﴿, Quranic annotation signs (U+0610–061A, U+06D6–06ED), alef wasla, extended marks.
export const QURANIC = /[\uFD3E\uFD3F\u0610-\u061A\u06D6-\u06ED\u0671\u08D3-\u08FF]/;

export type Refusal = 'unknown-line' | 'name-slot' | 'bad-slot';

/** The languages ai-speak voices: one approved bank + slot allow-list each. */
export type LineLang = 'ar' | 'en' | 'id';
export const LINE_LANGS: readonly LineLang[] = ['ar', 'en', 'id'];
/** Names the language of every answer once it is known; the client checks it for en / id. */
export const LINE_LANG_HEADER = 'X-Line-Lang';

export interface Bank {
  lines: Record<string, string>;
  slots: Record<string, readonly string[]>;
}
export type Banks = Record<LineLang, Bank>;

/** The request's `lang` (absent → Arabic, as before) → its bank; null for anything else. */
export function pickBank(banks: Banks, lang: unknown): { lang: LineLang; bank: Bank } | null {
  if (lang === undefined || lang === null) return { lang: 'ar', bank: banks.ar };
  if (typeof lang !== 'string' || !(LINE_LANGS as readonly string[]).includes(lang)) return null;
  return { lang: lang as LineLang, bank: banks[lang as LineLang] };
}

/** The approved line with its slots filled, or why it is refused. */
export function resolveLine(
  lines: Record<string, string>,
  allow: Record<string, readonly string[]>,
  id: unknown,
  slots: unknown,
): { text: string } | { refused: Refusal } {
  if (typeof id !== 'string' || !Object.hasOwn(lines, id)) return { refused: 'unknown-line' };
  if (slots !== undefined && (slots === null || typeof slots !== 'object' || Array.isArray(slots))) {
    return { refused: 'bad-slot' };
  }
  const values = (slots ?? {}) as Record<string, unknown>;
  const template = lines[id]!;
  const used = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
  const given = Object.keys(values);
  if (given.includes(NAME_SLOT) || used.includes(NAME_SLOT)) return { refused: 'name-slot' };
  // Exactly the line's own slots — nothing extra, nothing missing.
  if (given.length !== new Set(used).size || !given.every((k) => used.includes(k))) {
    return { refused: 'bad-slot' };
  }
  for (const k of given) {
    const v = values[k];
    if (typeof v !== 'string' || !Object.hasOwn(allow, k) || !allow[k]!.includes(v) || QURANIC.test(v)) {
      return { refused: 'bad-slot' };
    }
  }
  const text = template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] as string);
  return text.length > MAX_TEXT_CHARS ? { refused: 'bad-slot' } : { text };
}
