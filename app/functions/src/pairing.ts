import { randomInt } from 'crypto';
import {
  FieldValue,
  Firestore,
  Timestamp,
  Transaction,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/// Pairing codes live 24 h; one active code per child (CLAUDE.md §2).
export const CODE_TTL_MS = 24 * 60 * 60 * 1000;

export interface IssuedCode {
  code: string;
  /// Epoch millis.
  expiresAt: number;
}

export interface IssueOptions {
  /// Revoke: kill the old code AND unlink the child's device, then issue anew.
  revoke: boolean;
  now?: Date;
  /// Test hook for collision handling.
  randomCode?: () => string;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function requireId(v: unknown, name: string): string {
  if (typeof v !== 'string' || !ID.test(v)) {
    throw new HttpsError('invalid-argument', `${name} is invalid`);
  }
  return v;
}

export const newCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

const paths = {
  child: (uid: string, childId: string) => `parents/${uid}/children/${childId}`,
  sub: (uid: string) => `parents/${uid}/subscription/current`,
  code: (code: string) => `pairingCodes/${code}`,
  session: (anonUid: string) => `childSessions/${anonUid}`,
};
export { paths };

/**
 * Issues a fresh 6-digit code for [childId] (or returns the still-valid one
 * when [opts.revoke] is false). Requires an active subscription and that the
 * caller owns the child — ownership is structural: the child is read under
 * `parents/{callerUid}`.
 */
export async function issueCode(
  db: Firestore,
  parentUid: string,
  childId: string,
  opts: IssueOptions,
): Promise<IssuedCode> {
  const now = opts.now ?? new Date();
  const gen = opts.randomCode ?? newCode;
  const childRef = db.doc(paths.child(parentUid, childId));
  const subRef = db.doc(paths.sub(parentUid));

  return db.runTransaction(async (tx: Transaction) => {
    const [child, sub] = await Promise.all([tx.get(childRef), tx.get(subRef)]);
    if (!child.exists) throw new HttpsError('not-found', 'child-not-found');
    const s = sub.data();
    const subActive =
      s?.status === 'active' &&
      s.expiresAt instanceof Timestamp &&
      s.expiresAt.toMillis() > now.getTime();
    if (!subActive) {
      throw new HttpsError('failed-precondition', 'no-active-subscription');
    }

    const current = child.get('pairing') as
      | { code?: string; expiresAt?: Timestamp; status?: string }
      | undefined;
    if (
      !opts.revoke &&
      current?.status === 'active' &&
      current.code &&
      current.expiresAt instanceof Timestamp &&
      current.expiresAt.toMillis() > now.getTime()
    ) {
      return { code: current.code, expiresAt: current.expiresAt.toMillis() };
    }

    // All reads before writes: the old code doc, then candidate codes.
    const oldRef = current?.code ? db.doc(paths.code(current.code)) : null;
    const old = oldRef ? await tx.get(oldRef) : null;
    let code: string | null = null;
    for (let i = 0; i < 12 && code === null; i++) {
      const c = gen();
      if (!/^[0-9]{6}$/.test(c) || c === current?.code) continue;
      const snap = await tx.get(db.doc(paths.code(c)));
      const taken =
        snap.exists &&
        snap.get('status') === 'active' &&
        (snap.get('expiresAt') as Timestamp).toMillis() > now.getTime();
      if (!taken) code = c;
    }
    if (code === null) throw new HttpsError('resource-exhausted', 'no-free-code');

    const expiresAt = Timestamp.fromMillis(now.getTime() + CODE_TTL_MS);
    if (
      old?.exists &&
      old.get('childId') === childId &&
      old.get('parentUid') === parentUid &&
      old.get('status') === 'active'
    ) {
      tx.update(oldRef!, { status: 'revoked', revokedAt: Timestamp.fromDate(now) });
    }
    const childUpdate: Record<string, unknown> = {
      pairing: { code, expiresAt, status: 'active' },
    };
    const linked = child.get('linkedDeviceUid') as string | undefined;
    if (opts.revoke && linked) {
      tx.delete(db.doc(paths.session(linked)));
      childUpdate.linkedDeviceUid = FieldValue.delete();
    }
    tx.set(db.doc(paths.code(code)), {
      parentUid,
      childId,
      createdAt: Timestamp.fromDate(now),
      expiresAt,
      status: 'active',
    });
    tx.update(childRef, childUpdate);
    return { code, expiresAt: expiresAt.toMillis() };
  });
}
