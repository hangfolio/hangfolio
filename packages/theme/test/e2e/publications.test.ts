// M5: the publications page. fixtures/kitchen-sink and fixtures/owner-like build it at base / and
// /hangfolio: the papers grouped by kind inside #papers, each with its ids, links, summary and
// BibTeX block; the in-preparation items under #prep; ScholarlyArticle JSON-LD on the full site
// URL; and the home page's links to it. A copy of kitchen-sink with a broken entry still builds,
// with W301 on the entry's line. In the installed Chrome: the Copy button copies exactly the text
// shown, falls back to selecting it when the clipboard is denied, and stays hidden without the
// Clipboard API or JavaScript; text contrast is at least 4.5:1 in both themes, the year hangs in
// the margin on wide screens, and a phone never scrolls sideways.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { readBib } from '../../src/lib/bib.ts';
import { contrastFailures } from './contrast.ts';
import { buildFixture, serve } from './fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const mainOf = (html: string) => html.match(/<main[^>]*>(.*)<\/main>/s)![1].replace(/ data-astro-cid-\w+/g, '');
const graphOf = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])['@graph'];

for (const pagesUrl of ['https://u.github.io', 'https://u.github.io/hangfolio']) {
  const base = new URL(pagesUrl).pathname.replace(/\/$/, '');

  describe(`fixtures/kitchen-sink publications with SITE_PAGES_URL=${pagesUrl}`, () => {
    let html = '';
    let main = '';
    let home = '';
    before(() => {
      const dist = buildFixture('kitchen-sink', pagesUrl);
      html = readFileSync(join(dist, 'publications.html'), 'utf8');
      main = mainOf(html);
      home = mainOf(readFileSync(join(dist, 'index.html'), 'utf8'));
    });

    test('every root-relative href and src stays under the base, with no //', () => {
      const refs = [...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
      assert.ok(refs.length > 5);
      for (const ref of refs) {
        assert.ok(!ref.includes('//'), `${ref} contains //`);
        if (base) assert.match(ref, new RegExp(`^${base}(/|$)`), `${ref} escapes ${base}`);
      }
      assert.match(html, new RegExp(`<a href="${base}/publications" class="quiet"[^>]*aria-current="page"[^>]*>Publications</a>`));
      assert.match(html, new RegExp(`<link rel="canonical" href="${pagesUrl}/publications">`));
      // The custom.css hook every page has (docs/customizing.md).
      assert.match(html, /<main id="main" class="page" tabindex="-1" data-section="publications">/);
    });

    test('the heading and lede, the groups inside #papers, then #prep with the aside', () => {
      assert.match(main, /^<header class="page-head"><h1>Publications<\/h1><p class="lede">Papers on build caches and storage, with the <em>BibTeX<\/em> for each\.<\/p><\/header><div class="groups" id="papers">/);
      const sections = [...main.matchAll(/<section class="block" aria-labelledby="([^"]+)"><div class="sec-head"><h2 id="\1" class="eyebrow">([^<]+)<\/h2>/g)].map((m) => `${m[1]} ${m[2]}`);
      assert.deepEqual(sections, ['conference Conference papers', 'journal Journal articles', 'prep In preparation']);
      const papers = [...main.matchAll(/<article class="hang" id="([^"]+)" aria-labelledby="\1-title">/g)].map((m) => m[1]);
      assert.deepEqual(papers, ['rook2024driftnet', 'rook2022quay']);
      const items = [...main.matchAll(/<li class="hang"><div class="m"><span class="n">(\d+)<\/span><span>([^<]+)<\/span><\/div><div class="item"><div class="title-row"><h3>([^<]+)<\/h3><span class="chip">([^<]+)<\/span>/g)].map((m) => m.slice(1).join(' | '));
      assert.deepEqual(items, ['01 | Rust | Batched fsync for multi-tenant stores | 2027 venue · in preparation', '02 | Rust · Go | Explaining every remote cache miss | Workshop 2027 · in preparation']);
      assert.match(main, /<p class="authors"><span class="me">Tamsin Rook<\/span>, <a href="https:\/\/example\.org\/okonkwo">Adaeze Okonkwo<\/a><\/p><p>Groups <code>fsync<\/code> calls across tenants without breaking any tenant's <strong>durability<\/strong> promise\.<\/p>/);
      assert.match(main, new RegExp(`using the <a href="${base}/files/driftnet.pdf">Driftnet traces</a>\\.</p>`));
      assert.match(main, /<\/ol><p class="aside">Both drafts use the <a href="https:\/\/example\.org\/shoal">Shoal<\/a> traces\. Preprints will follow\.<\/p><\/section>/);
    });

    test('a paper: margin, title, authors with marks, note, venue and place, DOI line, links, summary and BibTeX', () => {
      const paper = main.match(/<article class="hang" id="rook2024driftnet".*?<\/article>/s)![0];
      assert.match(paper, /<div class="m"><span class="n">2024<\/span><span>EXSB ’24<\/span><\/div>/);
      assert.match(paper, /<h3 id="rook2024driftnet-title" class="ptitle">Driftnet: How Often Do Remote Build Caches Serve Stale Artifacts\?<\/h3>/);
      assert.match(paper, /<p class="authors">Adaeze Okonkwo\*, <span class="me">Tamsin Rook<\/span>\*, Björn Lindqvist, Ilse Marrow<\/p><p class="note">\*Co-first authors<\/p>/);
      assert.match(paper, /<p class="venue-line"><em class="venue">The Example Symposium on Build Systems \(EXSB ’24\)<\/em>, Kestrel Harbour<\/p>/);
      assert.match(paper, /<p class="doi"><a href="https:\/\/doi\.org\/10\.5555\/exsb24\.0042">doi:10\.5555\/exsb24\.0042<\/a><\/p>/);
      assert.match(
        paper,
        new RegExp(
          `<div class="links mono"><a href="${base}/files/driftnet.pdf">\\[PDF\\]</a><a href="https://github.com/hangfolio/hangfolio">\\[Code\\]</a>` +
            '<a href="https://example.org/driftnet">\\[Dataset\\]</a><a href="https://hangfolio.github.io/">\\[Talk notes\\]</a><a href="#bibtex-rook2024driftnet">\\[BibTeX\\]</a></div>',
        ),
      );
      assert.match(paper, /<h4 class="eyebrow">Summary<\/h4><\/div><div class="prose summary"><p>We counted how often remote build caches hand back artifacts that were built from different inputs\.<\/p>/);
      assert.match(paper, /<div class="part" id="bibtex-rook2024driftnet" data-bibtex>.*<pre class="bib" role="region" tabindex="0" aria-label="BibTeX entry for the EXSB ’24 paper"><code>@inproceedings\{rook2024driftnet,\n {2}title {5}= \{Driftnet:/s);
    });

    test('the BibTeX blocks show the raw entries from the file', () => {
      const source = readFileSync(join(REPO, 'fixtures/kitchen-sink/content/publications.bib'), 'utf8');
      const unescape = (text: string) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const blocks = [...main.matchAll(/<code>(.*?)<\/code><\/pre>/gs)].map((m) => unescape(m[1]));
      assert.deepEqual(blocks, readBib(source).entries.map((entry) => entry.raw));
      for (const block of blocks) assert.ok(source.includes(block));
    });

    test('ScholarlyArticle JSON-LD for each paper, on the full site URL', () => {
      const articles = graphOf(html).filter((node: { '@type': string }) => node['@type'] === 'ScholarlyArticle');
      assert.deepEqual(
        articles.map((node: { '@id': string; url: string }) => [node['@id'], node.url]),
        [
          [`${pagesUrl}/publications#rook2024driftnet`, `${pagesUrl}/publications`],
          [`${pagesUrl}/publications#rook2022quay`, `${pagesUrl}/publications`],
        ],
      );
      assert.deepEqual(articles[0].author[1], { '@id': `${pagesUrl}/#person` });
      assert.equal(articles[0].datePublished, '2024-05');
    });

    test('the home page links to the page and to the featured paper’s BibTeX', () => {
      assert.match(home, new RegExp(`<a href="${base}/publications#bibtex-rook2024driftnet">\\[BibTeX\\]</a>`));
    });
  });

  describe(`fixtures/owner-like publications with SITE_PAGES_URL=${pagesUrl}`, () => {
    let html = '';
    let main = '';
    let home = '';
    before(() => {
      const dist = buildFixture('owner-like', pagesUrl);
      html = readFileSync(join(dist, 'publications.html'), 'utf8');
      main = mainOf(html);
      home = readFileSync(join(dist, 'index.html'), 'utf8');
    });

    test("the reference design's ids: #papers, the paper's own anchor, #bibtex and #prep", () => {
      const ids = [...main.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      for (const id of ['papers', 'nsx24', 'nsx24-title', 'bibtex', 'prep']) assert.ok(ids.includes(id), `#${id} in ${ids.join(' ')}`);
      assert.equal(new Set(ids).size, ids.length, 'ids are unique');
      assert.match(main, /<a href="#bibtex">\[BibTeX\]<\/a>/);
      assert.match(main, /<p class="aside">Both drafts grew out of the edge lab's power-metered testbed\. Preprints will be linked here once they are out\.<\/p>/);
      // The technical report is a report, with its venue from howpublished
      assert.match(main, /<h2 id="preprints" class="eyebrow">Preprints and reports<\/h2>.*<em class="venue">Technical report, Northlake Institute of Technology<\/em>/s);
    });

    test('the home page: "Publications" by the research heading and [BibTeX] to #bibtex; the nav as site.yaml lists it', () => {
      assert.match(home, new RegExp(`<h2 id="research-h" class="eyebrow">Research</h2><a href="${base}/publications"[^>]*>Publications</a>`));
      assert.match(home, new RegExp(`<a href="${base}/publications#bibtex"[^>]*>\\[BibTeX\\]</a>`));
      assert.doesNotMatch(home.match(/<nav.*?<\/nav>/s)![0], /Publications/);
    });
  });
}

describe('a broken BibTeX entry', () => {
  const SITE = join(REPO, '.tmp/publications-w301');
  let output = '';
  let main = '';
  before(() => {
    rmSync(SITE, { recursive: true, force: true });
    cpSync(join(REPO, 'fixtures/kitchen-sink'), SITE, { recursive: true, filter: (src) => !/[/\\](dist|node_modules|\.astro)$/.test(src) });
    const bib = join(SITE, 'content/publications.bib');
    const text = readFileSync(bib, 'utf8');
    const broken = '\n@article{rook2023broken,\n  title  = {Missing a comma}\n  author = {Rook, Tamsin},\n  year   = {2023}\n}\n';
    writeFileSync(bib, text.replace('\n% Pasted from', `${broken}\n% Pasted from`));
    const result = spawnSync(process.execPath, [BIN, 'build'], { cwd: SITE, env: { ...process.env, SITE_PAGES_URL: 'https://u.github.io', NO_COLOR: '1' }, encoding: 'utf8' });
    output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    main = mainOf(readFileSync(join(SITE, 'dist/publications.html'), 'utf8'));
  });
  after(() => rmSync(SITE, { recursive: true, force: true }));

  test('is W301 on its first line; the build goes on and the other entries render', () => {
    const line = readFileSync(join(SITE, 'content/publications.bib'), 'utf8').split('\n').indexOf('@article{rook2023broken,') + 1;
    assert.match(output, new RegExp(`content/publications\\.bib:${line}:1 +warning W301 +Couldn't read the entry rook2023broken \\(a comma is missing at the end of line ${line + 1}\\)\\. It's skipped; the rest of the file is fine\\.`));
    assert.deepEqual([...main.matchAll(/<article class="hang" id="([^"]+)"/g)].map((m) => m[1]), ['rook2024driftnet', 'rook2022quay']);
    assert.doesNotMatch(main, /rook2023broken/);
  });
});

describe('the Copy button in Chrome', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;
  let origin = '';
  before(async () => {
    site = await serve(buildFixture('kitchen-sink', 'https://u.github.io/hangfolio'), '/hangfolio');
    origin = new URL(site.home).origin;
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  test('with clipboard access: each button copies exactly the text shown and says so', async () => {
    const ctx = await browser.newContext();
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await ctx.newPage();
    await page.goto(`${site.home}publications`);
    const blocks = page.locator('[data-bibtex]');
    assert.equal(await blocks.count(), 2);
    for (let i = 0; i < 2; i++) {
      const block = blocks.nth(i);
      const button = block.locator('button.copy');
      assert.equal(await button.isVisible(), true);
      await button.click();
      await page.waitForFunction((el) => el.querySelector('[role="status"]')?.textContent !== '', await block.elementHandle());
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(copied, await block.locator('code').textContent());
      assert.equal(copied, await block.locator('pre').innerText());
      assert.equal(await button.locator('.lbl').textContent(), 'Copied');
      assert.equal(await block.locator('[role="status"]').textContent(), 'BibTeX copied to the clipboard');
    }
    await ctx.close();
  });

  test('with clipboard access denied: the text is selected instead, and the live region says so', async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const { targetInfo } = await (await ctx.newCDPSession(page)).send('Target.getTargetInfo');
    const cdp = await browser.newBrowserCDPSession();
    await cdp.send('Browser.setPermission', { permission: { name: 'clipboard-write' }, setting: 'denied', origin, browserContextId: targetInfo.browserContextId });
    await page.goto(`${site.home}publications`);
    const block = page.locator('[data-bibtex]').first();
    await block.locator('button.copy').click();
    await page.waitForFunction(() => document.querySelector('[data-bibtex] [role="status"]')?.textContent !== '');
    assert.equal(await block.locator('[role="status"]').textContent(), 'Could not copy automatically; the BibTeX entry is selected');
    assert.equal(await block.locator('.lbl').textContent(), 'Selected');
    assert.equal(await page.evaluate(() => String(window.getSelection())), await block.locator('code').textContent());
    await ctx.close();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`every piece of text has contrast of at least 4.5:1, the Copy button included (${colorScheme})`, async () => {
      const ctx = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${site.home}publications`);
      assert.equal(await page.locator('button.copy').first().isVisible(), true);
      assert.deepEqual(await page.evaluate(contrastFailures, 4.5), []);
      await ctx.close();
    });
  }

  test('the year hangs in the margin on a wide screen; at 320 and 375 px nothing scrolls sideways', async () => {
    const wide = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    let page = await wide.newPage();
    await page.goto(`${site.home}publications`);
    const year = (await page.locator('#rook2024driftnet > .m').boundingBox())!;
    const title = (await page.locator('#rook2024driftnet-title').boundingBox())!;
    assert.ok(year.x + year.width <= title.x, `the margin note (${year.x}+${year.width}) ends left of the title (${title.x})`);
    await wide.close();
    for (const width of [320, 375]) {
      const narrow = await browser.newContext({ viewport: { width, height: 800 } });
      page = await narrow.newPage();
      await page.goto(`${site.home}publications`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${width}px`);
      await narrow.close();
    }
  });

  test('without the Clipboard API, or without JavaScript, there is no button; the text is still there', async () => {
    const noApi = await browser.newContext();
    await noApi.addInitScript(() => Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined }));
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    for (const ctx of [noApi, noJs]) {
      const page = await ctx.newPage();
      await page.goto(`${site.home}publications`);
      assert.equal(await page.locator('button.copy').first().isVisible(), false);
      assert.match((await page.locator('[data-bibtex] code').first().textContent()) ?? '', /^@inproceedings\{rook2024driftnet,/);
      await ctx.close();
    }
  });
});
