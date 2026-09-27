import { expect, test, type Page } from '@playwright/test';

// Web Phase 2: landing, auth and legal pages render and link together (no Firebase writes).

test('landing shows the layout for this width and the verified ayah', async ({ page }, info) => {
  await page.goto('/');
  const desktop = info.project.name === 'desktop-1280';
  await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toContainText(
    'نغرس حُبّ القرآن',
  );
  // The mock lesson's ayah comes from the Tanzil asset and uses Amiri Quran.
  const ayah = page.locator('p.font-ayah').filter({ visible: true }).first();
  await expect(ayah).toBeVisible();
  expect(await ayah.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Amiri Quran');
  if (!desktop) {
    await page.getByRole('button', { name: 'فتح القائمة' }).click();
    await expect(page.getByRole('link', { name: 'الباقات' }).filter({ visible: true })).toBeVisible();
  }
  // No horizontal scroll at any width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('welcome → login tabs → child code validation', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'تسجيل دخول' })).toBeVisible();
  await page.getByRole('link', { name: 'تسجيل دخول' }).click();
  await expect(page).toHaveURL(/tab=parent/);
  await page.getByRole('tab', { name: 'الطفل' }).click();
  await expect(page).toHaveURL(/tab=child/);
  // Latin digits are shown as Arabic-Indic and auto-advance.
  await page.getByLabel('الخانة الأولى من رمز الربط').pressSequentially('12');
  await expect(page.getByLabel('الخانة الأولى من رمز الربط')).toHaveValue('١');
  await expect(page.getByLabel('الخانة الثانية من رمز الربط')).toHaveValue('٢');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByText('أكمل الخانات الستّ.')).toBeVisible();
  await page.getByRole('button', { name: 'اطلب رمزًا جديدًا من والدك' }).click();
  await expect(page.getByText('الرمز انتهت مدّته')).toBeVisible();
});

test('signup validates locally before any request', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page.getByText('اكتب اسمك.')).toBeVisible();
  await expect(page.getByText('صيغة البريد الإلكتروني غير صحيحة.')).toBeVisible();
});

test('legal page switches documents', async ({ page }) => {
  await page.goto('/legal?doc=privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('سياسة الخصوصية');
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('الشروط والأحكام');
});

// ── Review notes A2: child login messages (network stubbed — nothing reaches Firebase) ──

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const FAKE_ID_TOKEN = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
  iss: 'https://securetoken.google.com/nibras-59284',
  aud: 'nibras-59284',
  sub: 'anon-e2e',
  user_id: 'anon-e2e',
  iat: now,
  exp: now + 3600,
  auth_time: now,
  firebase: { sign_in_provider: 'anonymous', identities: {} },
})}.sig`;

async function stubAnonymousSignIn(page: Page, disabled = false) {
  await page.route('**/identitytoolkit.googleapis.com/**/accounts:signUp**', (r) =>
    disabled
      ? r.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 400, message: 'ADMIN_ONLY_OPERATION', errors: [] } }),
        })
      : r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            idToken: FAKE_ID_TOKEN,
            refreshToken: 'r',
            expiresIn: '3600',
            localId: 'anon-e2e',
          }),
        }),
  );
  await page.route('**/identitytoolkit.googleapis.com/**/accounts:lookup**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        users: [{ localId: 'anon-e2e', lastLoginAt: String(Date.now()), createdAt: String(Date.now()) }],
      }),
    }),
  );
}

const CALLABLE = '**/claimPairingCode';
const enterCode = (page: Page) =>
  page.getByLabel('الخانة الأولى من رمز الربط').pressSequentially('123456');

test('child login: page fits, one back control, «أهلًا يا بطل!», «رمز الربط»', async ({ page }) => {
  await page.goto('/login?role=child');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أهلًا يا بطل!');
  await expect(page.getByText('أدخل رمز الربط الذي أعطاك إياه والدك.')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'الرئيسية', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'رجوع' })).toHaveCount(0);
  await expect(page.getByText('رمز الدعوة')).toHaveCount(0);
  const dukhul = page.getByRole('button', { name: 'دخول', exact: true });
  await expect(dukhul).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await page.getByRole('tab', { name: 'ولي الأمر' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أهلًا بعودتك');
});

test('child login: wrong or expired code → the specific message', async ({ page }) => {
  await stubAnonymousSignIn(page);
  await page.route(CALLABLE, (r) =>
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { status: 'NOT_FOUND', message: 'wrong-code' } }),
    }),
  );
  await page.goto('/login?role=child');
  await enterCode(page);
  await expect(page.getByText('الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا من والدك.')).toBeVisible();
});

test('child login: callable not reachable (not deployed) → «الخدمة غير متاحة الآن…»', async ({ page }) => {
  await stubAnonymousSignIn(page);
  await page.route(CALLABLE, (r) =>
    r.fulfill({ status: 404, contentType: 'text/html', body: '<h1>Not Found</h1>' }),
  );
  await page.goto('/login?role=child');
  await enterCode(page);
  await expect(page.getByText('الخدمة غير متاحة الآن، حاول بعد قليل.')).toBeVisible();
});

test('child login: anonymous sign-in disabled → «الخدمة غير متاحة الآن…»', async ({ page }) => {
  await stubAnonymousSignIn(page, true);
  await page.goto('/login?role=child');
  await enterCode(page);
  await expect(page.getByText('الخدمة غير متاحة الآن، حاول بعد قليل.')).toBeVisible();
});

test('child login: offline → «تحقق من اتصالك بالإنترنت.»', async ({ page, context }) => {
  await page.goto('/login?role=child');
  await expect(page.getByLabel('الخانة الأولى من رمز الربط')).toBeEditable();
  await context.setOffline(true);
  await enterCode(page);
  await expect(page.getByText('تحقق من اتصالك بالإنترنت.')).toBeVisible();
  await context.setOffline(false);
});
