import { render, screen } from '@testing-library/react';

import type { AdminStats } from '../../data/admin';
import { AdminView } from './AdminView';

test('not an admin: a plain «غير مصرّح» page — no numbers, no refresh', () => {
  render(<AdminView state={{ kind: 'forbidden' }} onRefresh={() => {}} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('غير مصرّح');
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText('أولياء الأمور')).toBeNull();
  expect(document.body.textContent).not.toMatch(/[0-9٠-٩]/);
});

test('an admin: KPI cards, the charts and «آخر تحديث» with Arabic-Indic digits', () => {
  const day = (k: number) => `2026-09-${String(k).padStart(2, '0')}`;
  const stats: AdminStats = {
    generatedAt: '2026-09-29T10:00:00Z',
    parents: { total: 12, today: 1, last7: 4, last30: 12 },
    children: { total: 15, byAge: { '8-9': 5, '10-11': 6, '12-13': 4 }, byGender: { boy: 8, girl: 7 } },
    pairedDevices: 9,
    subscriptions: { monthly: 3, annual: 5, trial: 1, none: 3, active: 9 },
    lessons: {
      started: 20,
      completed: 10,
      completionRate: 50,
      byLesson: [{ lessonId: 'm01-w03-ikhlas', title: 'سورة الإخلاص', started: 20, completed: 10, rate: 50 }],
    },
    memorization: { ayat: 40, surahs: 8, hadith: 0 },
    projects: { assigned: 10, reported: 4, reportRate: 40 },
    engagement: { activeToday: 3, active7: 7, lessonsPerActiveChild: 2.9 },
    daily: Array.from({ length: 30 }, (_, k) => ({
      day: day(k + 1),
      newParents: k % 3,
      lessonsCompleted: k % 2,
    })),
  };
  render(
    <AdminView
      state={{ kind: 'ok', stats, loadedAt: new Date('2026-09-29T10:00:00Z') }}
      onRefresh={() => {}}
    />,
  );
  expect(screen.getByText('نسبة الإكمال')).toBeInTheDocument();
  expect(screen.getAllByText('٥٠٪')).toHaveLength(2); // the KPI card and the lessons table
  expect(screen.getByText(/آخر تحديث/)).toBeInTheDocument();
  expect(screen.getAllByRole('img')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'تحديث' })).toBeEnabled();
});
