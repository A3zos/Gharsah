import { fireEvent, render, screen } from '@testing-library/react';

import { LanguageMenu, LanguageSheetButton } from '../components/ui/LanguageSwitcher';
import ar from './ar.json';
import en from './en.json';
import { countPhrase, fill, STORAGE_KEY, useI18n, withFallback } from './i18n';
import { I18nProvider } from './I18nProvider';

function Probe() {
  const { lang, m } = useI18n();
  return (
    <p data-testid="probe" data-lang={lang}>
      {m.hero.title1}
    </p>
  );
}

const landing = (ui: React.ReactNode = <LanguageMenu />) =>
  render(
    <I18nProvider>
      {ui}
      <Probe />
    </I18nProvider>,
  );

const keysOf = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' ? keysOf(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});

// Every locale file (the core + one per area) has exactly Arabic's keys.
const files = import.meta.glob<{ default: object }>(['./*.json', './*/*.json'], { eager: true });
const AREA_FILES = Object.keys(files).filter((f) => f.startsWith('./ar'));

test.each(AREA_FILES)('%s: en and id have exactly the same keys', (arFile) => {
  const base = keysOf(files[arFile]!.default);
  for (const lang of ['en', 'id']) {
    const file = arFile.replace(/^\.\/ar/, `./${lang}`);
    expect(files[file], `${file} exists`).toBeDefined();
    expect(keysOf(files[file]!.default), file).toEqual(base);
  }
});

test('a key missing in en / id falls back to the Arabic text', () => {
  const out = withFallback({ a: 'عربي', b: { c: 'ج' } }, { a: 'English' }, 'en');
  expect(out).toEqual({ a: 'English', b: { c: 'ج' } });
});

test('countPhrase: Arabic keeps its rules; English / Indonesian by Intl plural rules', () => {
  const ar4 = { one: 'يوم واحد', two: 'يومان', few: '{n} أيام', many: '{n} يومًا' };
  expect([1, 2, 3, 10, 11, 0].map((n) => countPhrase('ar', n, ar4))).toEqual([
    'يوم واحد',
    'يومان',
    '٣ أيام',
    '١٠ أيام',
    '١١ يومًا',
    '٠ أيام',
  ]);
  const en4 = { one: '{n} day', two: '{n} days', few: '{n} days', many: '{n} days' };
  expect([1, 2, 5].map((n) => countPhrase('en', n, en4))).toEqual(['1 day', '2 days', '5 days']);
  const id4 = { one: '{n} hari', two: '{n} hari', few: '{n} hari', many: '{n} hari' };
  expect(countPhrase('id', 3, id4)).toBe('3 hari');
});

test('fill: the age range in each language’s digits', () => {
  expect(fill('ar', ar.hero.ages, { min: 8, max: 13 })).toBe('للأطفال من ٨ إلى ١٣ سنة');
  expect(fill('en', en.hero.ages, { min: 8, max: 13 })).toBe('For children aged 8–13');
});

test('the landing switches to English: text, <html lang dir>, stored choice; and back', () => {
  landing();
  expect(screen.getByTestId('probe')).toHaveTextContent('اغرس في طفلك دينه');
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('option', { name: /English/ }));
  expect(screen.getByTestId('probe')).toHaveTextContent('Plant faith in your child');
  expect(document.documentElement).toHaveAttribute('lang', 'en');
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
  expect(screen.queryByRole('status')).toBeEmptyDOMElement();

  fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
  expect(screen.getByRole('option', { name: /English/ })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('option', { name: /العربية/ }));
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('ar');
});

test('Indonesian is a real choice now: ltr, stored', () => {
  landing();
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('option', { name: /Indonesia/ }));
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'id');
  expect(document.documentElement).toHaveAttribute('lang', 'id');
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('id');
  expect(screen.queryByRole('status')).toBeEmptyDOMElement();
});

test('?lang=en is remembered for the next page (the login from «Log in»)', () => {
  window.history.replaceState(null, '', '/?lang=en');
  const { unmount } = landing();
  expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
  unmount();
  window.history.replaceState(null, '', '/login?tab=parent');
  landing();
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'en');
});

test('?lang=en opens in English and wins over the stored choice', () => {
  localStorage.setItem(STORAGE_KEY, 'ar');
  window.history.replaceState(null, '', '/?lang=en');
  landing();
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'en');
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');
});

test('a stored choice is remembered; leaving the landing puts Arabic back on <html>', () => {
  localStorage.setItem(STORAGE_KEY, 'en');
  const { unmount } = landing();
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'en');
  unmount();
  expect(document.documentElement).toHaveAttribute('lang', 'ar');
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
});

test('blocked storage: still switches, defaults to Arabic', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  landing();
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'ar');
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('option', { name: /English/ }));
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'en');
  get.mockRestore();
  set.mockRestore();
});

test('phone sheet: picking English switches and closes the sheet', () => {
  landing(<LanguageSheetButton />);
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('radio', { name: /English/ }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'en');
  expect(screen.getByRole('button', { name: 'Language: English' })).toBeInTheDocument();
});
