import { expect, test } from '@playwright/test';

import { admin, getRow, loginParent, seedParent, TEST_EMAIL_DOMAIN } from './stack';

// The parent area on the LOCAL Supabase stack: «أبنائي», add child → server-issued
// pairing code, new code, settings. Run with `npm run e2e:local`.

test('add a child → the server issues a pairing code → new code revokes it', async ({ page }) => {
  const p = await seedParent();
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/children/new');
  await page.locator('#child-name').fill('سارة');
  await page.getByRole('radio', { name: '٩ سنوات' }).click();
  await page.getByRole('button', { name: /^التالي/ }).click();
  // Schedule: drop Monday, move the time a quarter hour later.
  await page.getByRole('button', { name: 'الاثنين', exact: true }).click();
  await page.getByRole('button', { name: 'تأخير الوقت ربع ساعة' }).click();
  await expect(page.getByText('٥:١٥ مساءً')).toBeVisible();
  await page.getByRole('button', { name: /^التالي/ }).click();
  await page.getByRole('radio', { name: 'فتاة بحجاب أخضر' }).click();
  await page.getByRole('button', { name: /حفظ وإنشاء رمز الربط|التالي/ }).click();

  await expect(page.getByRole('heading', { name: 'تمت إضافة سارة' })).toBeVisible();
  const codeLabel = page.getByLabel(/^رمز الربط [٠-٩]{6}$/);
  await expect(codeLabel).toBeVisible();
  const first = (await codeLabel.getAttribute('aria-label'))!;

  const childId = page.url().match(/children\/([^/]+)\/code/)![1]!;
  const row = (await getRow('children', { id: childId }))!;
  expect(row.age).toBe(9);
  expect(row.schedule_days).not.toContain(2); // الاثنين = 2 (0 = السبت)

  await page.getByRole('button', { name: 'إصدار رمز جديد' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'إصدار رمز جديد' }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(codeLabel).not.toHaveAttribute('aria-label', first);
});

test('without a subscription the server refuses a code and the child is not kept', async ({ page }) => {
  const p = await seedParent({ plan: null });
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/children/new');
  await page.locator('#child-name').fill('يوسف');
  await page.getByRole('button', { name: /^التالي/ }).click();
  await page.getByRole('button', { name: /^التالي/ }).click();
  await page.getByRole('button', { name: /حفظ وإنشاء رمز الربط|التالي/ }).click();
  await expect(page.getByText('فعّل اشتراكك أولًا لإصدار رمز الربط.')).toBeVisible();
  await page.goto('/parent/children');
  await expect(page.getByText('يوسف')).toHaveCount(0);
});

test('«أبنائي» lists children with their state; plans never sell on the web', async ({ page }) => {
  const p = await seedParent({
    children: [{ name: 'عبدالله' }, { name: 'مريم', gender: 'girl', avatar: 'g1' }],
  });
  // عبدالله is paired: a device session written the way claim-pairing-code does it.
  const device = await admin().auth.admin.createUser({
    email: `d${Date.now()}${TEST_EMAIL_DOMAIN}`,
    password: 'x-pass-123456',
  });
  await admin()
    .from('child_sessions')
    .insert({ device_uid: device.data.user!.id, parent_id: p.uid, child_id: p.childIds[0] });
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/children');
  await expect(page.getByRole('heading', { name: 'عبدالله' })).toBeVisible();
  await expect(page.getByText('مرتبط', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('بانتظار الربط').first()).toBeVisible();
  await page.goto('/parent/plans');
  await expect(page.getByText('الشراء عبر Google Play غير متاح في المتصفح')).toHaveCount(0);
  await expect(page.locator('input[autocomplete*="cc-"]')).toHaveCount(0);
});

// Review notes B6 + B4 + the pilot (2026-10-02): «ابدأ التجربة» writes the trial plan → dashboard.
test('pilot package subscribe → dashboard with «الباقة التجريبية» in the sidebar', async ({ page }) => {
  const p = await seedParent({ plan: null });
  await page.setViewportSize({ width: 1366, height: 768 });
  await loginParent(page, p.email, p.password);
  const sidebar = page.getByRole('complementary');
  await expect(sidebar.getByRole('link', { name: 'اشترك الآن' })).toBeVisible();
  await page.goto('/parent/plans');
  await expect(page.getByRole('heading', { name: 'الباقة التجريبية' })).toBeVisible();
  await expect(page.getByText('حصة واحدة كل يوم').first()).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ التجربة' }).click();
  await expect(page.getByText('تم تفعيل الباقة').first()).toBeVisible();
  await page.waitForURL(/\/parent\/dashboard/);
  await expect(sidebar.getByText('الباقة التجريبية')).toBeVisible();
  expect((await getRow('subscriptions', { parent_id: p.uid }))?.plan).toBe('trial');
});

// Review notes B5: 1–3 review days, each a lesson day.
test('schedule: review days — non-lesson days disabled, a 4th is refused, the summary updates', async ({
  page,
}) => {
  const p = await seedParent();
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/children/new');
  await page.locator('#child-name').fill('سارة');
  await page.getByRole('button', { name: /^التالي/ }).click();
  const picker = page.getByRole('group', { name: 'أيام المراجعة الأسبوعية' });
  await expect(page.getByText('٣ أيام كحد أقصى')).toBeVisible();
  // Default lesson days: السبت، الأحد، الاثنين، الأربعاء، الخميس → الثلاثاء / الجمعة disabled.
  await expect(picker.getByRole('button', { name: /الثلاثاء — ليس يوم حصة/ })).toBeDisabled();
  await picker.getByRole('button', { name: 'المراجعة يوم السبت' }).click();
  await picker.getByRole('button', { name: 'المراجعة يوم الأحد' }).click();
  await expect(page.getByText('مراجعة · السبت، الأحد، الخميس')).toBeVisible();
  await picker.getByRole('button', { name: 'المراجعة يوم الاثنين' }).click();
  await expect(page.getByText('تقدر تختار ٣ أيام مراجعة كحد أقصى')).toBeVisible();
  await expect(picker.getByRole('button', { name: 'المراجعة يوم الاثنين' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('settings: reminder switch updates every child', async ({ page }) => {
  const p = await seedParent({ children: [{ name: 'عبدالله' }] });
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/settings');
  const sw = page.getByRole('switch', { name: 'تذكير موعد الحصة' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  // The switch flips on the local write; poll until the server has it too.
  await expect.poll(async () => (await getRow('children', { id: p.childIds[0]! }))?.reminder).toBe(false);
});
