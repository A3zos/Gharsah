import { Firestore, Timestamp } from 'firebase-admin/firestore';

import plan from './config/yearly_plan.json';

const P = plan.weeklyPoints;

/// The competition week starts Saturday 00:00 Riyadh time («يتجدد أسبوعيًا»).
export function weekKey(now: Date): string {
  const local = new Date(now.getTime() + plan.utcOffsetHours * 3600_000);
  const sinceSat = (local.getUTCDay() + 1) % 7; // sat=0 … fri=6
  local.setUTCDate(local.getUTCDate() - sinceSat);
  return local.toISOString().slice(0, 10);
}

/// Points earned by one progress/submission change (server-side only).
export function pointsDelta(
  prev: { ayat?: number; hadith?: number; projects?: number } | undefined,
  next: { ayat: number; hadith: number; projects: number },
  completedNow: boolean,
): number {
  const up = (a: number, b: number | undefined) => Math.max(0, a - (b ?? 0));
  return (
    up(next.ayat, prev?.ayat) * P.perAyah +
    up(next.hadith, prev?.hadith) * P.perHadith +
    up(next.projects, prev?.projects) * P.perProjectReport +
    (completedNow ? P.perLessonCompleted : 0)
  );
}

/// A public row: rank + points ONLY (no ids, names or avatars).
export interface BoardRow {
  rank: number;
  points: number;
}

/// The child's own standing — written only to that child's doc.
export interface OwnStanding {
  weekKey: string;
  rank: number;
  points: number;
  total: number;
  /// «أنت ضمن أفضل ٢٠٪» (rounded up to a multiple of 10).
  topPercent: number;
  /// Points to reach the row above (null when first).
  gapToAbove: number | null;
  updatedAt: Timestamp;
}

export const TOP_ROWS = 5;

export function rankBoard(
  entries: { key: string; points: number }[],
  wk: string,
  now: Date,
): { top: BoardRow[]; own: Map<string, OwnStanding>; total: number } {
  // Highest points first; equal points share the order deterministically.
  const sorted = [...entries].sort((a, b) => b.points - a.points || (a.key < b.key ? -1 : 1));
  const total = sorted.length;
  const at = Timestamp.fromDate(now);
  const own = new Map<string, OwnStanding>();
  sorted.forEach((e, i) => {
    const rank = i + 1;
    own.set(e.key, {
      weekKey: wk,
      rank,
      points: e.points,
      total,
      topPercent: Math.min(100, Math.max(10, Math.ceil((rank * 100) / total / 10) * 10)),
      gapToAbove: i === 0 ? null : sorted[i - 1].points - e.points,
      updatedAt: at,
    });
  });
  const top = sorted.slice(0, TOP_ROWS).map((e, i) => ({ rank: i + 1, points: e.points }));
  return { top, own, total };
}

/**
 * Recomputes this week's board. `leaderboard/current` holds ONLY rank +
 * points rows; each child's own standing goes to its own doc (`leader`).
 */
export async function runLeaderboard(db: Firestore, now: Date = new Date()) {
  const wk = weekKey(now);
  const snap = await db.collectionGroup('children').where('stats.weekKey', '==', wk).get();
  const entries = snap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'parents')
    .map((d) => ({ key: d.ref.path, points: Number(d.get('stats.weekPoints') ?? 0) }));
  const { top, own, total } = rankBoard(entries, wk, now);
  await db.doc('leaderboard/current').set({
    weekKey: wk,
    total,
    rows: top,
    updatedAt: Timestamp.fromDate(now),
  });
  let batch = db.batch();
  let n = 0;
  for (const d of snap.docs) {
    const s = own.get(d.ref.path);
    if (!s) continue;
    batch.update(d.ref, { leader: s });
    if (++n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  return { weekKey: wk, total };
}
