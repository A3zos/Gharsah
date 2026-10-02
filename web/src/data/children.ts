// The parent's children (Supabase `children`). Server-only values — pairing
// (child_pairing RPC), paired device, stats (child_stats RPC) — are read, never written.
import { supabase } from '../supabase/client';
import { watch } from '../supabase/live';
import { toAuthFailure } from './authFailure';
import { issueCode } from './pairing';

export type Gender = 'girl' | 'boy';

/** Week starts on Saturday (design Schedule). */
export const WEEK_DAYS = [
  { id: 'sat', label: 'السبت', short: 'سبت' },
  { id: 'sun', label: 'الأحد', short: 'أحد' },
  { id: 'mon', label: 'الاثنين', short: 'إثنين' },
  { id: 'tue', label: 'الثلاثاء', short: 'ثلاثاء' },
  { id: 'wed', label: 'الأربعاء', short: 'أربعاء' },
  { id: 'thu', label: 'الخميس', short: 'خميس' },
  { id: 'fri', label: 'الجمعة', short: 'جمعة' },
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number]['id'];

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
  /** «التحدث مع المعلم بالصوت» (add-child step 4) — off by default. */
  aiVoiceConsent?: boolean;
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
  /** Pilot days whose quiz was answered on the device only — «لم يُقيَّم» (parent views). */
  pilotUnscored: readonly string[];
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
  extra: { pairing?: Row | null; stats?: Row | null; pilotDaysDone?: number; pilotUnscored?: string[] } = {},
): ChildProfile {
  const p = extra.pairing;
  return {
    id: String(r.id),
    name: typeof r.name === 'string' ? r.name : '',
    age: typeof r.age === 'number' ? r.age : 10,
    gender: r.gender === 'boy' ? 'boy' : 'girl',
    avatarId: typeof r.avatar === 'string' ? r.avatar : 'g1',
    pairing:
      p && typeof p.code === 'string'
        ? { code: p.code, expiresAt: date(p.expiresAt) ?? new Date(), status: String(p.status ?? 'active') }
        : null,
    linked: p?.linked === true,
    createdAt: date(r.created_at),
    stats: extra.stats ?? null,
    leader: null,
    schedule: scheduleFromRow(r),
    aiVoiceConsent: r.ai_voice_consent === true,
    pilotDaysDone: extra.pilotDaysDone ?? 0,
    pilotUnscored: extra.pilotUnscored ?? [],
  };
}

export const CHILD_COLUMNS =
  'id, name, age, gender, avatar, schedule_days, schedule_time, schedule_custom, session_duration, reminder, review_days, ai_voice_consent, created_at';

/** The child's pilot-day rows (works before the quiz_unscored migration too). */
async function pilotRows(childId: string): Promise<Row[]> {
  const db = supabase();
  const q = (cols: string) =>
    db.from('progress').select(cols).eq('child_id', childId).like('lesson_id', 'pilot-day-%');
  const full = await q('lesson_id, stage, quiz_unscored');
  if (!full.error) return (full.data ?? []) as unknown as Row[];
  const basic = await q('lesson_id, stage');
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
        pilotUnscored: pilot.filter((p) => p.quiz_unscored === true).map((p) => String(p.lesson_id)),
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
      const { data, error: e } = await supabase()
        .from('children')
        .select(CHILD_COLUMNS)
        .eq('parent_id', uid)
        .order('created_at');
      if (e) throw e;
      return withServerFields(data ?? []);
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
      const { data, error: e } = await supabase()
        .from('children')
        .select(CHILD_COLUMNS)
        .eq('id', childId)
        .maybeSingle();
      if (e) throw e;
      return data ? (await withServerFields([data]))[0]! : null;
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
      ...(draft.aiVoiceConsent ? { ai_voice_consent: true } : {}),
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

/**
 * The parent's consent for the AI teacher to receive the child's voice (the AI
 * server stores recitation audio). Off by default; the database stamps the time.
 */
export async function setAiVoiceConsent(childId: string, on: boolean): Promise<void> {
  await uidOrThrow();
  const { error } = await supabase().from('children').update({ ai_voice_consent: on }).eq('id', childId);
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
export const reviewDayNames = (s: ChildSchedule | null): string =>
  s
    ? WEEK_DAYS.filter((d) => s.reviewDays.includes(d.id))
        .map((d) => d.label)
        .join('، ')
    : '';

/** «٥:٠٠ مساءً» */
export function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const ar = (n: number) => n.toLocaleString('ar-SA-u-nu-arab', { useGrouping: false });
  return `${ar(h)}:${ar(m).padStart(2, '٠')} ${h24 < 12 ? 'صباحًا' : 'مساءً'}`;
}
