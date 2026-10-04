// «شخصية الابن»: the UI language's 4 boys + 4 girls first; «شخصيات أخرى» shows the other sets.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ParentDataContext, type ParentData } from '../../components/parent/ParentData';
import { STORAGE_KEY } from '../../i18n/i18n';
import { I18nProvider } from '../../i18n/I18nProvider';
import AddChildRoute from './children-new';

function page(lang: 'ar' | 'en' | 'id') {
  localStorage.setItem(STORAGE_KEY, lang);
  const data: ParentData = {
    uid: 'p1',
    email: 'parent@example.com',
    profile: { name: 'Abu Sara', email: 'parent@example.com' },
    children: [],
    subscription: null,
    error: null,
  };
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <ParentDataContext.Provider value={data}>
            <AddChildRoute />
          </ParentDataContext.Provider>
        ),
      },
    ],
    { initialEntries: ['/parent/children/new'] },
  );
  return render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  );
}

const grid = (name: string) => screen.getByRole('radiogroup', { name });
const names = (g: HTMLElement) =>
  within(g)
    .getAllByRole('radio')
    .map((r) => r.getAttribute('aria-label'));

beforeEach(() => {
  localStorage.clear();
  // the wide layout shows every section, the avatar grid included
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
});

test('Arabic: the Arabic eight first, exactly as before; «شخصيات أخرى» adds the other 16', () => {
  page('ar');
  const g = grid('الشخصية');
  expect(within(g).getAllByRole('radio')).toHaveLength(8);
  expect(names(g)[0]).toBe('فتى بغترة بيضاء');
  expect(within(g).getByRole('radio', { checked: true })).toHaveAccessibleName(names(g)[4]!);
  fireEvent.click(screen.getByRole('button', { name: 'شخصيات أخرى' }));
  expect(within(g).getAllByRole('radio')).toHaveLength(24);
  expect(names(g)[8]).toBe('فتى بشعر أشقر وسترة كحلية');
  expect(screen.getByRole('button', { name: 'إخفاء الشخصيات الأخرى' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('English: the English set first; picking an Indonesian avatar from More characters', () => {
  page('en');
  const g = grid('Avatar');
  expect(names(g).slice(0, 2)).toEqual([
    'Boy with blond hair in a navy hoodie',
    'Red-haired boy in a white kufi',
  ]);
  expect(within(g).getByRole('radio', { checked: true })).toHaveAccessibleName('Girl in a coral hijab');
  fireEvent.click(screen.getByRole('button', { name: 'More characters' }));
  fireEvent.click(within(g).getByRole('radio', { name: 'Girl in a navy hijab and a batik dress' }));
  expect(within(g).getByRole('radio', { checked: true })).toHaveAccessibleName(
    'Girl in a navy hijab and a batik dress',
  );
});

test('no per-child voice consent box (disclosed at sign-up instead)', () => {
  page('en');
  expect(screen.queryByRole('checkbox')).toBeNull();
});

test('Indonesian: the Indonesian set first, its first girl selected', () => {
  page('id');
  const g = grid('Karakter');
  expect(within(g).getAllByRole('radio')).toHaveLength(8);
  expect(names(g)[0]).toBe('Anak laki-laki berpeci hitam');
  expect(within(g).getByRole('radio', { checked: true })).toHaveAccessibleName(
    'Anak perempuan berhijab biru muda',
  );
  expect(screen.getByRole('button', { name: 'Karakter lainnya' })).toHaveAttribute('aria-expanded', 'false');
});
