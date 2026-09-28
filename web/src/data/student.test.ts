import { parseBoard, pickTodayLesson, progressFromRow, type StoredProgress } from './student';

const stored = (
  lessonId: string,
  row: Record<string, unknown>,
  updatedAt: Date,
): [string, StoredProgress] => [lessonId, { progress: progressFromRow(lessonId, row), updatedAt }];

test('a lesson whose progress row is stage «done» today locks the day: «إلى اللقاء غدًا»', () => {
  const now = new Date(2026, 8, 28, 19);
  const m = new Map([
    stored('m01-w03-ikhlas', { stage: 'done', step_index: 14, done_refs: [] }, new Date(2026, 8, 28, 18)),
  ]);
  expect(pickTodayLesson(m, now)).toEqual({ kind: 'doneToday', lessonId: 'm01-w03-ikhlas' });
});

test('the next day the next lesson opens', () => {
  const m = new Map([stored('m01-w03-ikhlas', { stage: 'done', step_index: 14 }, new Date(2026, 8, 28, 18))]);
  expect(pickTodayLesson(m, new Date(2026, 8, 29, 9))).toMatchObject({
    kind: 'available',
    lessonId: 'm01-w03-day2',
  });
});

test('a lesson not finished yet stays available and resumes at its step', () => {
  const m = new Map([
    stored('m01-w03-ikhlas', { stage: 'ayah_repeat', step_index: 6 }, new Date(2026, 8, 28, 18)),
  ]);
  const t = pickTodayLesson(m, new Date(2026, 8, 28, 19));
  expect(t).toMatchObject({ kind: 'available', lessonId: 'm01-w03-ikhlas' });
  expect(t.kind === 'available' && t.resume?.stepIndex).toBe(6);
});

test('parseBoard reads the new payload and the previous one', () => {
  const now = parseBoard({
    weekKey: '2026-09-26',
    total: 22,
    top: [{ rank: 1, points: 30, avatar: 'neutral', me: false }],
    me: { rank: 20, points: 4, gapToAbove: 8, inTop5: false, firstName: 'بدر', avatar: 'b1' },
  });
  expect(now.me).toEqual({ rank: 20, points: 4, gapToAbove: 8, inTop5: false });
  expect(now.top).toEqual([{ rank: 1, points: 30, me: false }]);
  const old = parseBoard({
    weekKey: '2026-09-26',
    total: 3,
    rows: [{ rank: 1, stars: 7, me: true, firstName: 'بدر' }],
    own: { rank: 1, stars: 7, total: 3, topPercent: 10, gapToAbove: null },
  });
  expect(old.top).toEqual([{ rank: 1, points: 7, me: true }]);
  expect(old.me).toEqual({ rank: 1, points: 7, gapToAbove: null, inTop5: true });
});
