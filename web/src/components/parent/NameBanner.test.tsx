import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { ParentDataContext, type ParentData } from './ParentData';
import { isPlaceholderName, NameBanner } from './NameBanner';

const data = (name: string): ParentData => ({
  uid: 'p1',
  email: 'abu.omar@example.com',
  profile: { name, email: 'abu.omar@example.com' },
  children: [],
  subscription: null,
  error: null,
});
const show = (name: string) =>
  render(
    <MemoryRouter>
      <ParentDataContext.Provider value={data(name)}>
        <NameBanner />
      </ParentDataContext.Provider>
    </MemoryRouter>,
  );

afterEach(() => localStorage.clear());

test('the fallback names are not a name (same rule as parent_first_name in SQL)', () => {
  expect(isPlaceholderName('abu.omar', 'abu.omar@example.com')).toBe(true);
  expect(isPlaceholderName('ولي الأمر', 'x@y.z')).toBe(true);
  expect(isPlaceholderName('  ', 'x@y.z')).toBe(true);
  expect(isPlaceholderName('عبدالعزيز محمد', 'x@y.z')).toBe(false);
});

test('a fallback name → the banner, linking to settings; closed once → gone', () => {
  show('abu.omar');
  expect(screen.getByText(/أكمل اسمك ليظهر مع اسم طفلك في لوحة المتصدرين/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'الإعدادات' })).toHaveAttribute('href', '/parent/settings');
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('status')).toBeNull();
});

test('a real name → no banner', () => {
  show('عبدالعزيز');
  expect(screen.queryByRole('status')).toBeNull();
});
