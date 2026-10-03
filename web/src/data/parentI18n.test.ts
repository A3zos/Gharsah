// The parent area's data-layer copy in English / Indonesian — Arabic stays exactly as before.
import { previewChild } from '../dev/childPreview';
import { DEFAULT_SCHEDULE, formatTime, reviewDayNames } from './children';
import { planLabel } from './parent';
import { pilotPlan, planProgress, planSentence } from './planProgress';
import { ageLabel, childrenCount, pilotChip, stageLabel, STAGE_LABEL } from './stats';
import { formatDuration } from './submissions';

const NOW = new Date('2026-10-05T09:00:00Z');
const child = { ...previewChild, createdAt: NOW, pilotDaysDone: 1, pilotDoneAt: {} };

test('Arabic output is unchanged (the default language)', () => {
  expect(pilotChip(0)).toBe('اليوم ١ من ٣');
  expect(pilotChip(3)).toBe('أتمّ الباقة التجريبية ✓');
  expect(ageLabel(10)).toBe('١٠ سنوات');
  expect(ageLabel(12)).toBe('١٢ سنة');
  expect([0, 1, 2, 3, 11].map((n) => childrenCount(n))).toEqual([
    'لا أبناء بعد',
    'ابن واحد',
    'ابنان',
    '٣ أبناء',
    '١١ ابنًا',
  ]);
  expect(STAGE_LABEL).toEqual({ seed: 'بذرة', sprout: 'غَرْسة', tree: 'شجرة' });
  expect(formatTime(17 * 60)).toBe('٥:٠٠ مساءً');
  expect(reviewDayNames({ ...DEFAULT_SCHEDULE, reviewDays: ['sun', 'thu'] })).toBe('الأحد، الخميس');
  expect(formatDuration(44_000)).toBe('٠:٤٤');
  expect(planLabel('annual')).toBe('سنوية');
});

test('English: plan steps, sentence, chips and counts', () => {
  expect(pilotPlan('en').steps.map((s) => `${s.title}: ${s.detail}`)).toEqual([
    'Day 1: Surah Al-Ikhlas + hadith on kindness to parents',
    'Day 2: Surah An-Nas + hadith on lying',
    'Day 3: Surah Al-Falaq + hadith on anger',
  ]);
  const p = planProgress(child, NOW, 'en');
  expect(planSentence(p, 'en')).toBe('1 of 3 days done (33%) of the Free trial plan');
  expect(pilotChip(1, 'en')).toBe('Day 2 of 3');
  expect(childrenCount(1, 'en')).toBe('1 child');
  expect(childrenCount(4, 'en')).toBe('4 children');
  expect(ageLabel(9, 'en')).toBe('9 years old');
  expect(stageLabel('sprout', 'en')).toBe('Sapling');
  expect(formatTime(17 * 60, 'en')).toBe('5:00 PM');
  expect(reviewDayNames({ ...DEFAULT_SCHEDULE, reviewDays: ['sun', 'thu'] }, 'en')).toBe('Sunday, Thursday');
  expect(formatDuration(44_000, 'en')).toBe('0:44');
});

test('Indonesian: glossary words and Latin digits', () => {
  expect(pilotChip(3, 'id')).toBe('Paket uji coba gratis selesai ✓');
  expect(childrenCount(0, 'id')).toBe('Belum ada anak');
  expect(ageLabel(12, 'id')).toBe('12 tahun');
  expect(stageLabel('seed', 'id')).toBe('Benih');
  expect(reviewDayNames({ ...DEFAULT_SCHEDULE, reviewDays: ['thu'] }, 'id')).toBe('Kamis');
  expect(planLabel('monthly', 'id')).toBe('bulanan');
});
