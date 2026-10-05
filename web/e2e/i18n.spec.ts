// The language matrix: every reachable page in ar / en / id.
//  - the choice persists (reload) and sets <html lang/dir>
//  - en / id: no Arabic outside the allow-list (lang="ar" text: Quran, hadith matn, the
//    surah cartouche, the language's own name; the brand «غَرْسة»), in text, aria-label,
//    placeholder, title and alt — each offender reported with a selector
//  - no raw keys / "undefined" / "{name}" in any language
//  - digits: Arabic-Indic in ar text, never in en / id
//  - no horizontal overflow (375 / 1280)
// Parent pages need a signed-in Supabase session: see playwright.stack.config.ts.
import { expect, test, type Page } from '@playwright/test';

import { DEV_PORT } from '../playwright.i18n.config';

type Lang = 'ar' | 'en' | 'id';
const LANGS: Lang[] = ['ar', 'en', 'id'];
const STORAGE_KEY = 'gharsah.landingLang';

const PUBLIC = [
  '/',
  '/login?tab=parent',
  '/login?tab=child',
  '/signup',
  '/forgot-password',
  '/legal',
  '/legal?doc=privacy',
  '/no-such-page',
];
// dev server only (the sample child, `?preview=1`)
const SAMPLE_CHILD_NAME = 'عبدالله (معاينة)';
const CHILD = ['/child/home', '/child/review', '/child/profile', '/child/weekly-review', '/child/ask'];

interface Offender {
  kind: string;
  where: string;
  text: string;
}

/** Runs in the page: what's wrong with this language's rendering. */
function scan([lang, userData]: [Lang, string[]]): Offender[] {
  const AR = /[؀-ۿ]/;
  const AR_DIGIT = /[٠-٩۰-۹]/;
  const RAW =
    /\b(undefined|NaN|\[object Object\])\b|\{[a-zA-Z_]+\}|\b(?:lesson|parent|child|auth|admin|common|landing|meta|board|plans)\.[a-z][a-zA-Z]+(?:\.[a-zA-Z]+)*\b/;
  const BRAND = 'غَرْسة';
  const out: Offender[] = [];

  const path = (el: Element): string => {
    const parts: string[] = [];
    for (let e: Element | null = el; e && e !== document.body && parts.length < 5; e = e.parentElement) {
      let p = e.tagName.toLowerCase();
      if (e.id) p += `#${e.id}`;
      const tid = e.getAttribute('data-testid');
      if (tid) p += `[data-testid=${tid}]`;
      const cls = (e.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => c && !c.includes('['))
        .slice(0, 2);
      if (cls.length) p += `.${cls.join('.')}`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    return !!(el as HTMLElement).offsetParent || s.position === 'fixed';
  };
  // allowed Arabic: marked lang="ar" below a non-Arabic page (Quran, hadith, the cartouche, «العربية»)
  // …and the user's own data (a child's name typed by the parent stays as typed)
  const allowed = (el: Element, t: string) => {
    let rest = t;
    for (const u of userData) rest = rest.split(u).join('');
    return (
      !AR.test(rest) || t.replace(/\s+/g, '') === BRAND || el.closest('[lang="ar"], [lang^="ar-"]') !== null
    );
  };

  const check = (el: Element, t: string, kind: string) => {
    if (!t.trim()) return;
    if (RAW.test(t)) out.push({ kind: `raw ${kind}`, where: path(el), text: t.trim().slice(0, 90) });
    if (lang === 'ar') return;
    if (AR.test(t) && !allowed(el, t))
      out.push({ kind: `arabic ${kind}`, where: path(el), text: t.trim().slice(0, 90) });
    else if (AR_DIGIT.test(t) && !el.closest('[lang="ar"]'))
      out.push({ kind: `arabic digits ${kind}`, where: path(el), text: t.trim().slice(0, 90) });
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !visible(el)) continue;
    check(el, n.textContent ?? '', 'text');
  }
  for (const el of Array.from(document.querySelectorAll('[aria-label], [placeholder], [title], img[alt]'))) {
    if (!visible(el) && el.tagName !== 'svg') continue;
    for (const a of ['aria-label', 'placeholder', 'title', 'alt']) {
      const v = el.getAttribute(a);
      if (v) check(el, v, a);
    }
  }
  check(document.documentElement, document.title, 'document.title');
  return out;
}

async function open(page: Page, url: string, lang: Lang) {
  await page.addInitScript(
    ([k, l]) => {
      try {
        if (!sessionStorage.getItem('gh.i18n.e2e')) {
          localStorage.setItem(k, l);
          sessionStorage.setItem('gh.i18n.e2e', '1');
        }
      } catch {
        // storage blocked
      }
    },
    [STORAGE_KEY, lang] as const,
  );
  await page.goto(url);
  // hydrated in the chosen language
  await expect(page.locator('html')).toHaveAttribute('lang', lang, { timeout: 20_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

async function audit(page: Page, lang: Lang, label: string, userData: string[] = []) {
  await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  const offenders = await page.evaluate(scan, [lang, userData] as [Lang, string[]]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow (px)`).toBeLessThanOrEqual(1);
  expect(offenders, `${label}: ${JSON.stringify(offenders, null, 1)}`).toEqual([]);
}

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    const t = m.text();
    // network stubs: the placeholder Supabase host can't resolve — not an app error
    if (m.type() === 'error' && !/e2e-placeholder|Failed to load resource|ERR_NAME_NOT_RESOLVED/.test(t))
      errors.push(t);
    if (m.type() === 'warning' && /^Warning:|React/.test(t)) errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

for (const lang of LANGS) {
  test.describe(`public pages — ${lang}`, () => {
    for (const url of PUBLIC) {
      test(`${url}`, async ({ page }) => {
        const errors = watchConsole(page);
        await open(page, url, lang);
        await audit(page, lang, `${lang} ${url}`);
        expect(errors, `${lang} ${url}: console`).toEqual([]);
      });
    }
  });

  test.describe(`child pages (sample child) — ${lang}`, () => {
    test.skip(!!process.env.BASE_URL, 'the sample child exists on the dev server only');
    for (const url of CHILD) {
      test(`${url}`, async ({ page }) => {
        const errors = watchConsole(page);
        const base = `http://localhost:${DEV_PORT}`;
        await open(page, `${base}/child/home?preview=1`, lang);
        if (url !== '/child/home') {
          await page.goto(`${base}${url}`);
          await expect(page.locator('html')).toHaveAttribute('lang', lang, { timeout: 20_000 });
          await page.waitForTimeout(800);
        }
        // the sample child's name (src/dev/childPreview.ts) is user data, not UI copy
        await audit(page, lang, `${lang} ${url}`, [SAMPLE_CHILD_NAME, SAMPLE_CHILD_NAME.split(' ')[0] ?? '']);
        expect(errors, `${lang} ${url}: console`).toEqual([]);
      });
    }
  });
}

test('switching the language in the UI persists across a reload and a new page', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  const desktop = info.project.name === 'desktop-1280';
  for (const [code, name] of [
    ['en', 'English'],
    ['id', 'Bahasa Indonesia'],
    ['ar', 'العربية'],
  ] as const) {
    const button = page
      .getByRole('button', { name: /^(اللغة|Language|Bahasa):/ })
      .filter({ visible: true })
      .first();
    await button.click();
    const pick = desktop
      ? page.getByRole('option', { name: new RegExp(name) })
      : page.getByRole('dialog').getByText(name, { exact: true });
    await pick.first().click();
    if (!desktop) await page.keyboard.press('Escape').catch(() => {});
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', code, { timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
    await page.goto('/login?tab=parent');
    await expect(page.locator('html')).toHaveAttribute('lang', code, { timeout: 20_000 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', code, { timeout: 20_000 });
  }
});

test('digits and prices per locale on the landing', async ({ page }) => {
  for (const lang of LANGS) {
    await page.context().clearCookies();
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang, { timeout: 20_000 });
    await page.waitForTimeout(500);
    const text = await page.evaluate((l) => {
      // the visible text outside lang="ar" islands (Quran, cartouche)
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let s = '';
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        // in Arabic every visible text counts; in en / id not the lang="ar" islands
        if (el && (l === 'ar' || !el.closest('[lang="ar"]')) && el.getClientRects().length > 0)
          s += ` ${n.textContent}`;
      }
      return s;
    }, lang);
    if (lang === 'ar') expect(text).toMatch(/[٠-٩]/);
    else expect(text).not.toMatch(/[٠-٩]/);
  }
});

test("the landing mockup shows the locale's teacher: its sprite folder, its name, all frames load", async ({
  page,
}) => {
  const expected = {
    ar: { folder: 'teacher-boy', name: 'المعلم عبدالله' },
    en: { folder: 'teacher-en-boy', name: 'Teacher Adam' },
    id: { folder: 'teacher-id-boy', name: 'Ustaz Ahmad' },
  } as const;
  for (const lang of LANGS) {
    const bad: string[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/characters/') && r.status() >= 400) bad.push(r.url());
    });
    await page.goto(`/?lang=${lang}`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang, { timeout: 20_000 });
    const srcs = await page
      .locator('img[src*="/characters/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('src') ?? ''));
    expect(srcs.length, `${lang}: a teacher sprite`).toBeGreaterThan(0);
    for (const s of srcs) expect(s, lang).toContain(`/characters/${expected[lang].folder}/`);
    await expect(page.getByText(expected[lang].name).filter({ visible: true }).first()).toBeVisible();
    // all 7 frames of that teacher are served (the lip-sync set)
    for (const f of ['idle', 'blink', 'happy', 'mouth-small', 'mouth-open', 'mouth-wide', 'mouth-o']) {
      const r = await page.request.get(`/characters/${expected[lang].folder}/${f}.webp`);
      expect(r.status(), `${lang} ${f}`).toBe(200);
      expect(r.headers()['content-type'] ?? '').toContain('image');
    }
    expect(bad, `${lang}: missing frames`).toEqual([]);
  }
});
