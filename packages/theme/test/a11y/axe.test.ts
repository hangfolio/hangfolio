// M3 acceptance: axe-core reports no violations on the home page of fixtures/kitchen-sink and
// fixtures/owner-like, in light and dark, at 375 and 1280 px, in the installed Chrome. The starter
// (in demo mode, with its example banner) is checked too, and so is every other page these sites
// build, so pages added later are covered without changes here. Run with `npm run test:a11y`.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { listFiles } from '../helpers.ts';
import { buildSite, serve } from '../e2e/fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const SITES = ['fixtures/kitchen-sink', 'fixtures/owner-like', 'starter'];
const WIDTHS = [375, 1280];
const THEMES = ['light', 'dark'] as const;
// The --bg token in each theme. Nothing is saved, so the page follows the emulated OS theme.
const BG = { light: '#f5f7fa', dark: '#0e1219' };

type Result = { id: string; impact: string; help: string; nodes: { target: string[]; failureSummary: string }[] };

/** Runs axe with its default rules (WCAG A/AA plus best practices) on the page as it is now. */
async function runAxe(page: Page) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE });
  return page.evaluate(() =>
    (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: Result[]; incomplete: Result[] }> } }).axe.run(document, {
      resultTypes: ['violations', 'incomplete'],
    }),
  );
}

const describeResult = (v: Result) =>
  `${v.id} (${v.impact}): ${v.help}\n` + v.nodes.map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary.replace(/\n/g, '\n      ')}`).join('\n');

for (const dir of SITES) {
  const missing = !existsSync(join(REPO, dir, 'package.json')) && `${dir} does not exist yet`;
  const noChrome = !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH`;

  describe(`axe on ${dir}`, { skip: missing || noChrome }, () => {
    let browser: Browser;
    let site: Awaited<ReturnType<typeof serve>>;
    let pages: string[] = [];

    before(async () => {
      const dist = buildSite(dir, 'https://u.github.io/hangfolio');
      // "" is the home page; the others are served without .html, as GitHub Pages does. An .html
      // file without a <head> is no page (a search engine's verification file).
      pages = listFiles(dist)
        .filter((file) => file.endsWith('.html') && /<head[\s>]/i.test(readFileSync(join(dist, file), 'utf8')))
        .map((file) => file.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, ''));
      site = await serve(dist, '/hangfolio');
      browser = await chromium.launch({ executablePath: CHROME });
    });
    after(async () => {
      await browser?.close();
      await site?.close();
    });

    test('the build has a home page', () => assert.ok(pages.includes(''), pages.join(', ')));

    for (const colorScheme of THEMES) {
      for (const width of WIDTHS) {
        test(`no violations at ${width}px (${colorScheme})`, async (t) => {
          const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
          try {
            const page = await ctx.newPage();
            const found: string[] = [];
            let incomplete = 0;
            for (const path of pages) {
              await page.goto(site.home + path, { waitUntil: 'networkidle' });
              await page.evaluate(() => document.fonts.ready);
              const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
              assert.equal(bg, BG[colorScheme], `/${path} is not in the ${colorScheme} theme`);
              const results = await runAxe(page);
              found.push(...results.violations.map((v) => `/${path}: ${describeResult(v)}`));
              incomplete += results.incomplete.reduce((sum, v) => sum + v.nodes.length, 0);
            }
            t.diagnostic(`${pages.length} page(s); ${incomplete} node(s) axe could not decide (not failures)`);
            assert.deepEqual(found, [], `axe violations:\n${found.join('\n')}`);
          } finally {
            await ctx.close();
          }
        });
      }
    }

    // A control, so a passing run means axe looked: break the home page and expect axe to say so.
    test('axe reports a broken home page', async () => {
      const page = await browser.newPage();
      await page.goto(site.home, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        document.querySelector('main img')?.removeAttribute('alt');
        const link = document.querySelector('main a[href]');
        if (link) link.textContent = '';
      });
      const ids = (await runAxe(page)).violations.map((v) => v.id);
      await page.close();
      for (const id of ['image-alt', 'link-name']) assert.ok(ids.includes(id), `expected ${id}, got ${ids.join(', ')}`);
    });
  });
}
