import { render, screen, within } from '@testing-library/react';

import { PlanCards } from './PlanCards';

test('three plans in order: the free pilot first, then monthly, then yearly', () => {
  render(<PlanCards pilotAction={<button type="button">ابدأ مجانًا</button>} />);
  const cards = screen.getAllByRole('region');
  expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual([
    'الباقة التجريبية',
    'الباقة الشهرية',
    'الباقة السنوية',
  ]);
  const [pilot, monthly, yearly] = cards as [HTMLElement, HTMLElement, HTMLElement];

  expect(within(pilot).getByText('متاحة الآن')).toBeInTheDocument();
  expect(within(pilot).getByText('مجانًا')).toBeInTheDocument();
  expect(within(pilot).getByText('٣ أيام — يومًا بعد يوم')).toBeInTheDocument();
  expect(within(pilot).getByText('حتى ٣ أطفال')).toBeInTheDocument();
  expect(
    within(pilot)
      .getAllByRole('listitem')
      .some((li) => /اليوم ٣: سورة الفلق/.test(li.textContent ?? '')),
  ).toBe(true);
  expect(within(pilot).getByRole('button', { name: 'ابدأ مجانًا' })).toBeEnabled();

  expect(within(monthly).getByText('٢٩')).toBeInTheDocument();
  expect(within(monthly).getByText('ريال / شهر')).toBeInTheDocument();
  expect(within(yearly).getByText('١١٩')).toBeInTheDocument();
  expect(within(yearly).getByText('ريال / سنة')).toBeInTheDocument();
  expect(within(yearly).getByText('أقل من ١٠ ريالات في الشهر')).toBeInTheDocument();
  for (const soon of [monthly, yearly]) {
    expect(soon).toHaveAttribute('aria-disabled', 'true');
    expect(within(soon).getAllByText('قريبًا')).toHaveLength(2); // badge + button
    expect(within(soon).getByRole('button', { name: 'قريبًا' })).toBeDisabled();
  }
});
