// Review notes A1: the landing header offers «تسجيل الدخول» (outlined) and
// «إنشاء حساب» (filled) side by side, each to its own route.
import { expect, test } from '@playwright/test';

test('landing header: «تسجيل الدخول» → /login and «إنشاء حساب» → /signup', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('header:visible').first();
  const login = header.getByRole('link', { name: 'تسجيل الدخول', exact: true });
  const signup = header.getByRole('link', { name: 'إنشاء حساب', exact: true });
  await expect(login).toBeVisible();
  await expect(signup).toBeVisible();

  await signup.click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  await header.getByRole('link', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page).toHaveURL(/\/login(\?tab=parent)?$/);
});
