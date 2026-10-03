import { render, screen } from '@testing-library/react';

import { verifiedAyah } from '../../content/verified';
import { STORAGE_KEY } from '../../i18n/i18n';
import { LandingI18nProvider } from '../../i18n/LandingI18n';
import { LearnCards } from './shared';

afterEach(() => localStorage.clear());

test('Arabic: three cards; the Quran question quotes 112:2 from the verified Tanzil text', () => {
  render(<LearnCards desktop />);
  expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
    'تعلّم القرآن',
    'تعلّم الحديث',
    'ما هو الإسلام؟',
  ]);
  const ayah = screen.getByText(verifiedAyah(112, 2).text, { exact: false });
  expect(ayah).toHaveAttribute('lang', 'ar');
  expect(ayah.closest('span[class*="rounded"]')).toHaveTextContent(`وش معنى ﴿${verifiedAyah(112, 2).text}﴾؟`);
  expect(screen.getByText('لماذا نموت؟')).toBeInTheDocument();
  expect(screen.getByText(/المصدر: موسوعة الدرر السنية/)).toBeInTheDocument();
});

test('English: the given copy, no ayah text in the example', () => {
  localStorage.setItem(STORAGE_KEY, 'en');
  render(
    <LandingI18nProvider>
      <LearnCards />
    </LandingI18nProvider>,
  );
  expect(screen.getByText('What does "Allah, the Eternal Refuge" mean?')).toBeInTheDocument();
  expect(screen.getByText('Why do we die?')).toBeInTheDocument();
  expect(screen.getByText(/^Sources: Quran & Sunnah/)).toBeInTheDocument();
});
