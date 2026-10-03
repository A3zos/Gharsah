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
  // the teacher's short replies, with the teacher's name on each
  expect(screen.getByText('ابدأ بمساعدة أمك في البيت 💛')).toBeInTheDocument();
  expect(screen.getAllByText('المعلم عبدالله')).toHaveLength(3);
  // sources: «المصدر» + one chip per source
  expect(screen.getAllByText('المصدر')).toHaveLength(3);
  expect(screen.getByText('موسوعة الدرر السنية')).toBeInTheDocument();
  expect(screen.getByText('التفسير الميسّر (مجمع الملك فهد)')).toBeInTheDocument();
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
  expect(screen.getByText("Great questions! Let's discover the answer together…")).toBeInTheDocument();
  expect(screen.getAllByText('Teacher Abdullah')).toHaveLength(3);
  expect(screen.getAllByText('Sources')).toHaveLength(3);
  expect(screen.getByText('Quran & Sunnah')).toBeInTheDocument();
});
