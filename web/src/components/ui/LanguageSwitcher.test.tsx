import { act, fireEvent, render, screen } from '@testing-library/react';

import { LanguageMenu, LanguageSettings, LanguageSheetButton } from './LanguageSwitcher';

afterEach(() => vi.useRealTimers());

test('header menu: three languages in their own names, Arabic checked; Esc closes', () => {
  render(<LanguageMenu />);
  const button = screen.getByRole('button', { name: 'اللغة: العربية' });
  fireEvent.click(button);
  const options = screen.getAllByRole('option');
  expect(options.map((o) => o.textContent)).toEqual(['العربيةAR', 'EnglishEN', 'Bahasa IndonesiaID']);
  expect(options[0]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('English')).toHaveAttribute('lang', 'en');
  expect(screen.getByText('Bahasa Indonesia')).toHaveAttribute('lang', 'id');
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(button).toHaveFocus();
});

test('choosing English: «قريبًا» toast, Arabic stays selected, nothing else changes', () => {
  vi.useFakeTimers();
  render(<LanguageMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.click(screen.getByRole('option', { name: /English/ }));
  expect(screen.getByRole('status')).toHaveTextContent('قريبًا — نعمل على دعم هذه اللغة');
  expect(document.documentElement.getAttribute('dir')).not.toBe('ltr');
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  expect(screen.getByRole('option', { name: /العربية/ })).toHaveAttribute('aria-selected', 'true');
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('keyboard: arrow down opens on the first option and moves', () => {
  render(<LanguageMenu />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'اللغة: العربية' }), { key: 'ArrowDown' });
  expect(screen.getAllByRole('option')[0]).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
  expect(screen.getAllByRole('option')[1]).toHaveFocus();
});

test('a click outside closes the menu', () => {
  render(<LanguageMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('settings: radio cards; Indonesian → toast, Arabic stays checked', () => {
  render(<LanguageSettings />);
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(3);
  fireEvent.click(radios[2]!);
  expect(screen.getByRole('status')).toHaveTextContent('قريبًا');
  expect(radios[0]).toBeChecked();
  expect(radios[2]).not.toBeChecked();
});

test('phone: the globe opens a sheet; Esc closes it', () => {
  render(<LanguageSheetButton />);
  fireEvent.click(screen.getByRole('button', { name: 'اللغة: العربية' }));
  expect(screen.getByRole('dialog', { name: 'اللغة' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
