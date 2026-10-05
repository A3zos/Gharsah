import { PILOT_DAYS } from '../content/pilot';
import { parseBoard, pickTodayLesson, progressFromRow, surahDoneToday, type StoredProgress } from './student';

const stored = (
  lessonId: string,
  row: Record<string, unknown>,
  completedAt: Date | null,
): [string, StoredProgress] => [
  lessonId,
  { progress: progressFromRow(lessonId, row), updatedAt: completedAt, completedAt },
];

// Times in UTC; Riyadh is UTC+3 (no DST) — 21:30 UTC is already the next Riyadh day.
const utc = (d: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, d, h, m));
const done = { stage: 'done', step_index: 10, done_refs: [] };

test('the pilot plan in order: الإخلاص+برّ، الناس+الكذب، الفلق+الغضب', () => {
  expect(PILOT_DAYS.map((d) => [d.lessonId, d.surahName, d.hadithTopic])).toEqual([
    ['pilot-day-1', 'الإخلاص', 'برّ الوالدين'],
    ['pilot-day-2', 'الناس', 'الكذب'],
    ['pilot-day-3', 'الفلق', 'الغضب'],
  ]);
});

test('a new child gets day 1 only', () => {
  expect(pickTodayLesson(new Map(), utc(2, 9))).toEqual({
    kind: 'available',
    lessonId: 'pilot-day-1',
    day: 1,
    resume: null,
  });
});

test('day 1 finished today → «إلى اللقاء غدًا»; day 2 waits for the next Riyadh day', () => {
  const m = new Map([stored('pilot-day-1', done, utc(2, 15))]);
  expect(pickTodayLesson(m, utc(2, 20))).toEqual({ kind: 'doneToday', lessonId: 'pilot-day-1', day: 1 });
  // 21:30 UTC = 00:30 Riyadh the next day
  expect(pickTodayLesson(m, utc(2, 21, 30))).toMatchObject({
    kind: 'available',
    lessonId: 'pilot-day-2',
    day: 2,
  });
});

test('the Riyadh day decides, not the device clock: 22:00 UTC finish counts for the next day', () => {
  // finished 01:00 Riyadh on the 3rd → day 2 opens on the 4th (Riyadh), not later the same day
  const m = new Map([stored('pilot-day-1', done, utc(2, 22))]);
  expect(pickTodayLesson(m, utc(3, 20))).toMatchObject({ kind: 'doneToday', day: 1 });
  expect(pickTodayLesson(m, utc(3, 21, 5))).toMatchObject({ kind: 'available', lessonId: 'pilot-day-2' });
});

test('an unfinished day stays open (across days) and resumes at its step', () => {
  const m = new Map([stored('pilot-day-1', { stage: 'ayah_repeat', step_index: 6 }, null)]);
  const t = pickTodayLesson(m, utc(5, 9));
  expect(t).toMatchObject({ kind: 'available', lessonId: 'pilot-day-1', day: 1 });
  expect(t.kind === 'available' && t.resume?.stepIndex).toBe(6);
});

test('only after the previous day: day 3 never opens while day 2 is unfinished', () => {
  const m = new Map([stored('pilot-day-1', done, utc(2, 9))]);
  expect(pickTodayLesson(m, utc(9, 9))).toMatchObject({ kind: 'available', lessonId: 'pilot-day-2', day: 2 });
});

test('after day 3: the plan is complete', () => {
  const m = new Map([
    stored('pilot-day-1', done, utc(2, 9)),
    stored('pilot-day-2', done, utc(3, 9)),
    stored('pilot-day-3', done, utc(4, 9)),
  ]);
  expect(pickTodayLesson(m, utc(4, 10))).toEqual({ kind: 'planDone', lessonId: 'pilot-day-3', day: 3 });
  expect(pickTodayLesson(m, utc(8, 10))).toMatchObject({ kind: 'planDone' });
});

test('old interim lessons are not part of the plan', () => {
  const m = new Map([stored('m01-w03-ikhlas', { stage: 'done', step_index: 14 }, utc(1, 9))]);
  expect(pickTodayLesson(m, utc(2, 9))).toMatchObject({ kind: 'available', lessonId: 'pilot-day-1' });
});

test('parseBoard reads the new payload and the previous one', () => {
  const now = parseBoard({
    weekKey: '2026-09-26',
    total: 22,
    top: [{ rank: 1, points: 30, avatar: 'girl-3', me: false }],
    me: { rank: 20, points: 4, gapToAbove: 8, inTop5: false, firstName: 'بدر', avatar: 'boy-1' },
  });
  expect(now.me).toEqual({ rank: 20, points: 4, gapToAbove: 8, inTop5: false, firstName: 'بدر' });
  // a board from before 20261005100000: the avatar key only
  expect(now.top).toEqual([{ rank: 1, points: 30, me: false, avatar: 'girl-3' }]);
  const old = parseBoard({
    weekKey: '2026-09-26',
    total: 3,
    rows: [{ rank: 1, stars: 7, me: true, firstName: 'بدر' }],
    own: { rank: 1, stars: 7, total: 3, topPercent: 10, gapToAbove: null },
  });
  expect(old.top).toEqual([{ rank: 1, points: 7, me: true, firstName: 'بدر' }]);
  expect(old.me).toEqual({ rank: 1, points: 7, gapToAbove: null, inTop5: true });
});

test("parseBoard: every row's first name + father + country; «بطل» rows carry no name", () => {
  const b = parseBoard({
    weekKey: '2026-10-03',
    total: 3,
    top: [
      {
        rank: 1,
        points: 14,
        me: false,
        avatar: 'boy-2',
        firstName: 'فهد',
        fatherName: 'سلمان',
        displayName: 'فهد سلمان',
        hero: null,
        country: 'SA',
      },
      {
        rank: 2,
        points: 12,
        me: false,
        avatar: 'id-boy-1',
        firstName: 'Rizky',
        fatherName: 'Ahmad',
        country: 'ID',
      },
      {
        rank: 3,
        points: 9,
        me: false,
        avatar: 'girl-1',
        firstName: null,
        fatherName: 'x',
        displayName: 'بطلة',
        hero: 'girl',
        country: 'US',
      },
      { rank: 4, points: 2, me: true, avatar: 'boy-1', firstName: 'عمر', fatherName: null, country: 'XX' },
    ],
    me: { rank: 4, points: 2, gapToAbove: 7, inTop5: true, firstName: 'عمر', ownFirstName: 'عمر' },
  });
  expect(b.top[0]).toMatchObject({ firstName: 'فهد', fatherName: 'سلمان', country: 'SA' });
  expect(b.top[0]).not.toHaveProperty('hero');
  expect(b.top[1]).toMatchObject({ firstName: 'Rizky', fatherName: 'Ahmad', country: 'ID' });
  // a hidden child: «بطلة» only — a stray father name is dropped
  expect(b.top[2]).toEqual({ rank: 3, points: 9, me: false, avatar: 'girl-1', hero: 'girl', country: 'US' });
  // an unknown country → no flag; no father → the first name alone
  expect(b.top[3]).toEqual({ rank: 4, points: 2, me: true, avatar: 'boy-1', firstName: 'عمر' });
});

describe("surahDoneToday — where today's lesson starts", () => {
  const row = (step: number, updatedAt: Date | null): StoredProgress => ({
    progress: progressFromRow('pilot-day-1', {
      stage: step >= 9 ? 'hadith' : 'ayah_repeat',
      step_index: step,
      done_refs: [],
    }),
    updatedAt,
  });
  const now = utc(5, 10); // 13:00 Riyadh

  it('a new child (no row) or the surah not finished → the surah', () => {
    expect(surahDoneToday(undefined, 9, now)).toBe(false);
    expect(surahDoneToday(row(4, utc(5, 9)), 9, now)).toBe(false);
  });

  it('surah finished earlier today → the hadith; finished on an earlier day → the surah again', () => {
    expect(surahDoneToday(row(9, utc(5, 8)), 9, now)).toBe(true);
    expect(surahDoneToday(row(9, utc(4, 8)), 9, now)).toBe(false);
    // 21:30 UTC on the 4th is already the 5th in Riyadh
    expect(surahDoneToday(row(9, utc(4, 21, 30)), 9, now)).toBe(true);
    expect(surahDoneToday(row(9, null), 9, now)).toBe(false);
  });
});
