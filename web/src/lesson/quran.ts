// Quran references and the verified metadata/text (content/quran/*.json, Tanzil).
// Port of app/lib/features/quran/data/{quran_ref,quran_text_repository}.dart.
// Text is only ever looked up by surah:ayah — never embedded, edited or generated.

/** A Quran ayah, referenced by surah:ayah only. */
export interface QuranRef {
  readonly surah: number;
  readonly ayah: number;
}

export const quranRef = (surah: number, ayah: number): QuranRef => ({ surah, ayah });

/** «112:1» — also the Firestore progress format (`doneRefs`). */
export const refKey = (r: QuranRef): string => `${r.surah}:${r.ayah}`;

export const sameRef = (a: QuranRef | undefined, b: QuranRef | undefined): boolean =>
  !!a && !!b && a.surah === b.surah && a.ayah === b.ayah;

export function parseRef(j: unknown): QuranRef {
  const o = j as { surah?: unknown; ayah?: unknown } | null;
  if (typeof o?.surah !== 'number' || typeof o.ayah !== 'number') {
    throw new FormatError(`Bad ayah ref ${JSON.stringify(j)}`);
  }
  return quranRef(o.surah, o.ayah);
}

/** Audio file name, e.g. `112001.mp3`. */
export const audioFileName = (r: QuranRef): string =>
  `${String(r.surah).padStart(3, '0')}${String(r.ayah).padStart(3, '0')}.mp3`;

/** Malformed content (Dart's FormatException). */
export class FormatError extends Error {
  override name = 'FormatError';
}

interface SurahInfo {
  name: string;
  ayat: number;
}

/**
 * Surah names + ayah counts (Tanzil metadata). Deliberately holds no
 * Makki/Madani data (ai/GUARDRAILS.md §4).
 */
export class QuranMeta {
  static readonly totalAyat = 6236;
  private readonly starts: number[];

  constructor(private readonly surahs: readonly SurahInfo[]) {
    if (surahs.length !== 114) throw new FormatError('quran_meta must list 114 surahs');
    let n = 0;
    this.starts = surahs.map((s) => (n += s.ayat) - s.ayat);
    if (n !== QuranMeta.totalAyat) throw new FormatError(`quran_meta totals ${n} ayat`);
  }

  static fromJson(j: { surahs: readonly { name: string; ayat: number }[] }): QuranMeta {
    return new QuranMeta(j.surahs.map((s) => ({ name: s.name, ayat: s.ayat })));
  }

  surahName(surah: number): string {
    return this.surahs[checkSurah(surah) - 1]!.name;
  }

  ayahCount(surah: number): number {
    return this.surahs[checkSurah(surah) - 1]!.ayat;
  }

  isValid(r: QuranRef): boolean {
    return r.surah >= 1 && r.surah <= 114 && r.ayah >= 1 && r.ayah <= this.ayahCount(r.surah);
  }

  /** The global ayah number 1..6236 used by the reciter CDN. */
  globalNumber(r: QuranRef): number {
    if (!this.isValid(r)) throw new RangeError(`Invalid ayah reference ${refKey(r)}`);
    return this.starts[r.surah - 1]! + r.ayah;
  }
}

function checkSurah(s: number): number {
  if (s >= 1 && s <= 114 && Number.isInteger(s)) return s;
  throw new RangeError(`Invalid surah ${s}`);
}

/** Verified ayah text for the lesson surahs — shown exactly as stored. */
export class QuranText {
  private constructor(
    private readonly byKey: ReadonlyMap<string, string>,
    readonly source: string,
  ) {}

  static fromJson(j: {
    source: string;
    ayat: readonly { surah: number; ayah: number; text: string }[];
  }): QuranText {
    return new QuranText(new Map(j.ayat.map((a) => [refKey(a), a.text])), j.source);
  }

  has(r: QuranRef): boolean {
    return this.byKey.has(refKey(r));
  }

  /** Throws if the ayah isn't bundled — lessons may only use bundled surahs. */
  text(r: QuranRef): string {
    const t = this.byKey.get(refKey(r));
    if (t === undefined) throw new Error(`Ayah ${refKey(r)} is not in the verified asset`);
    return t;
  }
}
