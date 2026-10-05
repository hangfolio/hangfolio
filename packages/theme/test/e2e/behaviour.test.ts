// The theme-behaviour checks of SPEC 10.2 that theme.test.ts and home.test.ts don't cover, in the
// installed Google Chrome: printing always uses the light palette, and the skip link works.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright-core';
import { buildFixture, serve } from './fixture.ts';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LIGHT_BG = 'rgb(245, 247, 250)';
const DARK_BG = 'rgb(14, 18, 25)';

describe('print and the skip link', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;

  async function open(colorScheme: 'light' | 'dark') {
    const ctx = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(site.home);
    return { ctx, page };
  }
  const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const hidden = (page: Page, selector: string) => page.$eval(selector, (el) => getComputedStyle(el).display === 'none');

  before(async () => {
    site = await serve(buildFixture('minimal', 'https://u.github.io/hangfolio'), '/hangfolio');
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  test('printing uses the light palette, whether dark comes from the OS or a saved choice', async () => {
    const { ctx, page } = await open('dark');
    assert.equal(await background(page), DARK_BG, 'a dark OS shows the dark palette on screen');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await background(page), LIGHT_BG, 'OS dark, printed');

    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    assert.equal(await background(page), DARK_BG, 'a saved dark choice on screen');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await background(page), LIGHT_BG, 'saved dark, printed');
    for (const selector of ['.hdr nav', '.tgl', '.skip']) assert.ok(await hidden(page, selector), `${selector} is left off the printout`);
    await ctx.close();
  });

  test('the skip link is the first stop, shows on focus, and moves focus to the main content', async () => {
    const { ctx, page } = await open('light');
    const skip = page.locator('a.skip');
    assert.ok(((await skip.boundingBox())?.y ?? 0) < 0, 'off screen until focused');

    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip');
    const box = await skip.boundingBox();
    assert.ok(box && box.y >= 0 && box.height > 0, 'visible once focused');
    assert.equal(await skip.textContent(), 'Skip to content');

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'main', undefined, { timeout: 2000 }).catch(() => {});
    const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName.toLowerCase());
    assert.equal(focused, 'main', 'Enter on the skip link moves focus to <main id="main">');
    assert.equal(new URL(page.url()).pathname, '/hangfolio/', 'stays on the page, under the base');
    assert.equal(new URL(page.url()).hash, '#main');
    await ctx.close();
  });
});
