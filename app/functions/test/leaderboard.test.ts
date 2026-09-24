// Pure tests + one emulator run (`npm run test:emu`).
import assert from 'assert';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { pointsDelta, rankBoard, runLeaderboard, weekKey } from '../src/leaderboard';
import { computeStats } from '../src/stats';

if (!getApps().length) initializeApp({ projectId: 'nibras-59284' });
const db = getFirestore();

describe('leaderboard', () => {
  it('week starts Saturday 00:00 Riyadh', () => {
    // Fri 2026-09-25 23:59 Riyadh = 20:59Z → still the week of Sat 09-19.
    assert.strictEqual(weekKey(new Date('2026-09-25T20:59:00Z')), '2026-09-19');
    // Sat 2026-09-26 00:00 Riyadh = Fri 21:00Z → new week.
    assert.strictEqual(weekKey(new Date('2026-09-25T21:00:00Z')), '2026-09-26');
    assert.strictEqual(weekKey(new Date('2026-09-24T12:00:00Z')), '2026-09-19'); // Thu
  });

  it('points come only from progress changes', () => {
    assert.strictEqual(pointsDelta(undefined, { ayat: 4, hadith: 1, projects: 0 }, true), 40 + 20 + 15);
    assert.strictEqual(pointsDelta({ ayat: 4, hadith: 1, projects: 1 }, { ayat: 4, hadith: 1, projects: 0 }, false), 0);
    assert.strictEqual(pointsDelta({ ayat: 4, hadith: 1, projects: 0 }, { ayat: 4, hadith: 1, projects: 1 }, false), 30);
  });

  it('stats carry weekly points and reset on a new week', () => {
    const base = { submissions: [], scheduleDays: [], completedNow: false };
    const p = [{ lessonId: 'a', doneRefs: ['112:1', '112:2'], surahsCompleted: [], hadithDone: [], completed: false }];
    const thu = new Date('2026-09-24T12:00:00Z');
    const s1 = computeStats({ ...base, progress: p, prev: undefined, now: thu });
    assert.deepStrictEqual([s1.weekKey, s1.weekPoints], ['2026-09-19', 20]);
    const s2 = computeStats({ ...base, progress: p, prev: s1, now: thu }); // no change
    assert.strictEqual(s2.weekPoints, 20);
    const nextSat = new Date('2026-09-26T06:00:00Z');
    const s3 = computeStats({ ...base, progress: p, prev: s2, now: nextSat });
    assert.deepStrictEqual([s3.weekKey, s3.weekPoints], ['2026-09-26', 0]);
  });

  it('ranking: rows are rank + points only; own standing has percentile + gap', () => {
    const now = new Date('2026-09-24T12:00:00Z');
    const entries = [100, 420, 385, 340, 310, 295, 50, 20, 10, 5].map((points, i) => ({ key: `k${i}`, points }));
    const { top, own, total } = rankBoard(entries, '2026-09-19', now);
    assert.strictEqual(total, 10);
    assert.deepStrictEqual(top, [
      { rank: 1, points: 420 }, { rank: 2, points: 385 }, { rank: 3, points: 340 },
      { rank: 4, points: 310 }, { rank: 5, points: 295 },
    ]);
    for (const row of top) assert.deepStrictEqual(Object.keys(row).sort(), ['points', 'rank']);
    const me = own.get('k5')!; // 295 → rank 5 of 10
    assert.deepStrictEqual([me.rank, me.topPercent, me.gapToAbove], [5, 50, 15]);
    assert.strictEqual(own.get('k1')!.gapToAbove, null);
    assert.strictEqual(own.get('k1')!.topPercent, 10);
    assert.strictEqual(own.get('k9')!.topPercent, 100);
  });

  describe('scheduled run (emulator)', () => {
    beforeEach(async () => {
      await db.recursiveDelete(db.collection('parents'));
      await db.recursiveDelete(db.collection('leaderboard'));
    });

    it('stores no identity of any child in the public board', async () => {
      const now = new Date('2026-09-24T12:00:00Z');
      const kids = [
        ['alice', 'c1', 'سارة', 420], ['bob', 'c2', 'يوسف', 385], ['carol', 'c3', 'ليان', 10],
      ] as const;
      for (const [p, c, name, pts] of kids) {
        await db.doc(`parents/${p}/children/${c}`).set({
          name, avatar: 'g1', stats: { weekKey: '2026-09-19', weekPoints: pts },
        });
      }
      // Last week's child is not on this week's board.
      await db.doc('parents/dave/children/c4').set({ name: 'مها', stats: { weekKey: '2026-09-12', weekPoints: 999 } });

      await runLeaderboard(db, now);
      const board = (await db.doc('leaderboard/current').get()).data()!;
      assert.deepStrictEqual(Object.keys(board).sort(), ['rows', 'total', 'updatedAt', 'weekKey']);
      assert.strictEqual(board.total, 3);
      assert.deepStrictEqual(board.rows, [
        { rank: 1, points: 420 }, { rank: 2, points: 385 }, { rank: 3, points: 10 },
      ]);
      const raw = JSON.stringify(board);
      for (const secret of ['alice', 'bob', 'carol', 'c1', 'c2', 'c3', 'سارة', 'يوسف', 'ليان', 'g1']) {
        assert.ok(!raw.includes(secret), `board leaks ${secret}`);
      }
      const own = (await db.doc('parents/carol/children/c3').get()).get('leader');
      assert.deepStrictEqual([own.rank, own.total, own.gapToAbove, own.topPercent], [3, 3, 375, 100]);
      assert.strictEqual((await db.doc('parents/dave/children/c4').get()).get('leader'), undefined);
    });
  });
});
