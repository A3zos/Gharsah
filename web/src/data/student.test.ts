import { pickTodayLesson, progressFromRow, type StoredProgress } from './student';

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
