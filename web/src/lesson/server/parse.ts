// The AI server's /agent/* responses (ai/API_web.md §2) → one checked ServerTurn.
// Defensive: every field is validated, unknown values fall back to safe ones, and
// a response without a session_id is rejected. Nothing here is shown as religious
// text — the lesson renders ayat from the verified local asset (see serverLesson).
//
// Ayah numbers are normalized HERE and only here. Checked against the live server
// (2026-10-03, Al-Ikhlas): show_ayat `first` / `current` and play_ayah `ayah` are all
// 1-based ayah NUMBERS (the first repeat is play_ayah 1 + show_ayat current 1; the
// whole surah is show_ayat without `current`). The turn's `ayah` is the one ayah the
// child hears, sees highlighted and is asked to repeat.

export type AgentMode = 'quran' | 'hadith';
/** Which session the turn belongs to. `kind` is only trusted for taseem/htaseem (it is
 *  absent on the main quran path) — otherwise the mode we started with decides. */
export type TurnKind = AgentMode | 'taseem' | 'htaseem';
export type Expects = 'text' | 'continue' | 'repeat' | 'choice' | 'none';

export interface AgentStage {
  readonly id: string;
  readonly label: string;
}

export type AgentAction =
  | {
      readonly type: 'show_ayat';
      readonly ayat: readonly string[];
      /** Ayah number (1-based) of ayat[0] (quran; 1 when absent). */
      readonly first: number;
      /** The ayah to highlight — a 1-based ayah number; null = the whole passage. */
      readonly current: number | null;
      readonly surahName: string | null;
      readonly hadithTitle: string | null;
      readonly source: string | null;
    }
  | { readonly type: 'show_words'; readonly words: readonly { word: string; meaning: string }[] }
  | { readonly type: 'play_all'; readonly urls: readonly string[] }
  | { readonly type: 'play_ayah'; readonly ayah: number; readonly text: string; readonly url: string };

export interface ServerTurn {
  readonly sessionId: string;
  readonly kind: TurnKind;
  readonly teacher: string;
  readonly female: boolean;
  readonly stage: string;
  readonly stageIndex: number;
  readonly maxStageIndex: number;
  readonly stages: readonly AgentStage[];
  readonly say: string;
  readonly actions: readonly AgentAction[];
  readonly expects: Expects;
  readonly quickReplies: readonly string[];
  /** The one ayah (1-based) this turn plays, highlights and asks for; null = none / the whole surah. */
  readonly ayah: number | null;
  readonly surahNo: number | null;
  readonly lessonTitle: string | null;
  readonly hadithTitle: string | null;
  /** Ayah numbers in recitation_scores (quran). */
  readonly recitedAyat: readonly number[];
  /** Hadith ids in recitation_scores (hadith). */
  readonly hadithIds: readonly number[];
}

export class TurnParseError extends Error {
  override name = 'TurnParseError';
}

type Obj = Record<string, unknown>;
const EXPECTS: readonly Expects[] = ['text', 'continue', 'repeat', 'choice', 'none'];
/** Ayah audio is only ever played from the reciter host the server documents. */
const AUDIO_HOSTS = ['everyayah.com'];

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v)
    ? v
    : typeof v === 'string' && /^\d+$/.test(v)
      ? Number(v)
      : null;
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** https URLs on the documented reciter host only (anything else is dropped). */
export function safeAudioUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    return AUDIO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseAction(a: unknown): AgentAction | null {
  if (!isObj(a)) return null;
  switch (a.type) {
    case 'show_ayat': {
      const ayat = Array.isArray(a.ayat) ? a.ayat.map((x) => (typeof x === 'string' ? x : '')) : [];
      const first = Math.max(1, int(a.first) ?? 1);
      // 1-based ayah number within the passage shown; anything else → no highlight (never guessed).
      const cur = int(a.current);
      const current =
        cur !== null && cur >= first && (ayat.length === 0 || cur < first + ayat.length) ? cur : null;
      return {
        type: 'show_ayat',
        ayat,
        first,
        current,
        surahName: str(a.surah_name),
        hadithTitle: str(a.hadith_title),
        source: str(a.source),
      };
    }
    case 'show_words':
      return {
        type: 'show_words',
        words: (Array.isArray(a.words) ? a.words : [])
          .filter(isObj)
          .map((w) => ({ word: str(w.word) ?? '', meaning: str(w.meaning) ?? '' }))
          .filter((w) => w.word),
      };
    case 'play_all': {
      const urls = (Array.isArray(a.urls) ? a.urls : []).map(safeAudioUrl).filter((u): u is string => !!u);
      return urls.length ? { type: 'play_all', urls } : null;
    }
    case 'play_ayah': {
      const url = safeAudioUrl(a.url);
      const ayah = int(a.ayah); // 1-based
      return url && ayah !== null && ayah >= 1
        ? { type: 'play_ayah', ayah, text: str(a.text) ?? '', url }
        : null;
    }
    default:
      return null; // set_step (documented as unused) and anything unknown
  }
}

function parseStages(v: unknown): AgentStage[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .map((s) => ({ id: str(s.id) ?? String(s.id ?? ''), label: str(s.label) ?? '' }))
    .filter((s) => s.id);
}

function scoreIds(v: unknown, key: 'ayah' | 'hadith'): number[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<number>();
  for (const r of v)
    if (isObj(r)) {
      const n = int(r[key]);
      if (n !== null) out.add(n);
    }
  return [...out];
}

export function parseTurn(json: unknown, mode: AgentMode): ServerTurn {
  if (!isObj(json)) throw new TurnParseError('Response is not an object');
  const sessionId = str(json.session_id);
  if (!sessionId) throw new TurnParseError('Response has no session_id');
  const kind: TurnKind = json.kind === 'taseem' || json.kind === 'htaseem' ? json.kind : mode;
  const stages = parseStages(json.stages);
  const last = Math.max(0, stages.length - 1);
  const clampIdx = (n: number | null) => Math.min(last, Math.max(0, n ?? 0));
  const stageIndex = clampIdx(int(json.stage_index));
  const maxStageIndex = Math.max(stageIndex, clampIdx(int(json.max_stage_index)));
  const expects = EXPECTS.find((e) => e === json.expects) ?? 'continue';
  const parsed = (Array.isArray(json.actions) ? json.actions : [])
    .map(parseAction)
    .filter((a): a is AgentAction => a !== null);
  // The ayah played is the ayah highlighted and asked for: show_ayat follows play_ayah.
  const played = parsed.find((a) => a.type === 'play_ayah')?.ayah ?? null;
  const actions = parsed.map((a) =>
    played !== null &&
    a.type === 'show_ayat' &&
    a.current !== played &&
    kind !== 'hadith' &&
    kind !== 'htaseem'
      ? { ...a, current: played }
      : a,
  );
  const shown = actions.find((a) => a.type === 'show_ayat');
  return {
    sessionId,
    kind,
    teacher: str(json.teacher) ?? '',
    female: json.female === true,
    stage: str(json.stage) ?? stages[stageIndex]?.id ?? '',
    stageIndex,
    maxStageIndex,
    stages,
    say: str(json.say) ?? '',
    actions,
    expects,
    quickReplies: strings(json.quick_replies).filter((q) => q.trim()),
    ayah: played ?? (shown?.type === 'show_ayat' ? shown.current : null),
    surahNo: int(json.surah_no),
    lessonTitle: str(json.lesson_title),
    hadithTitle: str(json.hadith_title),
    recitedAyat: scoreIds(json.recitation_scores, 'ayah'),
    hadithIds: scoreIds(json.recitation_scores, 'hadith'),
  };
}

export interface ScoreResult {
  readonly available: boolean;
  readonly transcription: string | null;
}

export function parseScore(json: unknown): ScoreResult {
  if (!isObj(json) || json.available !== true) return { available: false, transcription: null };
  const t = str(json.transcription)?.trim();
  return { available: true, transcription: t || null };
}

export interface ReadyReview {
  readonly surahNo?: number;
  readonly chunk?: number;
  readonly hadithId?: number;
}

/** /agent/taseem/status and /agent/htaseem/status → the items ready now. */
export function parseReady(json: unknown): ReadyReview[] {
  if (!isObj(json) || !Array.isArray(json.items)) return [];
  return json.items
    .filter((i): i is Obj => isObj(i) && i.ready === true)
    .map((i) => {
      const surahNo = int(i.surah_no);
      const chunk = int(i.chunk);
      const hadithId = int(i.hadith_id);
      return {
        ...(surahNo !== null ? { surahNo, chunk: chunk ?? 0 } : {}),
        ...(hadithId !== null ? { hadithId } : {}),
      };
    })
    .filter((r) => r.surahNo !== undefined || r.hadithId !== undefined);
}

/** /agent/progress → the hadith ids the server counts as memorized. */
export function parseCompletedHadith(json: unknown): number[] {
  if (!isObj(json) || !isObj(json.hadith)) return [];
  return (Array.isArray(json.hadith.completed) ? json.hadith.completed : [])
    .map(int)
    .filter((n): n is number => n !== null);
}

export interface ActionItem {
  readonly hadithId: number;
  readonly title: string;
  readonly action: string;
  readonly done: boolean;
}

export function parseActionItems(json: unknown): ActionItem[] {
  if (!isObj(json) || !Array.isArray(json.items)) return [];
  return json.items.filter(isObj).flatMap((i) => {
    const hadithId = int(i.hadith_id);
    return hadithId === null
      ? []
      : [{ hadithId, title: str(i.title) ?? '', action: str(i.action) ?? '', done: i.done === true }];
  });
}
