import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

import { STORAGE_KEY } from '../../i18n/i18n';
import LoginRoute from './login';

vi.mock('../../data/auth', () => ({
  isValidEmail: (e: string) => /@/.test(e),
  signIn: vi.fn(),
}));

// the component only reads loaderData.childDevice
const props = { loaderData: { childDevice: false } } as unknown as Parameters<typeof LoginRoute>[0];

function renderLogin(tab: 'parent' | 'child') {
  const Stub = createRoutesStub([{ path: '/login', Component: () => <LoginRoute {...props} /> }]);
  return render(<Stub initialEntries={[`/login?tab=${tab}`]} />);
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});

test('Arabic by default: the parent tab as before, <html dir=rtl>', async () => {
  renderLogin('parent');
  expect(await screen.findByRole('heading', { name: 'أهلًا بعودتك' })).toBeInTheDocument();
  expect(screen.getByLabelText('البريد الإلكتروني')).toHaveAttribute('dir', 'ltr');
  expect(screen.getByRole('button', { name: 'إظهار كلمة المرور' })).toBeInTheDocument();
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['ولي الأمر', 'الطفل']);
  expect(document.documentElement).toHaveAttribute('dir', 'rtl');
});

test('English (stored choice): parent tab copy, validation, ltr', async () => {
  localStorage.setItem(STORAGE_KEY, 'en');
  renderLogin('parent');
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(screen.getByText("Sign in to follow your children's progress.")).toBeInTheDocument();
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Parent', 'Child']);
  expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('dir', 'ltr');

  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText("That email address doesn't look right.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Enter your password.')).toBeInTheDocument();
});

test('English: child tab copy; the code boxes stay left-to-right', async () => {
  localStorage.setItem(STORAGE_KEY, 'en');
  renderLogin('child');
  expect(await screen.findByRole('heading', { name: 'Hi there, champ!' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ask your parent for a new one' })).toBeInTheDocument();
  expect(screen.getByLabelText('Box 1 of Link code').parentElement?.className).toContain('[direction:ltr]');
  fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
  expect(screen.getByText('Fill in all six boxes.')).toBeInTheDocument();
});
