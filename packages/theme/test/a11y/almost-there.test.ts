// The starter's "Almost there" index.html (SPEC 8.4): what GitHub's classic branch build shows
// before Source is "GitHub Actions". It is served as it is, so it is checked as it is: axe and
// text contrast in light and dark at 375 and 1280 px, no horizontal scroll at 320 px, nothing
// loaded from elsewhere, and the settings links it builds from the address, in the installed Chrome.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContextOptions, type Page } from 'playwright-core';
import { contrastFailures } from '../e2e/contrast.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const HTML = readFileSync(join(REPO, 'starter/index.html'), 'utf8');
const BG = { light: '#f5f7fa', dark: '#0e1219' };

type Violation = { id: string; help: string; nodes: { target: string[] }[] };

describe('the "Almost there" page', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let browser: Browser;
  before(async () => {
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser?.close();
  });

  /** Opens the page as if GitHub served it at `url`; every other request is recorded and refused. */
  async function open(url: string, options: BrowserContextOptions = {}) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const elsewhere: string[] = [];
    await page.route('**/*', (route) => {
      if (route.request().url() === url) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
      elsewhere.push(route.request().url());
      return route.abort();
    });
    await page.goto(url);
    return { page, elsewhere, close: () => context.close() };
  }
  const links = (page: Page) => page.$$eval('main a', (as) => as.map((a) => [a.textContent, (a as HTMLAnchorElement).href]));

  test('on <owner>.github.io it links to that repository; on a project path, to the project', async () => {
    const user = await open('https://rowan-vale.github.io/');
    assert.deepEqual(await links(user.page), [
      ['Settings → Pages', 'https://github.com/rowan-vale/rowan-vale.github.io/settings/pages'],
      ['Actions → Deploy site', 'https://github.com/rowan-vale/rowan-vale.github.io/actions/workflows/deploy.yml'],
    ]);
    assert.equal(await user.page.textContent('li'), 'Open your repository’s Settings → Pages.');
    assert.deepEqual(user.elsewhere, []);
    await user.close();

    for (const url of ['https://Rowan-Vale.github.io/website/', 'https://rowan-vale.github.io/website/index.html']) {
      const project = await open(url.toLowerCase());
      assert.deepEqual((await links(project.page)).map(([, href]) => href), [
        'https://github.com/rowan-vale/website/settings/pages',
        'https://github.com/rowan-vale/website/actions/workflows/deploy.yml',
      ]);
      await project.close();
    }
  });

  test('elsewhere, or without JavaScript, the steps stay plain text', async () => {
    const custom = await open('https://example.org/');
    assert.deepEqual(await links(custom.page), []);
    assert.match(await custom.page.innerText('main'), /Open your repository’s Settings → Pages\.\n/);
    await custom.close();
    const noJs = await open('https://rowan-vale.github.io/', { javaScriptEnabled: false });
    assert.deepEqual(await links(noJs.page), []);
    assert.match(await noJs.page.innerText('main'), /Under Build and deployment → Source, choose GitHub Actions\./);
    assert.equal(await noJs.page.getAttribute('meta[name="robots"]', 'content'), 'noindex');
    await noJs.close();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const width of [375, 1280]) {
      test(`axe and text contrast at ${width}px (${colorScheme})`, async () => {
        const { page, close } = await open('https://rowan-vale.github.io/', { viewport: { width, height: 800 }, colorScheme });
        try {
          assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()), BG[colorScheme]);
          await page.addScriptTag({ content: AXE });
          const violations = await page.evaluate(() =>
            (window as unknown as { axe: { run: (d: Document) => Promise<{ violations: Violation[] }> } }).axe.run(document).then((r) => r.violations),
          );
          assert.deepEqual(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`), []);
          assert.deepEqual(await page.evaluate(contrastFailures, 4.5), []);
        } finally {
          await close();
        }
      });
    }
  }

  test('no horizontal scroll at 320px', async () => {
    const { page, close } = await open('https://rowan-vale.github.io/website/', { viewport: { width: 320, height: 640 } });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    await close();
  });
});
