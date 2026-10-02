import { PILOT_CTA, PILOT_ITEMS, PILOT_PRICE } from '../content/pilot';
import { previewChild } from '../dev/childPreview';
import { PILOT_PLAN, planProgress, planSentence, planStage, planSubtitle } from './planProgress';

// Riyadh = UTC+3; noon Riyadh on 2026-10-05
const NOW = new Date('2026-10-05T09:00:00Z');
const at = (ymd: string) => new Date(`${ymd}T09:00:00Z`);
const child = (doneAt: Record<string, Date>, createdAt: Date | null = at('2026-10-05')) => ({
  ...previewChild,
  createdAt,
  pilotDaysDone: Object.keys(doneAt).length,
  pilotDoneAt: doneAt,
});

test('the free pilot: 3 surahs, 3 hadiths, one lesson a day, up to 3 children', () => {
  expect(PILOT_PRICE).toBe('مجانًا');
  expect(PILOT_CTA).toBe('ابدأ مجانًا');
  expect(PILOT_ITEMS).toEqual([
    '٣ سور (الإخلاص، الناس، الفلق)',
    '٣ أحاديث',
    'حصة واحدة كل يوم',
    'حتى ٣ أطفال',
  ]);
});

test('the pilot steps come from the plan data, in order', () => {
  expect(PILOT_PLAN.steps.map((s) => `${s.title}: ${s.detail}`)).toEqual([
    'اليوم ١: سورة الإخلاص + حديث برّ الوالدين',
    'اليوم ٢: سورة الناس + حديث عن الكذب',
    'اليوم ٣: سورة الفلق + حديث عن الغضب',
  ]);
});

test('nothing done: day 1 is today, day 2 opens tomorrow, 0٪ بذرة', () => {
  const p = planProgress(child({}), NOW);
  expect(p.steps.map((s) => s.state)).toEqual(['today', 'locked', 'locked']);
  expect(p.steps.map((s) => s.tomorrow)).toEqual([false, true, false]);
  expect([p.pct, p.stage]).toEqual([0, 'seed']);
  expect(planSentence(p)).toBe('أتمّ ٠ من ٣ أيام (٠٪) من الباقة التجريبية');
  expect(planSubtitle('١٠ سنوات', p)).toBe('١٠ سنوات · حصة واحدة يوميًا · الباقة التجريبية');
});

test('day 1 done today: done with its date, day 2 opens tomorrow, 33٪', () => {
  const p = planProgress(child({ 'pilot-day-1': at('2026-10-05') }), NOW);
  expect(p.steps.map((s) => s.state)).toEqual(['done', 'locked', 'locked']);
  expect(p.steps[0]!.doneAt).toEqual(at('2026-10-05'));
  expect(p.steps[1]!.tomorrow).toBe(true);
  expect([p.pct, p.stage]).toEqual([33, 'seed']);
  expect(planSentence(p)).toBe('أتمّ ١ من ٣ أيام (٣٣٪) من الباقة التجريبية');
});

test('day 1 done yesterday: day 2 is today, 2/3 → 67٪ غَرْسة', () => {
  expect(planProgress(child({ 'pilot-day-1': at('2026-10-04') }), NOW).steps[1]!.state).toBe('today');
  const p = planProgress(child({ 'pilot-day-1': at('2026-10-03'), 'pilot-day-2': at('2026-10-04') }), NOW);
  expect(p.steps.map((s) => s.state)).toEqual(['done', 'done', 'today']);
  expect([p.pct, p.stage]).toEqual([67, 'sprout']);
});

test('a day passed without a lesson → فاته', () => {
  expect(planProgress(child({ 'pilot-day-1': at('2026-10-02') }), NOW).steps[1]!.state).toBe('missed');
  expect(planProgress(child({}, at('2026-10-03')), NOW).steps[0]!.state).toBe('missed');
});

test('all done → 100٪ شجرة, «أكمل الباقة التجريبية 🎉»', () => {
  const p = planProgress(
    child({
      'pilot-day-1': at('2026-10-01'),
      'pilot-day-2': at('2026-10-02'),
      'pilot-day-3': at('2026-10-03'),
    }),
    NOW,
  );
  expect([p.pct, p.stage]).toEqual([100, 'tree']);
  expect(planSentence(p)).toBe('أكمل الباقة التجريبية 🎉');
});

test('badge: بذرة 0–33, غَرْسة 34–99, شجرة 100', () => {
  expect([0, 33, 34, 99, 100].map(planStage)).toEqual(['seed', 'seed', 'sprout', 'sprout', 'tree']);
});
