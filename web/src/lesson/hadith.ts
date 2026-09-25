// Hadith entries (content/hadith/hadith.json). Port of hadith_repository.dart.
//
// Guardrail (ai/GUARDRAILS.md §1.3): until a sharia reviewer approves an entry —
// text, takhrij, grading, source, reviewer and audio all present — the app shows
// the fixed placeholder and plays nothing. Approving an entry in the data makes
// it display and play with no code change.

export const HADITH_PLACEHOLDER_TEXT = '[نص حديث برّ الوالدين — يُعتمد لاحقًا من مصدر موثّق مع التخريج]';
export const HADITH_PLACEHOLDER_TAKHRIJ = '[التخريج والدرجة — يُعتمد لاحقًا]';

const REQUIRED = ['text', 'takhrij', 'grading', 'source', 'reviewedBy', 'audio'] as const;

export class Hadith {
  private constructor(
    readonly id: string,
    /** Topic title, e.g. «حديث برّ الوالدين» (not hadith text). */
    readonly title: string,
    /** Short topic for the parent dashboard, e.g. «برّ الوالدين». */
    readonly topic: string,
    readonly isApproved: boolean,
    private readonly _text: string | null,
    private readonly _takhrij: string | null,
    /** Path relative to the content root (e.g. `audio/hadith/x.mp3`) — approved only. */
    readonly audioAsset: string | null,
  ) {}

  static fromJson(j: Record<string, unknown>): Hadith {
    const str = (k: string): string | null => {
      const v = j[k];
      return typeof v === 'string' && v.trim() !== '' ? v : null;
    };
    const complete = REQUIRED.every((k) => str(k) !== null);
    const approved = j.approved === true && complete;
    const title = j.title as string;
    return new Hadith(
      j.id as string,
      title,
      (j.topic as string | undefined) ?? title,
      approved,
      approved ? str('text') : null,
      approved ? `${str('takhrij')} · ${str('grading')}` : null,
      approved ? str('audio') : null,
    );
  }

  get displayText(): string {
    return this.isApproved ? this._text! : HADITH_PLACEHOLDER_TEXT;
  }

  get displayTakhrij(): string {
    return this.isApproved ? this._takhrij! : HADITH_PLACEHOLDER_TAKHRIJ;
  }

  /** The lesson plays audio automatically only for an approved hadith. */
  get canPlay(): boolean {
    return this.isApproved && this.audioAsset !== null;
  }
}

export class HadithRepository {
  private readonly byIdMap: ReadonlyMap<string, Hadith>;

  constructor(all: Iterable<Hadith>) {
    this.byIdMap = new Map([...all].map((h) => [h.id, h]));
  }

  static fromJson(j: { hadith: readonly Record<string, unknown>[] }): HadithRepository {
    return new HadithRepository(j.hadith.map((h) => Hadith.fromJson(h)));
  }

  byId(id: string): Hadith {
    const h = this.byIdMap.get(id);
    if (!h) throw new Error(`Unknown hadith id ${id}`);
    return h;
  }
}
