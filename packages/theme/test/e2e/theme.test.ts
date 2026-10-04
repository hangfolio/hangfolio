// Theme behaviour in the installed Google Chrome, through playwright-core (no browser download):
// the localStorage "theme" key, the themechange event {theme, preference, source}, the theme-color
// swap, cross-tab sync, the back/forward cache, and no flash of the wrong theme on load.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright-core';
import { buildFixture, serve } from './fixture.ts';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LIGHT_BG = '#f5f7fa';
const DARK_BG = '#0e1219';

// Collects every themechange detail, and records what the first rendered frame shows.
const PROBE = () => {
  const w = window as unknown as { events: unknown[]; firstFrame: unknown };
  w.events = [];
  document.addEventListener('themechange', (e) => w.events.push((e as CustomEvent).detail));
  requestAnimationFrame(() => {
    const root = document.documentElement;
    w.firstFrame = { theme: root.getAttribute('data-theme'), bg: getComputedStyle(root).getPropertyValue('--bg').trim() };
  });
};

type Detail = { theme: string; preference: string; source: string };

const state = (page: Page) =>
  page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme'),
    themeColor: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content,
    label: document.querySelector('[data-theme-toggle]')!.getAttribute('aria-label'),
    events: (window as unknown as { events: Detail[] }).events,
  }));

describe('theme toggle', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;

  // colorScheme null means no emulation: the page sees the host's real OS theme.
  async function open(colorScheme: 'light' | 'dark' | null) {
    const ctx = await browser.newContext({ colorScheme });
    await ctx.addInitScript(PROBE);
    const page = await ctx.newPage();
    await page.goto(site.home);
    return { ctx, page };
  }

  before(async () => {
    site = await serve(buildFixture('minimal', 'https://u.github.io/hangfolio'), '/hangfolio');
    // Playwright turns off the back/forward cache by default; the bfcache case needs it.
    browser = await chromium.launch({ executablePath: CHROME, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  test('the header, footer and toggle render', async () => {
    const { ctx, page } = await open('light');
    for (const selector of ['header.hdr', 'header.hdr nav a', 'button.tgl', 'footer.foot']) {
      assert.ok(await page.locator(selector).first().isVisible(), selector);
    }
    await ctx.close();
  });

  test('a click flips the theme, saves it, fires themechange and swaps theme-color', async () => {
    const { ctx, page } = await open('light');
    assert.deepEqual(await state(page), { attr: null, stored: null, themeColor: LIGHT_BG, label: 'Switch to dark theme', events: [] });

    await page.click('[data-theme-toggle]');
    assert.deepEqual(await state(page), {
      attr: 'dark', stored: 'dark', themeColor: DARK_BG, label: 'Switch to light theme',
      events: [{ theme: 'dark', preference: 'dark', source: 'toggle' }],
    });

    // Flipping back to the OS theme forgets the choice.
    await page.click('[data-theme-toggle]');
    const back = await state(page);
    assert.deepEqual({ ...back, events: back.events.at(-1) }, {
      attr: null, stored: null, themeColor: LIGHT_BG, label: 'Switch to dark theme',
      events: { theme: 'light', preference: 'system', source: 'toggle' },
    });
    await ctx.close();
  });

  test('with a dark OS, the first click saves "light"', async () => {
    const { ctx, page } = await open('dark');
    assert.equal((await state(page)).themeColor, DARK_BG);
    await page.click('[data-theme-toggle]');
    const after = await state(page);
    assert.deepEqual([after.attr, after.stored, after.themeColor], ['light', 'light', LIGHT_BG]);
    assert.deepEqual(after.events, [{ theme: 'light', preference: 'light', source: 'toggle' }]);
    await ctx.close();
  });

  test('an OS theme change fires themechange with source "system"', async () => {
    const { ctx, page } = await open('light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => (window as unknown as { events: unknown[] }).events.length > 0);
    const now = await state(page);
    assert.deepEqual(now.events, [{ theme: 'dark', preference: 'system', source: 'system' }]);
    assert.equal(now.themeColor, DARK_BG);
    await ctx.close();
  });

  test('no flash of the wrong theme on reload, and a control without the pre-paint script flashes', async () => {
    const { ctx, page } = await open('light');
    await page.click('[data-theme-toggle]');
    for (let i = 0; i < 3; i++) {
      await page.reload();
      const first = await page.waitForFunction(() => (window as unknown as { firstFrame: unknown }).firstFrame).then((h) => h.jsonValue());
      assert.deepEqual(first, { theme: 'dark', bg: DARK_BG }, `reload ${i + 1}`);
      assert.equal((await state(page)).themeColor, DARK_BG);
    }
    // Control: the same page with the inline pre-paint script removed shows light first.
    await page.route(site.home, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<script>\s*\/\* Apply a saved[\s\S]*?<\/script>/, '');
      await route.fulfill({ response, body });
    });
    await page.reload();
    const control = await page.waitForFunction(() => (window as unknown as { firstFrame: unknown }).firstFrame).then((h) => h.jsonValue());
    assert.deepEqual(control, { theme: null, bg: LIGHT_BG });
    await ctx.close();
  });

  test('another open tab follows a change (source "storage")', async () => {
    const { ctx, page: a } = await open('light');
    const b = await ctx.newPage();
    await b.goto(site.home);
    await a.click('[data-theme-toggle]');
    await b.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
    const other = await state(b);
    assert.deepEqual([other.attr, other.themeColor], ['dark', DARK_BG]);
    assert.deepEqual(other.events, [{ theme: 'dark', preference: 'dark', source: 'storage' }]);

    await a.click('[data-theme-toggle]');
    await b.waitForFunction(() => !document.documentElement.hasAttribute('data-theme'));
    assert.deepEqual((await state(b)).events.at(-1), { theme: 'light', preference: 'system', source: 'storage' });
    await ctx.close();
  });

  // No colour-scheme emulation here: Playwright's emulation lapses while a page is restored from the
  // cache, so a host OS theme that differs from the emulated one fires a stray media "change".
  test('a page restored from the back/forward cache catches up (source "restore")', async () => {
    const { ctx, page } = await open(null);
    const osDark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
    const chosen = osDark ? 'light' : 'dark';
    await page.evaluate(() => {
      (window as unknown as { restored: boolean }).restored = false;
      addEventListener('pageshow', (e) => ((window as unknown as { restored: boolean }).restored = e.persisted));
    });
    await page.goto(new URL('404.html', site.home).href);
    await page.click('[data-theme-toggle]');
    await page.goBack({ waitUntil: 'commit' });
    await page.waitForFunction((theme) => document.documentElement.getAttribute('data-theme') === theme, chosen);
    const restored = await page.evaluate(() => (window as unknown as { restored: boolean }).restored);
    assert.equal(restored, true, 'the home page did not come from the back/forward cache');
    await page.waitForTimeout(200);
    const now = await state(page);
    assert.deepEqual(now.events[0], { theme: chosen, preference: chosen, source: 'restore' });
    // Chrome then delivers the "storage" event it held while the page was cached; it must agree.
    for (const detail of now.events) assert.deepEqual([detail.theme, detail.preference], [chosen, chosen]);
    assert.deepEqual([now.attr, now.stored, now.themeColor], [chosen, chosen, chosen === 'dark' ? DARK_BG : LIGHT_BG]);
    await ctx.close();
  });
});
