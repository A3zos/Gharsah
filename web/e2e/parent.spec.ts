import { expect, test } from '@playwright/test';

import { getDoc, loginParent, seedParent } from './emu';

// Web Phase 3 — the parent area on the emulators: «أبنائي», add child →
// server-issued pairing code, new code, settings. Run with `npm run e2e:emu`.

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
  const doc = (await getDoc(`parents/${p.uid}/children/${childId}`)) as {
    fields: Record<string, { mapValue?: unknown; integerValue?: string }>;
  };
  expect(doc.fields.age!.integerValue).toBe('9');
  expect(JSON.stringify(doc.fields.schedule)).not.toContain('"mon"');

  await page.getByRole('button', { name: 'إصدار رمز جديد' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: 'إصدار رمز جديد' }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(codeLabel).not.toHaveAttribute('aria-label', first);
});

test('without a subscription the server refuses a code and the child is not kept', async ({ page }) => {
  const p = await seedParent({ subscribed: false });
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
    children: [
      {
        id: 'kid-a',
        name: 'عبدالله',
        extra: {
          linkedDeviceUid: 'dev-1',
          stats: { planPct: 35, surahs: 7, ayat: 49, hadith: 4, projects: 3 },
        },
      },
      { id: 'kid-b', name: 'مريم', gender: 'girl', avatar: 'g1' },
    ],
  });
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/children');
  await expect(page.getByRole('heading', { name: 'عبدالله' })).toBeVisible();
  await expect(page.getByText('مرتبط', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('بانتظار الربط').first()).toBeVisible();
  await page.goto('/parent/plans');
  await expect(page.getByText('اشترك من التطبيق').first()).toBeVisible();
  await expect(page.locator('input[autocomplete*="cc-"]')).toHaveCount(0);
});

test('settings: reminder switch updates every child', async ({ page }) => {
  const p = await seedParent({ children: [{ id: 'kid-a', name: 'عبدالله' }] });
  await loginParent(page, p.email, p.password);
  await page.goto('/parent/settings');
  const sw = page.getByRole('switch', { name: 'تذكير موعد الحصة' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  // The switch flips on the local write; poll until the server has it too.
  await expect
    .poll(async () => JSON.stringify(await getDoc(`parents/${p.uid}/children/kid-a`)))
    .toContain('"reminder":{"booleanValue":false}');
});
