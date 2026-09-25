import { expect, test } from '@playwright/test';

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
  await page.getByLabel('الخانة الأولى من رمز الدعوة').pressSequentially('12');
  await expect(page.getByLabel('الخانة الأولى من رمز الدعوة')).toHaveValue('١');
  await expect(page.getByLabel('الخانة الثانية من رمز الدعوة')).toHaveValue('٢');
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
