import { render, screen } from '@testing-library/react';

import { PILOT_CTA, PILOT_ITEMS, PILOT_PRICE } from '../../content/pilot';
import { previewChild } from '../../dev/childPreview';
import { PilotPlanCard } from './PilotPlanCard';

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

test('dashboard card: «مجانًا», days done out of 3, and each day with its surah + hadith', () => {
  render(<PilotPlanCard child={{ ...previewChild, pilotDaysDone: 1 }} />);
  expect(screen.getByText('مجانًا')).toBeInTheDocument();
  expect(screen.getByText('أنجز ١ من ٣ أيام')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  const days = screen.getAllByRole('listitem');
  expect(days).toHaveLength(3);
  expect(days[0]).toHaveTextContent('اليوم ١: سورة الإخلاص');
  expect(days[0]).toHaveTextContent('حديث برّ الوالدين');
  expect(days[0]).toHaveTextContent('مكتمل');
  expect(days[1]).toHaveTextContent('اليوم ٢: سورة الناس');
  expect(days[1]).toHaveTextContent('حديث عن الكذب');
  expect(days[1]).toHaveTextContent('الحالي');
  expect(days[2]).toHaveTextContent('اليوم ٣: سورة الفلق');
  expect(days[2]).toHaveTextContent('حديث عن الغضب');
  expect(days[2]).toHaveTextContent('لاحقًا');
});

test('all three days done → 100٪', () => {
  render(<PilotPlanCard child={{ ...previewChild, pilotDaysDone: 3 }} />);
  expect(screen.getByText('أنجز ٣ من ٣ أيام')).toBeInTheDocument();
  expect(screen.getByText('١٠٠٪')).toBeInTheDocument();
});
