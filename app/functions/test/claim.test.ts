// Runs against the Firestore emulator: `npm run test:emu` (from app/functions).
import assert from 'assert';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { claimCode, MAX_ATTEMPTS, WINDOW_MS } from '../src/claim';
import { CODE_TTL_MS, issueCode } from '../src/pairing';

if (!getApps().length) initializeApp({ projectId: 'nibras-59284' });
const db = getFirestore();
const NOW = new Date('2026-09-24T12:00:00Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);

async function reset() {
  for (const c of ['parents', 'pairingCodes', 'childSessions', 'rateLimits']) {
    await db.recursiveDelete(db.collection(c));
  }
}

async function seedChild(uid: string, childId: string, name = 'سارة') {
  await db.doc(`parents/${uid}`).set({ name: 'P', role: 'parent' });
  await db.doc(`parents/${uid}/subscription/current`).set({
    status: 'active', expiresAt: Timestamp.fromDate(at(30 * 86400000)),
  });
  await db.doc(`parents/${uid}/children/${childId}`).set({
    name, avatar: 'g2', gender: 'girl', age: 10, ownerUid: uid,
  });
  return (await issueCode(db, uid, childId, { revoke: false, now: NOW })).code;
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: { code?: string }) => {
    assert.strictEqual(e.code, code);
    return true;
  });
}

describe('claimPairingCode', () => {
  beforeEach(reset);

  it('valid code: links the device, marks claimed, returns first name only', async () => {
    const code = await seedChild('alice', 'c1');
    const r = await claimCode(db, 'dev1', code, NOW);
    assert.deepStrictEqual(r, {
      parentUid: 'alice', childId: 'c1', name: 'سارة', avatar: 'g2', gender: 'girl',
    });
    const child = (await db.doc('parents/alice/children/c1').get()).data()!;
    assert.strictEqual(child.linkedDeviceUid, 'dev1');
    assert.strictEqual(child.pairing.status, 'claimed');
    const c = (await db.doc(`pairingCodes/${code}`).get()).data()!;
    assert.strictEqual(c.status, 'claimed');
    assert.strictEqual(c.claimedBy, 'dev1');
    const s = (await db.doc('childSessions/dev1').get()).data()!;
    assert.deepStrictEqual([s.parentUid, s.childId], ['alice', 'c1']);
  });

  it('a code works once', async () => {
    const code = await seedChild('alice', 'c1');
    await claimCode(db, 'dev1', code, NOW);
    await rejects(claimCode(db, 'dev2', code, NOW), 'not-found');
  });

  it('wrong, expired and revoked codes are rejected', async () => {
    const code = await seedChild('alice', 'c1');
    const wrong = code === '000000' ? '000001' : '000000';
    await rejects(claimCode(db, 'dev1', wrong, NOW), 'not-found');
    await rejects(claimCode(db, 'dev1', code, at(CODE_TTL_MS + 1)), 'not-found');
    await issueCode(db, 'alice', 'c1', { revoke: true, now: NOW });
    await rejects(claimCode(db, 'dev2', code, NOW), 'not-found');
  });

  it('malformed input is invalid-argument (not counted as a guess)', async () => {
    for (const bad of ['12345', '12a456', 123456, null, '١٢٣٤٥٦']) {
      await rejects(claimCode(db, 'dev1', bad, NOW), 'invalid-argument');
    }
  });

  it(`rate limit: ${MAX_ATTEMPTS} wrong codes per device per window`, async () => {
    const code = await seedChild('alice', 'c1');
    const wrong = code === '999999' ? '999998' : '999999';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await rejects(claimCode(db, 'dev1', wrong, NOW), 'not-found');
    }
    // Even the right code is refused while locked out…
    await rejects(claimCode(db, 'dev1', code, NOW), 'resource-exhausted');
    // …another device isn't affected…
    await claimCode(db, 'dev2', code, NOW);
    // …and the window resets.
    const code2 = await seedChild('bob', 'c2');
    await claimCode(db, 'dev1', code2, at(WINDOW_MS + 1000));
  });

  it('new device replaces the old one (old session removed)', async () => {
    const code = await seedChild('alice', 'c1');
    await claimCode(db, 'dev1', code, NOW);
    const code2 = (await issueCode(db, 'alice', 'c1', { revoke: false, now: NOW })).code;
    await claimCode(db, 'dev2', code2, NOW);
    assert.strictEqual((await db.doc('childSessions/dev1').get()).exists, false);
    assert.strictEqual(
      (await db.doc('parents/alice/children/c1').get()).get('linkedDeviceUid'),
      'dev2',
    );
  });

  it('a device switching child unlinks the previous child', async () => {
    const a = await seedChild('alice', 'c1');
    const b = await seedChild('bob', 'c2', 'يوسف');
    await claimCode(db, 'dev1', a, NOW);
    const r = await claimCode(db, 'dev1', b, NOW);
    assert.strictEqual(r.name, 'يوسف');
    assert.strictEqual(
      (await db.doc('parents/alice/children/c1').get()).get('linkedDeviceUid'),
      undefined,
    );
  });

  it('revoke from the parent ends the child session', async () => {
    const code = await seedChild('alice', 'c1');
    await claimCode(db, 'dev1', code, NOW);
    await issueCode(db, 'alice', 'c1', { revoke: true, now: NOW });
    assert.strictEqual((await db.doc('childSessions/dev1').get()).exists, false);
  });

  describe('demo code (isDemo: true) — server-side exception only', () => {
    async function seedDemo() {
      await seedChild('demo', 'd1', 'عبدالله');
      const old = (await db.doc('parents/demo/children/d1').get()).get('pairing.code');
      await db.doc(`pairingCodes/${old}`).delete();
      await db.doc('pairingCodes/472918').set({
        parentUid: 'demo', childId: 'd1', status: 'active', isDemo: true,
        createdAt: Timestamp.fromDate(NOW), expiresAt: Timestamp.fromDate(new Date('2100-01-01')),
      });
    }

    it('several devices can claim it and all stay linked', async () => {
      await seedDemo();
      await claimCode(db, 'devA', '472918', NOW);
      await claimCode(db, 'devB', '472918', NOW);
      assert.strictEqual((await db.doc('childSessions/devA').get()).exists, true);
      assert.strictEqual((await db.doc('childSessions/devB').get()).exists, true);
      assert.strictEqual((await db.doc('pairingCodes/472918').get()).get('status'), 'active');
    });

    it('never expires', async () => {
      await seedDemo();
      await claimCode(db, 'devA', '472918', new Date('2099-06-01'));
    });

    it('is still rate-limited per device', async () => {
      await seedDemo();
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await rejects(claimCode(db, 'devZ', '000001', NOW), 'not-found');
      }
      await rejects(claimCode(db, 'devZ', '472918', NOW), 'resource-exhausted');
    });

    it('revoking the demo child unlinks every device', async () => {
      await seedDemo();
      await claimCode(db, 'devA', '472918', NOW);
      await claimCode(db, 'devB', '472918', NOW);
      await issueCode(db, 'demo', 'd1', { revoke: true, now: NOW });
      assert.strictEqual((await db.collection('childSessions').get()).size, 0);
    });

    it('isDemo must be exactly true — a normal code stays one-time + 24 h', async () => {
      const code = await seedChild('alice', 'c1');
      await db.doc(`pairingCodes/${code}`).update({ isDemo: 'true' }); // not the boolean
      await claimCode(db, 'dev1', code, NOW);
      await rejects(claimCode(db, 'dev2', code, NOW), 'not-found');
    });

    it('a normal claim ends every other session of that child', async () => {
      const code = await seedChild('alice', 'c1');
      await db.doc('childSessions/old1').set({ parentUid: 'alice', childId: 'c1' });
      await db.doc('childSessions/old2').set({ parentUid: 'alice', childId: 'c1' });
      await claimCode(db, 'dev1', code, NOW);
      const left = (await db.collection('childSessions').get()).docs.map((d) => d.id);
      assert.deepStrictEqual(left, ['dev1']);
    });
  });
});
