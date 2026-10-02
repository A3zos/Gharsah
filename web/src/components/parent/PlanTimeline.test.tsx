import { render, screen, within } from '@testing-library/react';

import { previewChild } from '../../dev/childPreview';
import { planProgress } from '../../data/planProgress';
import { PlanTimeline } from './PlanTimeline';

const NOW = new Date('2026-10-05T09:00:00Z');

test('the plan steps with their states, the bar and the sentence', () => {
  const child = {
    ...previewChild,
    createdAt: new Date('2026-10-03T09:00:00Z'),
    pilotDaysDone: 1,
    pilotDoneAt: { 'pilot-day-1': new Date('2026-10-04T09:00:00Z') },
    pilotUnscored: ['pilot-day-1'],
  };
  render(<PlanTimeline progress={planProgress(child, NOW)} unscored={child.pilotUnscored} />);
  const steps = within(screen.getByRole('list', { name: 'خطة الباقة التجريبية' })).getAllByRole('listitem');
  expect(steps).toHaveLength(3);
  expect(steps[0]).toHaveTextContent('اليوم ١');
  expect(steps[0]).toHaveTextContent('سورة الإخلاص + حديث برّ الوالدين');
  expect(steps[0]).toHaveTextContent(/مكتمل · /);
  expect(steps[0]).toHaveTextContent('سؤال الحديث: لم يُقيَّم');
  expect(steps[1]).toHaveTextContent('اليوم');
  expect(steps[1]).toHaveAttribute('aria-current', 'step');
  expect(steps[2]).toHaveTextContent('يُفتح غدًا');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
  expect(screen.getByText('أتمّ ١ من ٣ أيام (٣٣٪) من الباقة التجريبية')).toBeInTheDocument();
});
