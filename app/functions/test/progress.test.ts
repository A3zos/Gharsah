// Runs against the Firestore emulator: `npm run test:emu` (from app/functions).
import assert from 'assert';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { cleanup, deleteChildData, FileStore, recomputeStats, verifySubmission } from '../src/progress';

if (!getApps().length) initializeApp({ projectId: 'nibras-59284' });
const db = getFirestore();
const NOW = new Date('2026-09-24T15:00:00Z');
const daysAgo = (n: number) => Timestamp.fromMillis(NOW.getTime() - n * 86400000);

class MemFiles implements FileStore {
  files = new Set<string>();
  async exists(p: string) { return this.files.has(p); }
  async delete(p: string) { this.files.delete(p); }
  async deletePrefix(prefix: string) {
    for (const f of [...this.files]) if (f.startsWith(prefix)) this.files.delete(f);
  }
}

const child = 'parents/alice/children/c1';

async function reset() {
  for (const c of ['parents', 'pairingCodes', 'childSessions', 'rateLimits']) {
    await db.recursiveDelete(db.collection(c));
  }
  await db.doc(child).set({ name: 'سارة', schedule: { days: ['thu'] }, linkedDeviceUid: 'dev1',
    pairing: { code: '123456', status: 'claimed' } });
}

describe('progress triggers', () => {
  beforeEach(reset);

  it('recompute writes stats from progress + submissions', async () => {
    await db.doc(`${child}/progress/m01-w03-ikhlas`).set({
      lessonId: 'm01-w03-ikhlas', doneRefs: ['112:1', '112:2', '112:3', '112:4'],
      surahsCompleted: [112], hadithDone: ['h1'], projectAssigned: 'birr-3-acts',
      reportedProject: null, completed: true,
    });
    await recomputeStats(db, 'alice', 'c1', { completedNow: true, now: NOW });
    const s = (await db.doc(child).get()).get('stats');
    assert.deepStrictEqual([s.ayat, s.surahs, s.hadith, s.projects, s.streak, s.pendingProject],
      [4, 1, 1, 0, 1, 'birr-3-acts']);

    await db.doc(`${child}/submissions/s1`).set({ projectId: 'birr-3-acts', storagePath: 'x' });
    await recomputeStats(db, 'alice', 'c1', { completedNow: false, now: NOW });
    const s2 = (await db.doc(child).get()).get('stats');
    assert.strictEqual(s2.projects, 1);
    assert.strictEqual(s2.pendingProject, null);
    assert.strictEqual(s2.streak, 1); // lesson day remembered
  });

  it('recompute on a deleted child is a no-op', async () => {
    await db.doc(child).delete();
    assert.strictEqual(await recomputeStats(db, 'alice', 'c1', { completedNow: false }), null);
  });

  it('a submission without its recording is removed', async () => {
    const files = new MemFiles();
    await db.doc(`${child}/submissions/ok`).set({ storagePath: 'recordings/alice/c1/ok.m4a' });
    await db.doc(`${child}/submissions/bad`).set({ storagePath: 'recordings/alice/c1/bad.m4a' });
    files.files.add('recordings/alice/c1/ok.m4a');
    assert.strictEqual(await verifySubmission(db, files, 'alice', 'c1', 'ok'), true);
    assert.strictEqual(await verifySubmission(db, files, 'alice', 'c1', 'bad'), false);
    assert.strictEqual((await db.doc(`${child}/submissions/bad`).get()).exists, false);
  });

  it('daily cleanup: recordings > 90 days, dead codes, old rate limits', async () => {
    const files = new MemFiles();
    files.files.add('recordings/alice/c1/old.m4a');
    files.files.add('recordings/alice/c1/new.m4a');
    await db.doc(`${child}/submissions/old`).set({ storagePath: 'recordings/alice/c1/old.m4a', createdAt: daysAgo(91) });
    await db.doc(`${child}/submissions/new`).set({ storagePath: 'recordings/alice/c1/new.m4a', createdAt: daysAgo(89) });
    await db.doc('pairingCodes/111111').set({ expiresAt: daysAgo(3) });
    await db.doc('pairingCodes/222222').set({ expiresAt: daysAgo(-1) });
    await db.doc('rateLimits/dev9').set({ windowStart: daysAgo(2) });
    const r = await cleanup(db, files, NOW);
    assert.deepStrictEqual(r, { recordings: 1, codes: 1, limits: 1 });
    assert.deepStrictEqual([...files.files], ['recordings/alice/c1/new.m4a']);
    assert.strictEqual((await db.doc(`${child}/submissions/new`).get()).exists, true);
    assert.strictEqual((await db.doc('pairingCodes/222222').get()).exists, true);
  });

  it('removing a child deletes its progress, recordings, code and session', async () => {
    const files = new MemFiles();
    files.files.add('recordings/alice/c1/a.m4a');
    files.files.add('recordings/alice/c2/b.m4a');
    await db.doc(`${child}/progress/m01`).set({ doneRefs: [] });
    await db.doc(`${child}/submissions/a`).set({ storagePath: 'recordings/alice/c1/a.m4a' });
    await db.doc('pairingCodes/123456').set({ parentUid: 'alice', childId: 'c1' });
    await db.doc('childSessions/dev1').set({ parentUid: 'alice', childId: 'c1' });
    const data = (await db.doc(child).get()).data()!;
    await db.doc(child).delete();
    await deleteChildData(db, files, 'alice', 'c1', data);
    assert.strictEqual((await db.collection(`${child}/progress`).get()).size, 0);
    assert.strictEqual((await db.collection(`${child}/submissions`).get()).size, 0);
    assert.deepStrictEqual([...files.files], ['recordings/alice/c2/b.m4a']);
    assert.strictEqual((await db.doc('pairingCodes/123456').get()).exists, false);
    assert.strictEqual((await db.doc('childSessions/dev1').get()).exists, false);
  });
});
