// Runs against the Firestore emulator: `npm run test:emu` (from app/functions).
import assert from 'assert';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { CODE_TTL_MS, issueCode, requireId } from '../src/pairing';

process.env.GCLOUD_PROJECT = 'nibras-59284';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with the Firestore emulator (npm run test:emu)');
}
initializeApp({ projectId: 'nibras-59284' });
const db = getFirestore();

const NOW = new Date('2026-09-24T12:00:00Z');
const days = (n: number) => Timestamp.fromMillis(NOW.getTime() + n * 86400000);

async function reset() {
  for (const c of ['parents', 'pairingCodes', 'childSessions']) {
    await db.recursiveDelete(db.collection(c));
  }
}

async function seed(uid: string, childId: string, subDays = 30) {
  await db.doc(`parents/${uid}`).set({ name: 'P', email: `${uid}@x.com`, role: 'parent' });
  await db.doc(`parents/${uid}/subscription/current`).set({
    plan: 'annual', status: 'active', provider: 'mock', startedAt: days(-1), expiresAt: days(subDays),
  });
  await db.doc(`parents/${uid}/children/${childId}`).set({ name: 'سارة', ownerUid: uid });
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: { code?: string; message?: string }) => {
    assert.strictEqual(e.code, code, `${e.code}: ${e.message}`);
    return true;
  });
}

describe('pairing codes', () => {
  beforeEach(reset);

  it('issues a 6-digit code tied to the child, 24h, one doc per code', async () => {
    await seed('alice', 'c1');
    const r = await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW });
    assert.match(r.code, /^[0-9]{6}$/);
    assert.strictEqual(r.expiresAt, NOW.getTime() + CODE_TTL_MS);
    const code = (await db.doc(`pairingCodes/${r.code}`).get()).data()!;
    assert.deepStrictEqual(
      [code.parentUid, code.childId, code.status],
      ['alice', 'c1', 'active'],
    );
    const child = (await db.doc('parents/alice/children/c1').get()).data()!;
    assert.strictEqual(child.pairing.code, r.code);
    assert.strictEqual(child.pairing.status, 'active');
  });

  it('returns the still-valid code instead of issuing another', async () => {
    await seed('alice', 'c1');
    const a = await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW });
    const b = await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW });
    assert.strictEqual(a.code, b.code);
    assert.strictEqual((await db.collection('pairingCodes').get()).size, 1);
  });

  it('an expired code is replaced and the old one revoked', async () => {
    await seed('alice', 'c1');
    const a = await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW });
    const later = new Date(NOW.getTime() + CODE_TTL_MS + 1000);
    const b = await issueCode(db, 'alice', 'c1', { revoke: false, now: later });
    assert.notStrictEqual(a.code, b.code);
    assert.strictEqual((await db.doc(`pairingCodes/${a.code}`).get()).get('status'), 'revoked');
  });

  it('revoke: old code dies, device unlinked, session deleted, new code', async () => {
    await seed('alice', 'c1');
    const a = await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW });
    await db.doc('parents/alice/children/c1').update({ linkedDeviceUid: 'dev1' });
    await db.doc('childSessions/dev1').set({ parentUid: 'alice', childId: 'c1' });
    const b = await issueCode(db, 'alice', 'c1', { revoke: true, now: NOW });
    assert.notStrictEqual(a.code, b.code);
    assert.strictEqual((await db.doc(`pairingCodes/${a.code}`).get()).get('status'), 'revoked');
    assert.strictEqual((await db.doc(`pairingCodes/${b.code}`).get()).get('status'), 'active');
    const child = (await db.doc('parents/alice/children/c1').get()).data()!;
    assert.strictEqual(child.linkedDeviceUid, undefined);
    assert.strictEqual((await db.doc('childSessions/dev1').get()).exists, false);
  });

  it('skips codes already active for another child', async () => {
    await seed('alice', 'c1');
    await seed('bob', 'c2');
    const seq = ['111111', '111111', '222222'];
    const a = await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW, randomCode: () => seq.shift()! });
    const b = await issueCode(db, 'bob', 'c2', { revoke: false, now: NOW, randomCode: () => seq.shift()! });
    assert.strictEqual(a.code, '111111');
    assert.strictEqual(b.code, '222222');
    assert.strictEqual((await db.doc('pairingCodes/111111').get()).get('childId'), 'c1');
  });

  it('gives up when no free code can be found', async () => {
    await seed('alice', 'c1');
    await seed('bob', 'c2');
    await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW, randomCode: () => '333333' });
    await rejects(
      issueCode(db, 'bob', 'c2', { revoke: false, now: NOW, randomCode: () => '333333' }),
      'resource-exhausted',
    );
  });

  it('requires an active subscription', async () => {
    await seed('alice', 'c1', -1); // expired yesterday
    await rejects(issueCode(db, 'alice', 'c1', { revoke: false, now: NOW }), 'failed-precondition');
    await db.doc('parents/alice/subscription/current').delete();
    await rejects(issueCode(db, 'alice', 'c1', { revoke: false, now: NOW }), 'failed-precondition');
  });

  it("can't issue for another parent's child (ownership by path)", async () => {
    await seed('alice', 'c1');
    await seed('bob', 'c2');
    await rejects(issueCode(db, 'bob', 'c1', { revoke: false, now: NOW }), 'not-found');
    await rejects(issueCode(db, 'bob', 'c1', { revoke: true, now: NOW }), 'not-found');
  });

  it('validates ids', () => {
    assert.throws(() => requireId('../x', 'childId'));
    assert.throws(() => requireId('', 'childId'));
    assert.throws(() => requireId(42, 'childId'));
    assert.strictEqual(requireId('abc_DEF-1', 'childId'), 'abc_DEF-1');
  });
});
