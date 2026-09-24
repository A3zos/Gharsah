import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { paths } from './pairing';

/// Wrong codes allowed per device per window (brute-force guard: 10^6 codes).
export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 10 * 60 * 1000;

/// What the child device learns — only what the child app needs. The child
/// never enters personal data; the first name comes from the parent.
export interface ClaimedChild {
  parentUid: string;
  childId: string;
  name: string;
  avatar: string;
  gender: string;
}

export async function claimCode(
  db: Firestore,
  deviceUid: string,
  rawCode: unknown,
  now: Date = new Date(),
): Promise<ClaimedChild> {
  if (typeof rawCode !== 'string' || !/^[0-9]{6}$/.test(rawCode)) {
    throw new HttpsError('invalid-argument', 'bad-code');
  }
  const code = rawCode;
  const limitRef = db.doc(`rateLimits/${deviceUid}`);

  // Rate limit first, in its own transaction, so a failed claim still counts.
  await db.runTransaction(async (tx) => {
    const lim = await tx.get(limitRef);
    const start = lim.get('windowStart') as Timestamp | undefined;
    const inWindow = start && now.getTime() - start.toMillis() < WINDOW_MS;
    const failures = inWindow ? ((lim.get('failures') as number) ?? 0) : 0;
    if (failures >= MAX_ATTEMPTS) {
      throw new HttpsError('resource-exhausted', 'too-many-attempts');
    }
    if (!inWindow) {
      tx.set(limitRef, { windowStart: Timestamp.fromDate(now), failures: 0 });
    }
  });

  const fail = async (): Promise<never> => {
    await limitRef.update({ failures: FieldValue.increment(1) });
    throw new HttpsError('not-found', 'wrong-code');
  };

  const result = await db.runTransaction(async (tx) => {
    const codeRef = db.doc(paths.code(code));
    const snap = await tx.get(codeRef);
    const d = snap.data();
    // DEMO EXCEPTION (server-side only): a code with isDemo === true never
    // expires and may be claimed by many devices. Every other code is
    // one-time and valid 24 h. Clients can never create or edit codes.
    const demo = d?.isDemo === true;
    const usable =
      !!d &&
      d.status === 'active' &&
      (demo ||
        (d.expiresAt instanceof Timestamp && d.expiresAt.toMillis() > now.getTime()));
    if (!usable) return null;
    const parentUid = d.parentUid as string;
    const childId = d.childId as string;
    const childRef = db.doc(paths.child(parentUid, childId));
    const sessionRef = db.doc(paths.session(deviceUid));
    const [child, mySession, childSessions] = await Promise.all([
      tx.get(childRef),
      tx.get(sessionRef),
      tx.get(
        db.collection('childSessions')
          .where('parentUid', '==', parentUid)
          .where('childId', '==', childId),
      ),
    ]);
    if (!child.exists) return null;

    // All reads before any write.
    const oldParent = mySession.get('parentUid') as string | undefined;
    const oldChild = mySession.get('childId') as string | undefined;
    const switching =
      !!oldParent && !!oldChild && (oldParent !== parentUid || oldChild !== childId);
    const oldRef = switching ? db.doc(paths.child(oldParent!, oldChild!)) : null;
    const old = oldRef ? await tx.get(oldRef) : null;

    // One device per child: any other device's session for this child ends
    // (not for the demo code, which several devices may share).
    if (!demo) {
      for (const other of childSessions.docs) {
        if (other.id !== deviceUid) tx.delete(other.ref);
      }
    }
    // This device was linked to a different child before → unlink that one.
    if (oldRef && old?.exists && old.get('linkedDeviceUid') === deviceUid) {
      tx.update(oldRef, { linkedDeviceUid: FieldValue.delete() });
    }

    const at = Timestamp.fromDate(now);
    if (demo) {
      tx.update(codeRef, { lastClaimedAt: at });
      tx.update(childRef, { linkedDeviceUid: deviceUid });
    } else {
      tx.update(codeRef, { status: 'claimed', claimedBy: deviceUid, claimedAt: at });
      tx.update(childRef, { linkedDeviceUid: deviceUid, 'pairing.status': 'claimed' });
    }
    tx.set(sessionRef, { parentUid, childId, linkedAt: at });
    return {
      parentUid,
      childId,
      name: (child.get('name') as string) ?? '',
      avatar: (child.get('avatar') as string) ?? 'g1',
      gender: (child.get('gender') as string) ?? 'girl',
    } satisfies ClaimedChild;
  });
  return result ?? fail();
}
