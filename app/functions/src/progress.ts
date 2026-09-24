import { Firestore, Timestamp } from 'firebase-admin/firestore';

import { paths } from './pairing';
import { ChildStats, computeStats, ProgressDoc } from './stats';

/// Recordings are kept 90 days, then deleted (product-owner decision).
export const RECORDING_RETENTION_DAYS = 90;

/// Storage, behind an interface so the logic is testable without the bucket.
export interface FileStore {
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

/** Recomputes `stats` on the child doc from all its progress + submissions. */
export async function recomputeStats(
  db: Firestore,
  parentUid: string,
  childId: string,
  opts: { completedNow: boolean; now?: Date },
): Promise<ChildStats | null> {
  const now = opts.now ?? new Date();
  const childRef = db.doc(paths.child(parentUid, childId));
  return db.runTransaction(async (tx) => {
    const child = await tx.get(childRef);
    if (!child.exists) return null;
    const [progress, subs] = await Promise.all([
      tx.get(childRef.collection('progress')),
      tx.get(childRef.collection('submissions')),
    ]);
    const stats = computeStats({
      progress: progress.docs.map((d) => d.data() as ProgressDoc),
      submissions: subs.docs.map((d) => ({ projectId: String(d.get('projectId') ?? '') })),
      prev: child.get('stats') as Partial<ChildStats> | undefined,
      scheduleDays: (child.get('schedule.days') as string[] | undefined) ?? [],
      completedNow: opts.completedNow,
      now,
    });
    tx.update(childRef, { stats });
    return stats;
  });
}

/** A new submission must point at an uploaded recording; otherwise it's removed. */
export async function verifySubmission(
  db: Firestore,
  files: FileStore,
  parentUid: string,
  childId: string,
  submissionId: string,
): Promise<boolean> {
  const ref = db.doc(`${paths.child(parentUid, childId)}/submissions/${submissionId}`);
  const snap = await ref.get();
  const path = snap.get('storagePath') as string | undefined;
  if (!path || !(await files.exists(path))) {
    await ref.delete();
    return false;
  }
  return true;
}

/** Daily housekeeping: 90-day recordings, dead pairing codes, rate limits. */
export async function cleanup(
  db: Firestore,
  files: FileStore,
  now: Date = new Date(),
): Promise<{ recordings: number; codes: number; limits: number }> {
  const cutoff = Timestamp.fromMillis(now.getTime() - RECORDING_RETENTION_DAYS * 86400_000);
  const dayAgo = Timestamp.fromMillis(now.getTime() - 86400_000);
  let recordings = 0;
  const old = await db.collectionGroup('submissions').where('createdAt', '<', cutoff).get();
  for (const d of old.docs) {
    const path = d.get('storagePath') as string | undefined;
    if (path) await files.delete(path);
    await d.ref.delete(); // the delete trigger recomputes the child's stats
    recordings++;
  }
  let codes = 0;
  const dead = await db.collection('pairingCodes').where('expiresAt', '<', dayAgo).get();
  for (const d of dead.docs) {
    await d.ref.delete();
    codes++;
  }
  let limits = 0;
  const lim = await db.collection('rateLimits').where('windowStart', '<', dayAgo).get();
  for (const d of lim.docs) {
    await d.ref.delete();
    limits++;
  }
  return { recordings, codes, limits };
}

/** A child was removed by the parent: delete everything that belonged to it. */
export async function deleteChildData(
  db: Firestore,
  files: FileStore,
  parentUid: string,
  childId: string,
  child: { pairing?: { code?: string }; linkedDeviceUid?: string },
): Promise<void> {
  const base = db.doc(paths.child(parentUid, childId));
  await db.recursiveDelete(base.collection('progress'));
  await db.recursiveDelete(base.collection('submissions'));
  await files.deletePrefix(`recordings/${parentUid}/${childId}/`);
  const code = child.pairing?.code;
  if (code) {
    const c = await db.doc(paths.code(code)).get();
    if (c.get('childId') === childId && c.get('parentUid') === parentUid) await c.ref.delete();
  }
  if (child.linkedDeviceUid) await db.doc(paths.session(child.linkedDeviceUid)).delete();
}
