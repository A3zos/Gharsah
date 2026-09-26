// The parent's children (`parents/{uid}/children/{childId}`). Port of
// app/lib/features/children/data/{child_profile,children_repository}.dart.
// Server-only fields (pairing, linkedDeviceUid, stats, leader) are read, never written.
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import { firebase } from '../firebase/app';
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
  /** design/v3: the weekly review session's day — one of `days` (optional). */
  reviewDay?: WeekDay;
}

/** design/v3 defaults: سبت، أحد، إثنين، أربعاء، خميس (مراجعة الخميس) · ٥:٠٠ مساءً · ٤٥ دقيقة. */
export const DEFAULT_SCHEDULE: ChildSchedule = {
  days: ['sat', 'sun', 'mon', 'wed', 'thu'],
  time: 17 * 60,
  custom: {},
  duration: 45,
  reminder: true,
  reviewDay: 'thu',
};

export interface ChildDraft {
  name: string;
  age: number;
  gender: Gender;
  schedule: ChildSchedule;
  avatarId: string;
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
}

const asDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : null);

function parseSchedule(m: unknown): ChildSchedule | null {
  if (!m || typeof m !== 'object') return null;
  const s = m as Record<string, unknown>;
  const ids = WEEK_DAYS.map((d) => d.id) as string[];
  const days = (Array.isArray(s.days) ? s.days : []).filter((d): d is WeekDay => ids.includes(d as string));
  const custom: ChildSchedule['custom'] = {};
  for (const [k, v] of Object.entries((s.custom as Record<string, unknown>) ?? {})) {
    if (ids.includes(k) && typeof v === 'number') custom[k as WeekDay] = v;
  }
  const duration = DURATIONS.includes(s.duration as 30) ? (s.duration as ChildSchedule['duration']) : 45;
  return {
    days,
    time: typeof s.time === 'number' ? s.time : DEFAULT_SCHEDULE.time,
    custom,
    duration,
    reminder: s.reminder !== false,
    ...(typeof s.reviewDay === 'string' && days.includes(s.reviewDay as WeekDay)
      ? { reviewDay: s.reviewDay as WeekDay }
      : {}),
  };
}

export function childFromDoc(id: string, d: DocumentData): ChildProfile {
  const p = d.pairing as Record<string, unknown> | undefined;
  return {
    id,
    name: typeof d.name === 'string' ? d.name : '',
    age: typeof d.age === 'number' ? d.age : 10,
    gender: d.gender === 'boy' ? 'boy' : 'girl',
    avatarId: typeof d.avatar === 'string' ? d.avatar : 'g1',
    pairing:
      p && typeof p.code === 'string'
        ? { code: p.code, expiresAt: asDate(p.expiresAt) ?? new Date(), status: String(p.status ?? 'active') }
        : null,
    linked: typeof d.linkedDeviceUid === 'string',
    createdAt: asDate(d.createdAt),
    stats: d.stats && typeof d.stats === 'object' ? (d.stats as Record<string, unknown>) : null,
    leader: d.leader && typeof d.leader === 'object' ? (d.leader as Record<string, unknown>) : null,
    schedule: parseSchedule(d.schedule),
  };
}

/** Firestore form of a schedule (days in week order; custom only for chosen days). */
export function scheduleToMap(s: ChildSchedule) {
  return {
    days: WEEK_DAYS.map((d) => d.id).filter((d) => s.days.includes(d)),
    time: s.time,
    custom: Object.fromEntries(Object.entries(s.custom).filter(([d]) => s.days.includes(d as WeekDay))),
    duration: s.duration,
    reminder: s.reminder,
    // Only a review day that is still a lesson day (rules: reviewDay ∈ days).
    ...(s.reviewDay && s.days.includes(s.reviewDay) ? { reviewDay: s.reviewDay } : {}),
  };
}

const childrenCol = (uid: string) => collection(firebase().db, 'parents', uid, 'children');

function uidOrThrow(): string {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) throw toAuthFailure({ code: 'permission-denied' });
  return uid;
}

/** The parent's children, oldest first. */
export function watchChildren(uid: string, next: (c: ChildProfile[]) => void, error?: (e: unknown) => void) {
  return onSnapshot(
    query(childrenCol(uid), orderBy('createdAt')),
    (q) => next(q.docs.map((d) => childFromDoc(d.id, d.data()))),
    error,
  );
}

export function watchChild(
  uid: string,
  childId: string,
  next: (c: ChildProfile | null) => void,
  error?: (e: unknown) => void,
) {
  return onSnapshot(
    doc(childrenCol(uid), childId),
    (d) => next(d.exists() ? childFromDoc(d.id, d.data()) : null),
    error,
  );
}

/** Saves a new child, then asks the server for its pairing code (removes the child if that fails). */
export async function addChild(draft: ChildDraft): Promise<{ id: string; pairing: PairingInfo }> {
  const uid = uidOrThrow();
  const ref = doc(childrenCol(uid));
  try {
    await setDoc(ref, {
      name: draft.name.trim(),
      age: draft.age,
      gender: draft.gender,
      avatar: draft.avatarId,
      schedule: scheduleToMap(draft.schedule),
      ownerUid: uid,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    throw toAuthFailure(e);
  }
  try {
    return { id: ref.id, pairing: await issueCode(ref.id) };
  } catch (e) {
    await deleteDoc(ref).catch(() => {});
    throw e;
  }
}

export async function updateSchedule(childId: string, schedule: ChildSchedule): Promise<void> {
  try {
    await updateDoc(doc(childrenCol(uidOrThrow()), childId), { schedule: scheduleToMap(schedule) });
  } catch (e) {
    throw toAuthFailure(e);
  }
}

/** Deletes the child; onChildDeleted (server) removes progress, submissions, recordings, code, session. */
export async function removeChild(childId: string): Promise<void> {
  try {
    await deleteDoc(doc(childrenCol(uidOrThrow()), childId));
  } catch (e) {
    throw toAuthFailure(e);
  }
}

/** «٥:٠٠ مساءً» */
export function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const ar = (n: number) => n.toLocaleString('ar-SA-u-nu-arab', { useGrouping: false });
  return `${ar(h)}:${ar(m).padStart(2, '٠')} ${h24 < 12 ? 'صباحًا' : 'مساءً'}`;
}
