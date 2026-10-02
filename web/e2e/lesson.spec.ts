// The live lesson (design/v3 L1Intro → L10Done + ExitConfirm) against the local
// emulators. Dev builds let a tap on the teacher count a repeat (the design
// prototype's tap), so the flow runs without a real voice; the fake mic device
// only proves the mic opens. Nothing here grades recitation.
import { expect, test, type Page } from '@playwright/test';

import { getRow, pairChild } from './stack';

const teacher = (p: Page) => p.getByRole('button', { name: 'تابع مع المعلّم' });

/** Taps the teacher until `done` holds (skips lines / counts dev repeats / answers «نعم»). */
async function tapUntil(page: Page, done: () => Promise<boolean>, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await done()) return;
    await teacher(page).click();
    await page.waitForTimeout(250);
  }
  throw new Error('flow did not advance');
}

async function repeatAyah(page: Page) {
  // Reciting → tap stops the reciter → «الآن ردّد» (mic closed, gold prompt).
  await tapUntil(page, () => page.getByRole('button', { name: 'افتح الميكروفون وابدأ الترديد' }).isEnabled());
  await page.getByRole('button', { name: 'افتح الميكروفون وابدأ الترديد' }).click();
  await expect(page.getByRole('button', { name: 'كتم الميكروفون' })).toBeVisible();
  await expect(page.getByText('الميكروفون مفتوح — لا تضغط شيئًا')).toBeVisible();
}

test('child code → home → full lesson L1→L10 → back home', async ({ page }) => {
  test.setTimeout(240_000);
  const { childId } = await pairChild(page);
  await page.getByRole('link', { name: /ابدأ الحصة/ }).click({ force: true }); // the CTA breathes (never "stable")
  await page.waitForURL(/\/child\/lesson\//);

  // L1: live header, plan (no مكية/مدنية), then «جاهز نبدأ نحفظ؟» by mic.
  await expect(page.getByText('مباشر')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'خطة اليوم' })).toBeVisible();
  await expect(page.getByText('سورة الإخلاص').first()).toBeVisible();
  await expect(page.getByText('مكّية')).toHaveCount(0);
  await tapUntil(page, () => page.getByRole('button', { name: 'افتح الميكروفون وأجب بصوتك' }).isEnabled());
  await page.getByRole('button', { name: 'افتح الميكروفون وأجب بصوتك' }).click();
  await page.getByRole('button', { name: 'قلت نعم' }).click();

  // The 4 ayat of Al-Ikhlas — verified Tanzil text, repeated 3× each.
  for (let a = 1; a <= 4; a++) {
    await expect(page.getByText(new RegExp(`سورة الإخلاص · الآية ${'١٢٣٤'[a - 1]}`))).toBeVisible();
    await repeatAyah(page);
    await tapUntil(
      page,
      async () =>
        (await page
          .getByText(new RegExp(`الآية ${'١٢٣٤'[a]}`))
          .isVisible()
          .catch(() => false)) ||
        (await page.getByRole('button', { name: 'تابع بعد إتمام السورة' }).isVisible()),
    );
  }
  await page.getByRole('button', { name: 'تابع بعد إتمام السورة' }).click();

  // L6: surah done → «جاهز ننتقل للحديث؟» → yes.
  await expect(page.getByRole('heading', { name: 'أتممت سورة الإخلاص!' })).toBeVisible();
  await tapUntil(page, () => page.getByRole('button', { name: 'افتح الميكروفون وأجب بصوتك' }).isEnabled());
  await page.getByRole('button', { name: 'افتح الميكروفون وأجب بصوتك' }).click();
  await tapUntil(page, () => page.getByText('حديث شريف').isVisible());

  // L7: hadith = the marked placeholder (never real text until approved).
  await expect(page.getByText(/يُعتمد لاحقًا/).first()).toBeVisible();
  await repeatAyah(page);
  // Pilot day 1 is surah + hadith only (no home project) → straight to the end.
  await tapUntil(page, () => page.getByRole('heading', { name: 'أكملت حصة اليوم!' }).isVisible());

  // L10: done → home.
  await expect(page.getByText('أكملت درس اليوم', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'عودة للرئيسية' }).click();
  await page.waitForURL(/\/child\/home/);
  await expect
    .poll(async () => (await getRow('progress', { child_id: childId, lesson_id: 'pilot-day-1' }))?.stage)
    .toBe('done');
});

test('ExitConfirm: ✕ and browser back ask first; «أكمل الحصة» stays, «خروج» saves and resumes later', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await pairChild(page);
  await page.getByRole('link', { name: /ابدأ الحصة/ }).click({ force: true }); // the CTA breathes (never "stable")
  await page.waitForURL(/\/child\/lesson\//);
  await expect(page.getByRole('heading', { name: 'خطة اليوم' })).toBeVisible();

  // ✕ → sheet → «أكمل الحصة» keeps the call.
  await page.getByRole('button', { name: 'إنهاء المكالمة' }).click();
  await expect(page.getByRole('alertdialog', { name: 'تخرج من الحصة؟' })).toBeVisible();
  await expect(page.getByText('مكانك المحفوظ')).toBeVisible();
  await page.getByRole('button', { name: 'أكمل الحصة' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/child\/lesson\//);

  // Into the ayah loop, then browser back → the same sheet (no silent exit).
  await tapUntil(page, () => page.getByRole('button', { name: 'افتح الميكروفون وأجب بصوتك' }).isEnabled());
  await page.getByRole('button', { name: 'افتح الميكروفون وأجب بصوتك' }).click();
  await page.getByRole('button', { name: 'قلت نعم' }).click();
  await expect(page.getByText('سورة الإخلاص · الآية ١')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('alertdialog', { name: 'تخرج من الحصة؟' })).toBeVisible();
  await expect(page.getByText(/سورة الإخلاص — الآية ١ من ٤/)).toBeVisible();
  await page.getByRole('button', { name: 'خروج' }).click();
  await page.waitForURL(/\/child\/home/);

  // Home's CTA resumes at the saved ayah (not the intro).
  await page.getByRole('link', { name: /أكمل الحصة|ابدأ الحصة/ }).click({ force: true });
  await expect(page.getByText('سورة الإخلاص · الآية ١')).toBeVisible();
});
