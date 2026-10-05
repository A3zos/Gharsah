// The welcome choice, signup, forgot-password and legal pages in Arabic (unchanged),
// English and Indonesian.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createRoutesStub } from 'react-router';

import { ClaimFailure, claimCode } from '../../data/childSession';
import { STORAGE_KEY } from '../../i18n/i18n';
import LegalRoute from '../legal';
import ForgotPasswordRoute from './forgot-password';
import LoginRoute from './login';
import SignupRoute from './signup';

vi.mock('../../data/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  signIn: vi.fn(),
  signUp: vi.fn(),
  sendPasswordReset: vi.fn(),
}));
vi.mock('../../data/childSession', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  claimCode: vi.fn(),
}));

const props = { loaderData: { childDevice: false } } as unknown as Parameters<typeof LoginRoute>[0];

function renderAt(url: string, lang?: 'en' | 'id') {
  if (lang) localStorage.setItem(STORAGE_KEY, lang);
  const Stub = createRoutesStub([
    { path: '/login', Component: () => <LoginRoute {...props} /> },
    { path: '/signup', Component: SignupRoute },
    { path: '/forgot-password', Component: ForgotPasswordRoute },
    { path: '/legal', Component: LegalRoute },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});

describe('welcome (/login, no tab)', () => {
  test('Arabic unchanged, with the language button', async () => {
    renderAt('/login');
    expect(await screen.findByRole('link', { name: 'تسجيل دخول' })).toBeInTheDocument();
    expect(screen.getByText('حساب وليّ الأمر — تتابع منه رحلة أبنائك مع القرآن.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'شروط الاستخدام' })).toBeInTheDocument();
    expect(screen.getByLabelText('بذرة ثم غَرْسة ثم شجرة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اللغة: العربية' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  test('English: copy, ltr, title', async () => {
    renderAt('/login', 'en');
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Sapling')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.title).toBe('Sign in — Gharsah');
  });

  test('Indonesian: copy, ltr', async () => {
    renderAt('/login', 'id');
    expect(await screen.findByRole('link', { name: 'Masuk' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kebijakan Privasi' })).toBeInTheDocument();
    expect(screen.getByText('Benih')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'id');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  test('the language button switches the page', async () => {
    renderAt('/login');
    fireEvent.click(await screen.findByRole('button', { name: 'اللغة: العربية' }));
    fireEvent.click(screen.getByRole('radio', { name: /Indonesia/ }));
    expect(screen.getByRole('link', { name: 'Buat akun' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});

describe('signup', () => {
  test('the voice disclosure under the sign-up button (ar / en)', async () => {
    renderAt('/signup');
    expect(
      await screen.findByText(/باستخدامك غَرْسة توافق على أن يستمع المعلم الذكي لصوت طفلك أثناء الحصة/),
    ).toBeInTheDocument();
    cleanup();
    renderAt('/signup', 'en');
    expect(
      await screen.findByText(/By using Gharsah you agree that the AI teacher listens/),
    ).toBeInTheDocument();
  });

  test('Arabic unchanged: copy and validation', async () => {
    renderAt('/signup');
    expect(await screen.findByRole('heading', { name: 'إنشاء حساب وليّ الأمر' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رجوع' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء الحساب' }));
    expect(screen.getByText('اكتب اسمك.')).toBeInTheDocument();
    expect(screen.getByText('كلمة المرور ٨ أحرف على الأقل.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'abc' } });
    expect(screen.getByLabelText('قوة كلمة المرور: قصيرة')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  test('English: copy, validation, strength, ltr', async () => {
    renderAt('/signup', 'en');
    expect(await screen.findByRole('heading', { name: 'Create a parent account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText("The passwords don't match — please check again.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abcdefgh1!' } });
    expect(screen.getByLabelText('Password strength: Strong')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.title).toBe('Create account — Gharsah');
  });

  test('Indonesian: copy and validation', async () => {
    renderAt('/signup', 'id');
    expect(await screen.findByRole('heading', { name: 'Buat akun orang tua' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Buat akun' }));
    expect(screen.getByText('Tulis nama Anda.')).toBeInTheDocument();
    expect(screen.getByText('Kata sandi minimal 8 karakter.')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});

describe('signup: the country (required — its flag shows on the leaderboard)', () => {
  test('Arabic: «اختر دولتك.» until a pill is picked; one pill at a time', async () => {
    renderAt('/signup');
    const group = await screen.findByRole('radiogroup', { name: 'الدولة' });
    const pills = within(group).getAllByRole('radio');
    expect(pills.map((p) => p.textContent)).toEqual(['السعودية', 'الولايات المتحدة', 'إندونيسيا']);
    expect(pills.every((p) => p.getAttribute('aria-checked') === 'false')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء الحساب' }));
    expect(screen.getByText('اختر دولتك.')).toBeInTheDocument();
    fireEvent.click(pills[2]!);
    expect(pills[2]).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('اختر دولتك.')).toBeNull();
    fireEvent.click(pills[0]!);
    expect(pills[0]).toHaveAttribute('aria-checked', 'true');
    expect(pills[2]).toHaveAttribute('aria-checked', 'false');
  });

  test('English / Indonesian labels', async () => {
    renderAt('/signup', 'en');
    const en = await screen.findByRole('radiogroup', { name: 'Country' });
    expect(
      within(en)
        .getAllByRole('radio')
        .map((p) => p.textContent),
    ).toEqual(['Saudi Arabia', 'United States', 'Indonesia']);
    cleanup();
    renderAt('/signup', 'id');
    const id = await screen.findByRole('radiogroup', { name: 'Negara' });
    expect(
      within(id)
        .getAllByRole('radio')
        .map((p) => p.textContent),
    ).toEqual(['Arab Saudi', 'Amerika Serikat', 'Indonesia']);
    fireEvent.click(screen.getByRole('button', { name: 'Buat akun' }));
    expect(screen.getByText('Pilih negara Anda.')).toBeInTheDocument();
  });
});

describe('forgot password', () => {
  test('Arabic unchanged', async () => {
    renderAt('/forgot-password');
    expect(await screen.findByRole('heading', { name: 'نسيت كلمة المرور؟' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'أرسل الرابط' }));
    expect(screen.getByText('صيغة البريد الإلكتروني غير صحيحة.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'العودة لتسجيل الدخول' })).toBeInTheDocument();
  });

  test('English: form, then the sent screen', async () => {
    renderAt('/forgot-password', 'en');
    expect(await screen.findByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(screen.getByText("That email address doesn't look right.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(await screen.findByText('We sent a link to your email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send again' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  test('Indonesian', async () => {
    renderAt('/forgot-password', 'id');
    expect(await screen.findByRole('heading', { name: 'Lupa kata sandi?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim tautan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke halaman masuk' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});

describe('legal', () => {
  test('Arabic unchanged (Arabic-Indic numbers)', async () => {
    renderAt('/legal?doc=privacy');
    expect(await screen.findByRole('heading', { level: 1, name: 'سياسة الخصوصية' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^٢\s*التسجيلات الصوتية$/ })).toBeInTheDocument();
    // the voice disclosure, in force on both legal pages
    expect(screen.getByText(/يستمع المعلم الذكي لصوت طفلك/)).toBeInTheDocument();
  });

  test('the voice disclosure on the terms too', async () => {
    renderAt('/legal?doc=terms', 'id');
    expect(await screen.findByText(/guru AI mendengarkan suara anak Anda/)).toBeInTheDocument();
  });

  test('English and Indonesian (Latin numbers)', async () => {
    const { unmount } = renderAt('/legal?doc=terms', 'en');
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms & conditions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^1\s*Scope of the service$/ })).toBeInTheDocument();
    unmount();
    renderAt('/legal?doc=privacy', 'id');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kebijakan privasi' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});

test('child tab «What can I do?» → the code-expired help, translated', async () => {
  vi.mocked(claimCode).mockRejectedValueOnce(new ClaimFailure('wrong'));
  renderAt('/login?tab=child', 'id');
  const first = await screen.findByLabelText('Kotak 1 dari Kode tautan');
  fireEvent.paste(first, { clipboardData: { getData: () => '123456' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Lalu bagaimana?' }));
  expect(screen.getByRole('heading', { name: 'Masuk sebagai anak' })).toBeInTheDocument();
  expect(screen.getByText('Kode ini sudah kedaluwarsa')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Masukkan kode lain' })).toBeInTheDocument();
});
