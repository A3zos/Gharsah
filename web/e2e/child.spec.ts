import { expect, test } from '@playwright/test';

import { pairChild } from './local';

// Review notes B3 — no parental gate: «أنا وليّ الأمر» on the child profile opens
// the parent login (parent tab) in the same browser; the password is the gate.
test('«أنا وليّ الأمر» → parent login tab', async ({ page }) => {
  await pairChild(page);
  await page.getByRole('link', { name: 'ملفّي' }).click();
  await page.getByRole('link', { name: 'أنا وليّ الأمر' }).click();
  await expect(page).toHaveURL(/\/login\?tab=parent/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('أهلًا بعودتك');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.getByText('هذه المنطقة لوليّ الأمر')).toHaveCount(0);
});
