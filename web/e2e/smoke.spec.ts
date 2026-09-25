import { expect, test } from '@playwright/test';

test('landing is prerendered RTL Arabic with the design tokens', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle(/غَرْسة/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(251, 246, 236)'); // cream #FBF6EC
});

test('guards: parent and child areas redirect when signed out', async ({ page }) => {
  // The first guarded page loads the Firebase chunk before it can redirect.
  await page.goto('/parent/dashboard');
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await page.goto('/child/home');
  await expect(page).toHaveURL(/\/login\?tab=child$/, { timeout: 15_000 });
});

test('recitation audio is served from the build (no third-party fetch)', async ({ request }) => {
  const res = await request.get('/audio/quran/112001.mp3');
  expect(res.ok()).toBe(true);
  expect((await res.body()).byteLength).toBeGreaterThan(2048);
});
