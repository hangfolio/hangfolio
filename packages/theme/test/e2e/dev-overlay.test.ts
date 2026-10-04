// `hangfolio dev` shows the checks in the browser (SPEC 5.10): an error becomes Astro's error
// overlay, pointing at the file and line; fixing the file reloads the page, and the warnings and
// hidden examples move to a small panel. Runs the real dev server and the installed Chrome.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');
// Inside the workspace, so the site finds hangfolio and Astro the way a fixture does.
const SITE = join(REPO, '.tmp/dev-overlay');

const BAD_NEWS = 'items:\n  - { date: 2026-13-02, text: "Deployed the first gauge." }\n  - { example: true, date: 2024-05, text: "An example item." }\n';
const GOOD_NEWS = BAD_NEWS.replace('2026-13-02', '2026-08-02');
// Astro would stop the dev server on these at startup; the theme leaves them out instead.
const BAD_PROJECT = '---\ntitle: "Kelp"\nsummary: Counts kelp: from drone photos\n---\n';
const GOOD_PROJECT = '---\ntitle: "Kelp"\nsummary: "Counts kelp from drone photos."\n---\n';

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, child: ChildProcess) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`hangfolio dev exited with ${child.exitCode}`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`no dev server at ${url}`);
}

describe('hangfolio dev', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let child: ChildProcess;
  let browser: Browser;
  let output = '';
  let home = '';

  before(async () => {
    rmSync(SITE, { recursive: true, force: true });
    cpSync(join(REPO, 'fixtures/broken/_base'), SITE, { recursive: true });
    mkdirSync(join(SITE, 'content/projects'), { recursive: true });
    writeFileSync(join(SITE, 'content/news.yaml'), BAD_NEWS);
    writeFileSync(join(SITE, 'content/projects/kelp.md'), BAD_PROJECT);
    const port = await freePort();
    home = `http://localhost:${port}/`;
    child = spawn(process.execPath, [BIN, 'dev', '--ignore-lock', '--port', String(port)], { cwd: SITE, env: { ...process.env, NO_COLOR: '1' } });
    child.stdout!.on('data', (chunk) => (output += chunk));
    child.stderr!.on('data', (chunk) => (output += chunk));
    await waitForServer(home, child);
    browser = await chromium.launch({ executablePath: CHROME });
  });

  after(async () => {
    await browser?.close();
    child?.kill('SIGTERM');
    await new Promise((resolve) => (child?.exitCode !== null ? resolve(null) : child.once('exit', resolve)));
    rmSync(SITE, { recursive: true, force: true });
  });

  test('an error shows as the overlay, and fixing the file brings the page back with the panel', async () => {
    const page = await browser.newPage();
    await page.goto(home);
    const overlay = page.locator('vite-error-overlay');
    await overlay.waitFor();
    assert.equal(await overlay.locator('#title').textContent(), 'hangfolio check found 2 errors');
    assert.equal(
      await overlay.locator('#message-content').textContent(),
      "content/news.yaml:2 E204 date must look like 2026-08 or 2026-08-14. You wrote '2026-13-02'.\n\n" +
        'content/projects/kelp.md:3 E101 This value contains \': \' and needs quotes: summary: "Counts kelp: from drone photos"',
    );
    assert.equal(await overlay.locator('#code h2').textContent(), 'content/news.yaml:2:7');
    assert.match(output, /content\/news\.yaml:2:7 {2}error E204 {2}date must look like 2026-08 or 2026-08-14/);

    writeFileSync(join(SITE, 'content/news.yaml'), GOOD_NEWS);
    writeFileSync(join(SITE, 'content/projects/kelp.md'), GOOD_PROJECT);
    const panel = page.locator('details.devchecks');
    await panel.waitFor({ timeout: 20_000 });
    assert.equal(await overlay.count(), 0);
    assert.equal((await panel.locator('summary').textContent())?.trim(), 'hangfolio · 1 example hidden');
    assert.match((await panel.locator('li').first().textContent()) ?? '', /content\/news\.yaml:3 W403 You edited this example, but it still says example: true/);
    assert.equal(await page.locator('h1').textContent(), 'Juniper Ash');
    await page.close();
  });
});
