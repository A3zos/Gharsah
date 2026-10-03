import { act, fireEvent, render, screen } from '@testing-library/react';

import { LanguageMenu, LanguageSheetButton } from '../components/ui/LanguageSwitcher';
import ar from './ar.json';
import en from './en.json';
import { fill, STORAGE_KEY, useI18n } from './i18n';
import { LandingI18nProvider } from './LandingI18n';

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
    <LandingI18nProvider>
      {ui}
      <Probe />
    </LandingI18nProvider>,
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

test('ar.json and en.json have the same keys', () => {
  expect(keysOf(en)).toEqual(keysOf(ar));
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

test('Indonesian still shows «قريبًا» (in the page language) and keeps the language', () => {
  vi.useFakeTimers();
  landing();
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('option', { name: /Indonesia/ }));
  expect(screen.getByRole('status')).toHaveTextContent('قريبًا — نعمل على دعم هذه اللغة');
  expect(screen.getByTestId('probe')).toHaveAttribute('data-lang', 'ar');
  act(() => vi.advanceTimersByTime(3000));

  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('option', { name: /English/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
  fireEvent.click(screen.getByRole('option', { name: /Indonesia/ }));
  expect(screen.getByRole('status')).toHaveTextContent('Coming soon');
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
