import assert from 'assert';
import { Timestamp } from 'firebase-admin/firestore';

import { computeStats, dayKey, PLAN_TOTAL_AYAT, ProgressDoc, stageOf, streak } from '../src/stats';

// 2026-09-24 is a Thursday. Saturday-first week: sat sun mon tue wed thu fri.
const THU = new Date('2026-09-24T15:00:00Z'); // 18:00 Riyadh

const p = (over: Partial<ProgressDoc> = {}): ProgressDoc => ({
  lessonId: 'm01-w03-ikhlas',
  doneRefs: [],
  surahsCompleted: [],
  hadithDone: [],
  projectAssigned: null,
  reportedProject: null,
  completed: false,
  ...over,
});

describe('stats (pure)', () => {
  it('yearly plan is 295 ayat (config)', () => {
    assert.strictEqual(PLAN_TOTAL_AYAT, 295);
  });

  it('day key uses Riyadh time', () => {
    assert.strictEqual(dayKey(new Date('2026-09-24T22:30:00Z')), '2026-09-25');
    assert.strictEqual(dayKey(new Date('2026-09-24T20:30:00Z')), '2026-09-24');
  });

  it('growth stages at the design thresholds', () => {
    assert.deepStrictEqual([0, 33, 34, 66, 67, 100].map(stageOf),
      ['seed', 'seed', 'sprout', 'sprout', 'tree', 'tree']);
  });

  describe('streak = consecutive SCHEDULED days', () => {
    const sched = ['sat', 'sun', 'mon', 'wed']; // no lesson on thu/fri/tue

    it('counts scheduled days only, skipping unscheduled ones', () => {
      // Wed 23, Mon 21, Sun 20, Sat 19 all done; today (Thu) isn't scheduled.
      assert.strictEqual(streak(['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-23'], sched, THU), 4);
    });

    it('a missed scheduled day breaks it', () => {
      // Mon 21 missed.
      assert.strictEqual(streak(['2026-09-19', '2026-09-20', '2026-09-23'], sched, THU), 1);
    });

    it("today not done yet doesn't break it; done today counts", () => {
      const thuSched = ['wed', 'thu'];
      assert.strictEqual(streak(['2026-09-23'], thuSched, THU), 1);
      assert.strictEqual(streak(['2026-09-23', '2026-09-24'], thuSched, THU), 2);
    });

    it('extra lessons on unscheduled days neither count nor break', () => {
      assert.strictEqual(streak(['2026-09-22', '2026-09-23'], sched, THU), 1); // tue extra
    });

    it('no schedule → 0', () => {
      assert.strictEqual(streak(['2026-09-24'], [], THU), 0);
    });
  });

  it('aggregates ayat, surahs, hadith, pending project; keeps first dates', () => {
    const early = Timestamp.fromDate(new Date('2026-09-01T10:00:00Z'));
    const s = computeStats({
      progress: [
        p({ doneRefs: ['112:1', '112:2', '112:3', '112:4'], surahsCompleted: [112],
            hadithDone: ['h1'], projectAssigned: 'birr-3-acts', completed: true }),
        p({ lessonId: 'x', doneRefs: ['113:1', '113:2', '112:1', 'junk'] }),
      ],
      submissions: [],
      prev: { surahsDone: [{ surah: 112, at: early }], ayatBySurah: { '112': 4 } },
      scheduleDays: ['thu'],
      completedNow: true,
      now: THU,
    });
    assert.strictEqual(s.ayat, 6); // de-duplicated, junk ignored
    assert.deepStrictEqual(s.ayatBySurah, { '112': 4, '113': 2 });
    assert.strictEqual(s.surahs, 1);
    assert.strictEqual(s.surahsDone[0].at.toMillis(), early.toMillis());
    assert.deepStrictEqual(s.surahInProgress, { surah: 113, done: 2 });
    assert.strictEqual(s.latestAyat?.surah, 113);
    assert.strictEqual(s.latestAyat?.count, 2);
    assert.strictEqual(s.hadith, 1);
    assert.strictEqual(s.pendingProject, 'birr-3-acts');
    assert.strictEqual(s.planPct, 2); // 6 / 295
    assert.strictEqual(s.stage, 'seed');
    assert.deepStrictEqual(s.lessonDays, ['2026-09-24']);
    assert.strictEqual(s.streak, 1);
  });

  it('a report (submission or reportedProject) clears the pending project', () => {
    const base = { prev: undefined, scheduleDays: [], completedNow: false, now: THU };
    const assigned = p({ projectAssigned: 'birr-3-acts' });
    assert.strictEqual(
      computeStats({ ...base, progress: [assigned], submissions: [{ projectId: 'birr-3-acts' }] }).pendingProject,
      null,
    );
    assert.strictEqual(
      computeStats({ ...base, progress: [assigned, p({ lessonId: 'd2', reportedProject: 'birr-3-acts' })], submissions: [] }).pendingProject,
      null,
    );
  });

  it('plan % caps at 100', () => {
    const refs: string[] = [];
    for (let s = 1; s <= 3; s++) for (let a = 1; a <= 110; a++) refs.push(`${s}:${a}`);
    const st = computeStats({ progress: [p({ doneRefs: refs })], submissions: [], prev: undefined,
      scheduleDays: [], completedNow: false, now: THU });
    assert.strictEqual(st.planPct, 100);
    assert.strictEqual(st.stage, 'tree');
  });
});
