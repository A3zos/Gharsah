// The parent pages follow the UI language: Arabic (rtl) by default, English / Indonesian (ltr).
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ParentDataContext, type ParentData } from '../../components/parent/ParentData';
import { childFromRow } from '../../data/children';
import { STORAGE_KEY } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import ChildrenRoute from './children';
import SettingsRoute from './settings';

const child = childFromRow(
  { id: 'c1', name: 'Sara', age: 10, gender: 'girl', created_at: '2026-10-01T09:00:00Z' },
  {
    pairing: {
      code: '472918',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      status: 'active',
      linked: true,
    },
  },
);

const data: ParentData = {
  uid: 'p1',
  email: 'parent@example.com',
  profile: { name: 'Abu Sara', email: 'parent@example.com' },
  children: [child],
  subscription: null,
  error: null,
};

function page(ui: React.ReactNode, lang?: 'ar' | 'en' | 'id') {
  if (lang) localStorage.setItem(STORAGE_KEY, lang);
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ParentDataContext.Provider value={data}>{ui}</ParentDataContext.Provider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/parent/children');
  // jsdom has no matchMedia: the phone layout
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
});

test('Arabic by default: «أبنائي» rtl, Arabic-Indic digits', () => {
  page(<ChildrenRoute />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('أبنائي');
  expect(screen.getByText('مرتبط')).toBeInTheDocument();
  expect(screen.getByText('١٠ سنوات · رمز الربط ٤٧٢٩١٨')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
});

test('English: My children, ltr, Latin digits, the language button in the header', () => {
  page(<ChildrenRoute />, 'en');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My children');
  expect(screen.getByText('Linked')).toBeInTheDocument();
  expect(screen.getByText('10 years old · link code 472918')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add a child' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Language: English' })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(document.documentElement).toHaveAttribute('lang', 'en');
  expect(document.body.textContent).not.toMatch(/[؀-ۿ]/);
});

test('Indonesian: Anak-anak saya with the glossary words', () => {
  page(<ChildrenRoute />, 'id');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anak-anak saya');
  expect(screen.getByText('Tertaut')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Pencapaian' })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
});

test('settings: the language cards really switch the page', () => {
  page(<SettingsRoute />, 'en');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
  expect(screen.getByText('Delete account')).toBeInTheDocument();
  expect(screen.getByText('No subscription')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /Indonesia/ }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pengaturan');
  expect(screen.getByText('Hapus akun')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('lang', 'id');
  fireEvent.click(screen.getByRole('radio', { name: /العربية/ }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('الإعدادات');
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
});
