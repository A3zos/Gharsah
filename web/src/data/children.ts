// The parent's children (Supabase `children`). Server-only values — pairing
// (child_pairing RPC), paired device, stats (child_stats RPC) — are read, never written.
import { supabase } from '../supabase/client';
import { watch } from '../supabase/live';
import { toAuthFailure } from './authFailure';
import { issueCode } from './pairing';
import { avatarKey } from '../content/avatars';
import { MESSAGES, type UiLanguage } from '../i18n/i18n';

export type Gender = 'girl' | 'boy';

/** Week starts on Saturday (design Schedule). */
const DAY_IDS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
export type WeekDay = (typeof DAY_IDS)[number];

/** A weekday's names in a UI language (parent.json → schedule.days): «السبت» / «سبت» / «س». */
export const dayNames = (d: WeekDay, lang: UiLanguage = 'ar') => MESSAGES[lang].parent.schedule.days[d];

/** The days with their Arabic names (label «السبت», short «سبت»). */
export const WEEK_DAYS: readonly { id: WeekDay; label: string; short: string }[] = DAY_IDS.map((id) => ({
  id,
  label: dayNames(id).label,
  short: dayNames(id).short,
}));

export const DURATIONS = [30, 45, 60] as const;

/** Times are minutes after midnight. */
export interface ChildSchedule {
  days: WeekDay[];
  time: number;
  /** Per-day time overrides; days not listed use `time`. */
  custom: Partial<Record<WeekDay, number>>;
  duration: (typeof DURATIONS)[number];
  reminder: boolean;
  /** Weekly review days: 1–3 of the lesson days (review notes B5; the database enforces it). */
  reviewDays: WeekDay[];
}

export const MAX_REVIEW_DAYS = 3;

/** design/v3 defaults: سبت، أحد، إثنين، أربعاء، خميس (مراجعة الخميس) · ٥:٠٠ مساءً · ٤٥ دقيقة. */
export const DEFAULT_SCHEDULE: ChildSchedule = {
  days: ['sat', 'sun', 'mon', 'wed', 'thu'],
  time: 17 * 60,
  custom: {},
  duration: 45,
  reminder: true,
  reviewDays: ['thu'],
};

export interface ChildDraft {
  name: string;
  age: number;
  gender: Gender;
  schedule: ChildSchedule;
  avatarId: string;
  /** «اسمه في لوحة المتصدرين» — the opt-out (default true: the name shows). */
  boardShowName?: boolean;
}

export interface PairingInfo {
  /** Six Latin digits (shown with Arabic-Indic digits). */
  code: string;
  expiresAt: Date;
  /** active | claimed | revoked */
  status: string;
}

export const pairingActive = (p: PairingInfo | null, now = new Date()) =>
  !!p && p.status === 'active' && p.expiresAt > now;

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  avatarId: string;
  pairing: PairingInfo | null;
  linked: boolean;
  createdAt: Date | null;
  stats: Record<string, unknown> | null;
  leader: Record<string, unknown> | null;
  schedule: ChildSchedule | null;
  /** The parent allowed sending the child's voice to the AI teacher server (default off). */
  aiVoiceConsent: boolean;
  /** Pilot plan days finished (0–3), from the `progress` rows (parent views). */
  pilotDaysDone: number;
  /** When each finished pilot day was completed (by lesson id). */
  pilotDoneAt: Readonly<Record<string, Date>>;
  /** Pilot days whose quiz was answered on the device only — «لم يُقيَّم» (parent views). */
  pilotUnscored: readonly string[];
  /** «surah:ayah» refs the child stayed silent on in the pilot days — «لم يُردَّد» (parent views). */
  notRepeatedRefs: readonly string[];
  /** The weekly board shows the child's first name + the father's (opt-out; absent = true). */
  boardShowName?: boolean;
}

// Days are stored as integers 0 = السبت … 6 = الجمعة (WEEK_DAYS order).
const dayIndex = (d: WeekDay) => WEEK_DAYS.findIndex((x) => x.id === d);
const dayOf = (i: unknown): WeekDay | undefined =>
  typeof i === 'number' ? WEEK_DAYS[i]?.id : typeof i === 'string' ? WEEK_DAYS[Number(i)]?.id : undefined;
const inWeekOrder = (days: WeekDay[]) => WEEK_DAYS.map((d) => d.id).filter((d) => days.includes(d));

/** The review days that are still lesson days (max 3); never empty while there are lesson days. */
export function validReviewDays(s: ChildSchedule): WeekDay[] {
  const r = inWeekOrder(s.reviewDays.filter((d) => s.days.includes(d))).slice(0, MAX_REVIEW_DAYS);
  if (r.length || !s.days.length) return r;
  return [inWeekOrder(s.days).at(-1)!];
}

type Row = Record<string, unknown>;

function scheduleFromRow(r: Row): ChildSchedule | null {
  if (!Array.isArray(r.schedule_days)) return null;
  const days = inWeekOrder(r.schedule_days.map(dayOf).filter((d): d is WeekDay => !!d));
  const custom: ChildSchedule['custom'] = {};
  for (const [k, v] of Object.entries((r.schedule_custom as Row) ?? {})) {
    const d = dayOf(k);
    if (d && typeof v === 'number') custom[d] = v;
  }
  const duration = DURATIONS.includes(r.session_duration as 30)
    ? (r.session_duration as ChildSchedule['duration'])
    : 45;
  const reviewDays = inWeekOrder(
    (Array.isArray(r.review_days) ? r.review_days : [])
      .map(dayOf)
      .filter((d): d is WeekDay => !!d && days.includes(d)),
  );
  return {
    days,
    time: typeof r.schedule_time === 'number' ? r.schedule_time : DEFAULT_SCHEDULE.time,
    custom,
    duration,
    reminder: r.reminder !== false,
    reviewDays,
  };
}

/** The database form of a schedule (days in week order; custom only for chosen days). */
export function scheduleToRow(s: ChildSchedule) {
  const days = inWeekOrder(s.days);
  return {
    schedule_days: days.map(dayIndex),
    schedule_time: s.time,
    schedule_custom: Object.fromEntries(
      Object.entries(s.custom)
        .filter(([d]) => days.includes(d as WeekDay))
        .map(([d, m]) => [String(dayIndex(d as WeekDay)), m]),
    ),
    session_duration: s.duration,
    reminder: s.reminder,
    review_days: validReviewDays({ ...s, days }).map(dayIndex),
  };
}

const date = (v: unknown): Date | null => (typeof v === 'string' ? new Date(v) : null);

export function childFromRow(
  r: Row,
  extra: {
    pairing?: Row | null;
    stats?: Row | null;
    pilotDaysDone?: number;
    pilotDoneAt?: Record<string, Date>;
    pilotUnscored?: string[];
    notRepeatedRefs?: string[];
  } = {},
): ChildProfile {
  const p = extra.pairing;
  return {
    id: String(r.id),
    name: typeof r.name === 'string' ? r.name : '',
    age: typeof r.age === 'number' ? r.age : 10,
    gender: r.gender === 'boy' ? 'boy' : 'girl',
    avatarId: avatarKey(typeof r.avatar === 'string' ? r.avatar : null, r.gender === 'boy' ? 'boy' : 'girl'),
    pairing:
      p && typeof p.code === 'string'
        ? { code: p.code, expiresAt: date(p.expiresAt) ?? new Date(), status: String(p.status ?? 'active') }
        : null,
    linked: p?.linked === true,
    createdAt: date(r.created_at),
    stats: extra.stats ?? null,
    leader: null,
    schedule: scheduleFromRow(r),
    // children.ai_voice_consent is kept but no longer gates anything: the teacher always
    // hears the child (PO, 2026-10-04 — disclosed at sign-up, auth.voiceNotice)
    aiVoiceConsent: r.ai_voice_consent === true,
    pilotDaysDone: extra.pilotDaysDone ?? 0,
    pilotDoneAt: extra.pilotDoneAt ?? {},
    pilotUnscored: extra.pilotUnscored ?? [],
    notRepeatedRefs: extra.notRepeatedRefs ?? [],
    boardShowName: r.board_show_name !== false,
  };
}

export const CHILD_COLUMNS =
  'id, name, age, gender, avatar, schedule_days, schedule_time, schedule_custom, session_duration, reminder, review_days, ai_voice_consent, created_at';

/** The parent's child rows with board_show_name (also before that migration is pushed). */
async function childRows(
  query: (cols: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>,
): Promise<{ data: unknown; error: { code?: string } | null }> {
  const r = await query(`${CHILD_COLUMNS}, board_show_name`);
  return r.error?.code === '42703' ? query(CHILD_COLUMNS) : r;
}

/** The child's pilot-day rows (works before the quiz_unscored / not_repeated_refs migrations too). */
async function pilotRows(childId: string): Promise<Row[]> {
  const db = supabase();
  const q = (cols: string) =>
    db.from('progress').select(cols).eq('child_id', childId).like('lesson_id', 'pilot-day-%');
  const all = await q('lesson_id, stage, completed_at, updated_at, quiz_unscored, not_repeated_refs');
  if (!all.error) return (all.data ?? []) as unknown as Row[];
  const full = await q('lesson_id, stage, completed_at, updated_at, quiz_unscored');
  if (!full.error) return (full.data ?? []) as unknown as Row[];
  const basic = await q('lesson_id, stage, completed_at, updated_at');
  return (basic.data ?? []) as unknown as Row[];
}

async function withServerFields(rows: Row[]): Promise<ChildProfile[]> {
  const db = supabase();
  return Promise.all(
    rows.map(async (r) => {
      const [pairing, stats, pilot] = await Promise.all([
        db.rpc('child_pairing', { p_child: r.id }),
        db.rpc('child_stats', { c: r.id }),
        pilotRows(String(r.id)),
      ]);
      return childFromRow(r, {
        pairing: (pairing.data as Row | null) ?? null,
        stats: (stats.data as Row | null) ?? null,
        pilotDaysDone: pilot.filter((p) => p.stage === 'done').length,
        pilotDoneAt: Object.fromEntries(
          pilot.flatMap((p) => {
            const at = p.stage === 'done' ? (date(p.completed_at) ?? date(p.updated_at)) : null;
            return at ? [[String(p.lesson_id), at]] : [];
          }),
        ),
        pilotUnscored: pilot.filter((p) => p.quiz_unscored === true).map((p) => String(p.lesson_id)),
        notRepeatedRefs: [
          ...new Set(
            pilot.flatMap((p) =>
              Array.isArray(p.not_repeated_refs)
                ? p.not_repeated_refs.filter((x): x is string => typeof x === 'string')
                : [],
            ),
          ),
        ],
      });
    }),
  );
}

async function uidOrThrow(): Promise<string> {
  const { data } = await supabase().auth.getUser();
  if (!data.user?.id) throw toAuthFailure({ code: 'permission-denied' });
  return data.user.id;
}

const liveTables = (uid: string) => [
  { table: 'children', filter: `parent_id=eq.${uid}` },
  { table: 'child_sessions', filter: `parent_id=eq.${uid}` },
  { table: 'progress' },
  { table: 'star_events' },
  { table: 'submissions' },
];

/** The parent's children, oldest first. */
export function watchChildren(uid: string, next: (c: ChildProfile[]) => void, error?: (e: unknown) => void) {
  return watch(
    liveTables(uid),
    async () => {
      const { data, error: e } = await childRows((cols) =>
        supabase().from('children').select(cols).eq('parent_id', uid).order('created_at'),
      );
      if (e) throw e;
      return withServerFields((data ?? []) as Row[]);
    },
    next,
    error,
  );
}

export function watchChild(
  uid: string,
  childId: string,
  next: (c: ChildProfile | null) => void,
  error?: (e: unknown) => void,
) {
  return watch(
    liveTables(uid),
    async () => {
      const { data, error: e } = await childRows((cols) =>
        supabase().from('children').select(cols).eq('id', childId).maybeSingle(),
      );
      if (e) throw e;
      return data ? (await withServerFields([data as Row]))[0]! : null;
    },
    next,
    error,
  );
}

/** Saves a new child, then asks the server for its pairing code (removes the child if that fails). */
export async function addChild(draft: ChildDraft): Promise<{ id: string; pairing: PairingInfo }> {
  const uid = await uidOrThrow();
  const { data, error } = await supabase()
    .from('children')
    .insert({
      parent_id: uid,
      name: draft.name.trim(),
      age: draft.age,
      gender: draft.gender,
      avatar: draft.avatarId,
      ...scheduleToRow(draft.schedule),
      // the column defaults to true: sent only when the parent turned it off
      ...(draft.boardShowName === false ? { board_show_name: false } : {}),
    })
    .select('id')
    .single();
  if (error) throw toAuthFailure(error);
  const id = String(data.id);
  try {
    return { id, pairing: await issueCode(id) };
  } catch (e) {
    await supabase().from('children').delete().eq('id', id);
    throw e;
  }
}

export async function updateSchedule(childId: string, schedule: ChildSchedule): Promise<void> {
  await uidOrThrow();
  const { error } = await supabase().from('children').update(scheduleToRow(schedule)).eq('id', childId);
  if (error) throw toAuthFailure(error);
}

/** «اسمه في لوحة المتصدرين» on / off (the parent's opt-out). */
export async function setBoardShowName(childId: string, on: boolean): Promise<void> {
  await uidOrThrow();
  const { error } = await supabase().from('children').update({ board_show_name: on }).eq('id', childId);
  if (error) throw toAuthFailure(error);
}

/** Deletes the child; the database cascades progress, stars, submissions, sessions and codes. */
export async function removeChild(childId: string): Promise<void> {
  await uidOrThrow();
  const { error } = await supabase().from('children').delete().eq('id', childId);
  if (error) throw toAuthFailure(error);
}

/** The soonest review day from today (Riyadh), and how many days ahead it is (0 = today). */
export function nextReviewDay(
  s: ChildSchedule | null,
  now = new Date(),
): { day: WeekDay; label: string; inDays: number } | null {
  if (!s || !s.reviewDays.length) return null;
  const today = (new Date(now.getTime() + 3 * 3_600_000).getUTCDay() + 1) % 7; // sat = 0 … fri = 6
  let best: { day: WeekDay; label: string; inDays: number } | null = null;
  for (const d of s.reviewDays) {
    const i = WEEK_DAYS.findIndex((x) => x.id === d);
    const inDays = (i - today + 7) % 7;
    if (!best || inDays < best.inDays) best = { day: d, label: WEEK_DAYS[i]!.label, inDays };
  }
  return best;
}

/** «الخميس، الأحد» — the review days in week order. */
export const reviewDayNames = (s: ChildSchedule | null, lang: UiLanguage = 'ar'): string =>
  s
    ? WEEK_DAYS.filter((d) => s.reviewDays.includes(d.id))
        .map((d) => dayNames(d.id, lang).label)
        .join(MESSAGES[lang].parent.common.listSep)
    : '';

/** «٥:٠٠ مساءً» (Arabic, as the design shows it); "5:00 PM" / "17.00" through Intl in en / id. */
export function formatTime(minutes: number, lang: UiLanguage = 'ar'): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang !== 'ar') {
    return new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2000, 0, 1, h24, m)),
    );
  }
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const ar = (n: number) => n.toLocaleString('ar-SA-u-nu-arab', { useGrouping: false });
  return `${ar(h)}:${ar(m).padStart(2, '٠')} ${h24 < 12 ? 'صباحًا' : 'مساءً'}`;
}
