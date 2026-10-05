// Screenshot baselines of fixtures/kitchen-sink's home page at 375, 768, 1280 and 1440 px in light
// and dark, taken in the installed Chrome and compared pixel by pixel with the committed PNGs in
// test/screenshots/baseline/. Run with `npm run test:screenshots`.
//
// - On the setup the baselines were taken with (baseline/taken-with.json), rendering is exact, so
//   any changed pixel fails. On another Chrome version or OS, text antialiasing shifts, so up to
//   0.1% of pixels may differ (SPEC 13.4's limit). A failure writes the new screenshot and a diff
//   (changed pixels in red) to .tmp/screenshots/ for review.
// - After a reviewed design change, `UPDATE_SCREENSHOTS=1 npm run test:screenshots` rewrites the
//   baselines; look at the PNG diff before committing.
// - The footer's copyright year and "Last updated" month come from the build date, so they are masked.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { buildFixture, serve } from '../e2e/fixture.ts';
import { comparePngs } from './compare.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BASELINE = fileURLToPath(new URL('./baseline/', import.meta.url));
const OUT = join(REPO, '.tmp/screenshots');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UPDATE = process.env.UPDATE_SCREENSHOTS === '1';
const WIDTHS = [375, 768, 1280, 1440];
const THEMES = ['light', 'dark'] as const;
const MAX_DIFFERENT_ELSEWHERE = 0.001;

describe('kitchen-sink home page screenshots', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;
  let takenWith = '';

  before(async () => {
    site = await serve(buildFixture('kitchen-sink', 'https://u.github.io'), '/');
    browser = await chromium.launch({ executablePath: CHROME });
    takenWith = JSON.stringify({ chrome: browser.version(), platform: process.platform });
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    if (UPDATE) {
      mkdirSync(BASELINE, { recursive: true });
      writeFileSync(join(BASELINE, 'taken-with.json'), takenWith + '\n');
    }
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const name = `kitchen-sink-home-${width}-${theme}.png`;
      test(`${width}px, ${theme}`, async () => {
        const ctx = await browser.newContext({
          viewport: { width, height: 900 },
          deviceScaleFactor: 1,
          colorScheme: theme,
          reducedMotion: 'no-preference',
          locale: 'en-US',
          timezoneId: 'America/New_York',
        });
        try {
          const page = await ctx.newPage();
          await page.goto(site.home, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const shot = await page.screenshot({
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
            mask: [page.locator('.foot .small')],
            maskColor: '#808080',
          });
          const file = join(BASELINE, name);
          if (UPDATE) return writeFileSync(file, shot);
          assert.ok(existsSync(file), `no baseline ${name}; run UPDATE_SCREENSHOTS=1 npm run test:screenshots`);

          const recorded = readFileSync(join(BASELINE, 'taken-with.json'), 'utf8').trim();
          const result = await comparePngs(page, readFileSync(file), shot);
          const ratio = result.different / result.total;
          if (ratio > (recorded === takenWith ? 0 : MAX_DIFFERENT_ELSEWHERE) || result.sizes[0] !== result.sizes[1]) {
            writeFileSync(join(OUT, name), shot);
            if (result.diff) writeFileSync(join(OUT, name.replace(/\.png$/, '-diff.png')), result.diff);
            const setup = recorded === takenWith ? '' : `\nThe baselines were taken with ${recorded}; this run uses ${takenWith}.`;
            assert.fail(
              `${name}: ${result.sizes[0] === result.sizes[1] ? `${(ratio * 100).toFixed(3)}% of pixels differ` : `size ${result.sizes[1]}, baseline ${result.sizes[0]}`}. ` +
                `See ${OUT}.${setup}`,
            );
          }
        } finally {
          await ctx.close();
        }
      });
    }
  }
});
