// M3: fixtures/kitchen-sink's home page renders every home component at base / and /hangfolio,
// with every internal link under the base: the hero and availability box, the results strip,
// every kind of featured work item and exhibit, the research section with its featured paper,
// experience with the education lines, news, writing and the contact section. In the installed
// Chrome: the strip's columns, bars drawn to scale, the availability pulse stopping for reduced
// motion, posts two to a row, margin notes hanging on wide screens, no sideways scrolling on a
// phone, and text contrast of at least 4.5:1 in both themes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { listFiles } from '../helpers.ts';
import { contrastFailures } from './contrast.ts';
import { buildFixture, serve } from './fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('hangfolio check finds nothing to report in fixtures/kitchen-sink', () => {
  const result = spawnSync(process.execPath, [BIN, 'check'], { cwd: join(REPO, 'fixtures/kitchen-sink'), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, 'hangfolio check: site.yaml and 14 files in content/\n\nNo errors.\n');
});

for (const pagesUrl of ['https://u.github.io', 'https://u.github.io/hangfolio']) {
  describe(`fixtures/kitchen-sink home page with SITE_PAGES_URL=${pagesUrl}`, () => {
    const base = new URL(pagesUrl).pathname.replace(/\/$/, '');
    let html = '';
    let main = '';
    before(() => {
      const dist = buildFixture('kitchen-sink', pagesUrl);
      html = readFileSync(join(dist, 'index.html'), 'utf8');
      main = html.match(/<main[^>]*>(.*)<\/main>/s)![1];
      assert.ok(listFiles(dist).includes('images/avatar.png'));
    });

    test('every root-relative href and src stays under the base, with no //', () => {
      const refs = [...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
      assert.ok(refs.length > 5);
      for (const ref of refs) {
        assert.ok(!ref.includes('//'), `${ref} contains //`);
        if (base) assert.match(ref, new RegExp(`^${base}(/|$)`), `${ref} escapes ${base}`);
      }
      assert.match(main, new RegExp(`<a href="${base}/files/cv.pdf" class="btn">`));
      assert.match(main, new RegExp(`<a href="${base}/files/driftnet.pdf">Driftnet data</a>`));
      assert.match(main, new RegExp(`<a href="${base}/files/driftnet.pdf">Paper \\(PDF\\)</a>`));
    });

    test('the hero: photo, whoami, tagline, intro, Now line, availability, calls to action and profiles', () => {
      assert.match(main, new RegExp(`<img class="avatar" src="${base}/images/avatar.png" alt="Tamsin Rook, drawn as a sun over two waves" width="72" height="72" fetchpriority="high">`));
      assert.match(main, /<h1 id="name">Tamsin Rook<\/h1><p class="whoami">they\/them · Saltmarsh Bay<\/p>/);
      assert.match(main, /<p class="lede">I build tools that tell you <em>why<\/em> a build is slow, not just that it is\.<\/p>/);
      assert.match(main, /<p class="now"><span class="strong">Now:<\/span> a tracing layer for build caches, and a paper on <code>fsync<\/code> batching\.<\/p>/);
      assert.match(main, /<p class="status box"><span class="dot" aria-hidden="true"><\/span><span><strong>Open to systems research internships · Summer 2027\.<\/strong> <span class="muted">Back to the PhD in the autumn\.<\/span><\/span><\/p>/);
      assert.match(main, /<span>Résumé<\/span><span class="pdf">PDF<\/span><\/a><a href="mailto:tamsin@rook\.test\?subject=Summer%202027%20internship">Email<\/a><a href="https:\/\/example\.org\/book\/tamsin">Book a call<\/a>/);
      const profiles = [...main.matchAll(/<li><a class="soft" href="([^"]+)">([^<]+)<svg class="ext"/g)].map((m) => `${m[2]} ${m[1]}`);
      assert.deepEqual(profiles, ['GitHub https://github.com/hangfolio/hangfolio', 'Notes https://hangfolio.github.io/', 'Bluesky https://bsky.app/profile/rook.test']);
    });

    test('the results strip: four items, prefix and arrow spans, sources', () => {
      assert.match(main, /<section class="block tight-gap" aria-labelledby="results" data-section="highlights"><div class="sec-head"><h2 id="results" class="eyebrow">Results at a glance<\/h2><\/div><ul class="proof" style="--cols: 4">/);
      assert.equal([...main.matchAll(/<span class="big/g)].length, 4);
      assert.match(main, /<span class="big nowrap"><span class="pre">up to <\/span>62%<\/span>/);
      assert.match(main, /<span class="big nowrap">9 min<span class="arrow"> → <\/span>70s<\/span>/);
      assert.match(main, /<span class="src">src · <a href="#work">Shoal<\/a>, in preparation<\/span>/);
    });

    test('selected work: the featured projects in home.order, each with its exhibit; others left out', () => {
      const titles = [...main.matchAll(/<li class="hang featured"><div class="m"><span class="n">(\d+)<\/span>.*?<h3>([^<]+)<\/h3>/g)].map((m) => `${m[1]} ${m[2]}`);
      assert.deepEqual(titles, ['01 Shoal', '02 Batched fsync', '03 Driftnet', '04 Quay']);
      assert.doesNotMatch(main, /Kelp/);
      assert.match(main, /<span class="range"><span>Feb 2025<\/span> <span>– present<\/span><\/span>/);
      assert.match(main, /<span class="n">02<\/span><span>In prep\.<\/span>/);
      assert.match(main, /<span class="range"><span>Jun<\/span> <span>– Sep 2023<\/span><\/span>/);
      assert.match(main, /<span class="range"><span>2021<\/span> <span>– 2022<\/span><\/span>/);
      assert.match(main, /<div class="well terminal" role="group" aria-label="Sample Shoal output">/);
      for (const level of ['critical', 'high', 'medium', 'low']) assert.match(main, new RegExp(`<span class="sev ${level}">\\[${level.toUpperCase()}\\]</span>`));
      assert.match(main, /<div class="well metrics" role="group" aria-label="ablation">/);
      assert.match(main, /<div class="links mono faint"><span>In preparation for a 2027 venue<\/span><span>No public link yet<\/span><\/div>/);
      assert.match(main, /<div class="bar-rows" role="img" aria-label="Stale hits per million lookups: Default 412, Pinned 139, Hashed 6" style="--label: 7ch; --value: 3ch">/);
      assert.deepEqual([...main.matchAll(/style="width: ([\d.]+%)"/g)].map((m) => m[1]), ['100%', '33.7%', '1.5%']);
      assert.match(main, /<div class="well terminal install" role="group" aria-label="Install">/);
      assert.match(main, /<a href="https:\/\/hangfolio\.github\.io\/">Write-up<\/a><code class="inline-code">cargo install shoal<\/code>/);
    });

    test('the sections in their default order, with the ids from advanced.anchors', () => {
      const ids = [...main.matchAll(/<section (?:id="[^"]+" )?class="block[^"]*" aria-labelledby="([^"]+)" data-section="([^"]+)"/g)].map((m) => `${m[2]}:${m[1]}`);
      assert.deepEqual(ids, ['highlights:results', 'work:work', 'research:research-h', 'experience:exp', 'news:news', 'writing:writing', 'contact:contact']);
      assert.match(html, new RegExp(`<a href="${base}/#research" class="quiet"[^>]*>Research</a><a href="${base}/files/cv.pdf" class="quiet"[^>]*>CV</a>`));
    });

    test('research: the section carries the anchor, the paper is #publication, the owner is underlined', () => {
      assert.match(main, /<section id="research" class="block" aria-labelledby="research-h" data-section="research"><div class="sec-head"><h2 id="research-h" class="eyebrow">Research<\/h2><a href="https:\/\/hangfolio\.github\.io\/">All notes<\/a><\/div>/);
      const labels = [...main.matchAll(/<div class="m label">([^<]+)<\/div>/g)].map((m) => m[1]);
      assert.deepEqual(labels, ['Problem', 'Approach', 'Status', 'Teaching', 'Education']);
      assert.deepEqual([...main.matchAll(/<span class="num">(\d+)<\/span>/g)].map((m) => m[1]), ['01', '02', '03']);
      assert.match(main, /<h3>Cache-miss tracing<\/h3><span class="chip">Shoal · Rust<\/span>/);
      assert.match(main, new RegExp(`serve <a href="${base}/files/driftnet.pdf">stale artifacts</a>`));
      assert.match(
        main,
        /<div class="hang pub" id="publication"><div class="m"><span>2024<\/span><\/div><div class="pub-body"><h3 class="eyebrow faint">Publication<\/h3><p>Adaeze Okonkwo\*, <span class="me">Tamsin Rook<\/span>\*, Björn Lindqvist, Ilse Marrow\. <span class="ptitle">“Driftnet: How Often Do Remote Build Caches Serve Stale Artifacts\?”<\/span> <em class="venue">The Example Symposium on Build Systems \(EXSB ’24\)<\/em>, Kestrel Harbour\. <span class="note">\*Co-first authors<\/span><\/p>/,
      );
      const links = [...main.matchAll(/<div class="links mono">(.*?)<\/div>/g)].at(-1)![1];
      assert.equal(
        links,
        `<a href="${base}/files/driftnet.pdf">[PDF]</a><a href="https://doi.org/10.5555/exsb24.0042">[DOI]</a><a href="https://github.com/hangfolio/hangfolio">[Code]</a>` +
          '<a href="https://example.org/driftnet">[Dataset]</a><a href="https://hangfolio.github.io/">[Talk notes]</a>',
      );
      assert.match(main, /<div class="m label">Teaching<\/div><p class="small-text">TA, Operating Systems \(Fall 2024\) and Compilers \(Spring 2025\)\.<\/p>/);
    });

    test('experience: the first four entries with a home line, then the education lines under #education', () => {
      const jobs = [...main.matchAll(/<h3>([^<]+) <span class="org">· ([^<]+)<\/span><\/h3>/g)].map((m) => `${m[1]} · ${m[2]}`);
      assert.deepEqual(jobs, ['Graduate Research Assistant · Example Studies', 'Teaching Assistant · Institute of Example Studies', 'Software Engineering Intern · Lantern Example Co.', 'Build Engineer · Example Systems']);
      assert.match(main, /<div class="m"><span><span class="nowrap">Fall 2024,<\/span> <span class="nowrap">Spring 2025<\/span><\/span><\/div>/);
      assert.match(main, /<span class="range"><span>Jun<\/span> <span>– Aug 2024<\/span><\/span>/);
      assert.doesNotMatch(main, /Freelance|Small web tools/);
      assert.match(main, /<\/ol><div class="hang edu" id="education"><div class="m label">Education<\/div><ul class="edu-lines">/);
      const lines = [...main.matchAll(/<li><span>([^<]+)<\/span><span class="yr">([^<]+)<\/span><\/li>/g)].map((m) => `${m[1]} | ${m[2]}`);
      assert.deepEqual(lines, [
        'PhD, Computer Systems, Institute of Example Studies | 2023 – 2028 (expected)',
        'BSc, Computer Science, Example Polytechnic | 2017 – 2021',
        'Example Systems Summer School, one of 40 participants | 2025',
      ]);
    });

    test('news, writing and contact: four news items, the two newest posts, the address and links', () => {
      const months = [...main.matchAll(/<time datetime="([\d-]+)">([A-Z][a-z]+ \d{4})<\/time>/g)].map((m) => `${m[1]} ${m[2]}`);
      assert.deepEqual(months, ['2026-09-14 Sep 2026', '2026-06 Jun 2026', '2025-07 Jul 2025', '2024-05 May 2024']);
      assert.match(main, new RegExp(`<p>Wrote up <a href="${base}/writing/cache-lied/">why our build cache lied to us</a>.</p>`));
      assert.match(
        main,
        new RegExp(
          `<ul class="posts"><li><time datetime="2026-09-14">Sep 14, 2026</time><a href="${base}/writing/cache-lied/">Why our build cache lied to us</a></li>` +
            `<li><time datetime="2025-11-02">Nov 2, 2025</time><a href="${base}/writing/bottom-up/">Reading a build log from the bottom up</a></li></ul>`,
        ),
      );
      assert.doesNotMatch(main, /hermetic toolchains|tracing every build action/);
      assert.match(
        main,
        new RegExp(
          '<section class="block contact" aria-labelledby="contact" data-section="contact"><div class="sec-head"><h2 id="contact" class="eyebrow">Get in touch</h2></div>' +
            '<a href="mailto:tamsin@rook\\.test\\?subject=Summer%202027%20internship" class="mail">tamsin@rook\\.test</a>' +
            `<div class="links"><a href="${base}/files/cv.pdf">Résumé \\(PDF\\)</a><a href="https://example\\.org/book/tamsin">Book a call</a></div></section>`,
        ),
      );
    });
  });
}

describe('the kitchen-sink home page in Chrome', { skip: !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH` }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;

  async function open(options: { width?: number; colorScheme?: 'light' | 'dark'; reducedMotion?: 'reduce' | 'no-preference' } = {}) {
    const { width = 1280, colorScheme = 'light', reducedMotion = 'no-preference' } = options;
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion });
    const page = await ctx.newPage();
    await page.goto(site.home);
    return { ctx, page };
  }

  before(async () => {
    site = await serve(buildFixture('kitchen-sink', 'https://u.github.io/hangfolio'), '/hangfolio');
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  const tops = (page: Page) => page.$$eval('.proof > li', (items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));

  test('the results share one row from 900px and stack on a phone', async () => {
    const wide = await open({ width: 1280 });
    assert.equal(new Set(await tops(wide.page)).size, 1);
    await wide.ctx.close();

    const phone = await open({ width: 375 });
    const stacked = await tops(phone.page);
    assert.deepEqual([...stacked].sort((a, b) => a - b), stacked);
    assert.equal(new Set(stacked).size, 4);
    await phone.ctx.close();
  });

  test('bars are drawn to scale', async () => {
    const { ctx, page } = await open();
    const ratios = await page.$$eval('.bar-row', (rows) =>
      rows.map((row) => row.querySelector('.fill')!.getBoundingClientRect().width / row.querySelector('.track')!.getBoundingClientRect().width),
    );
    assert.deepEqual(ratios.map((r) => Math.round(r * 1000) / 10), [100, 33.7, 1.5]);
    await ctx.close();
  });

  test('the availability dot pulses, and stops for visitors who ask for reduced motion', async () => {
    const animation = (page: Page) => page.$eval('.status.box .dot', (dot) => getComputedStyle(dot).animationName);
    const moving = await open({ reducedMotion: 'no-preference' });
    assert.equal(await animation(moving.page), 'ping');
    await moving.ctx.close();
    const still = await open({ reducedMotion: 'reduce' });
    assert.equal(await animation(still.page), 'none');
    await still.ctx.close();
  });

  test('on wide screens the photo hangs in the margin; on a phone nothing scrolls sideways', async () => {
    const wide = await open({ width: 1440 });
    const [avatar, lede] = await wide.page.$$eval('.hero .avatar, .hero .lede', (els) => els.map((el) => el.getBoundingClientRect().left));
    assert.ok(avatar < lede - 90, `avatar at ${avatar}, text at ${lede}`);
    await wide.ctx.close();

    const phone = await open({ width: 375 });
    assert.ok(await phone.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await phone.ctx.close();
  });

  test('posts sit two to a row with room for them, and stack on a phone', async () => {
    const postTops = (page: Page) => page.$$eval('.posts > li', (items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    const wide = await open({ width: 1280 });
    assert.equal(new Set(await postTops(wide.page)).size, 1);
    await wide.ctx.close();
    const phone = await open({ width: 375 });
    assert.equal(new Set(await postTops(phone.page)).size, 2);
    await phone.ctx.close();
  });

  test('on wide screens the margin notes hang left of the text; on a phone they sit above it', async () => {
    const lefts = (page: Page) =>
      page.$$eval('#research .hang > .m.label, .jobs .hang > .m, .news .hang > .m, #education > .m', (notes) =>
        notes.map((note) => note.getBoundingClientRect().right - note.nextElementSibling!.getBoundingClientRect().left),
      );
    const wide = await open({ width: 1440 });
    for (const gap of await lefts(wide.page)) assert.ok(gap <= -30, `margin note ends ${gap}px from its text`);
    await wide.ctx.close();
    const phone = await open({ width: 375 });
    const tops = await phone.page.$$eval('.jobs .hang', (items) => items.map((item) => item.querySelector('.m')!.getBoundingClientRect().bottom <= item.lastElementChild!.getBoundingClientRect().top + 1));
    assert.ok(tops.every(Boolean));
    await phone.ctx.close();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`every piece of text has contrast of at least 4.5:1 (${colorScheme})`, async () => {
      const { ctx, page } = await open({ colorScheme, reducedMotion: 'reduce' });
      const failures = await page.evaluate(contrastFailures, 4.5);
      assert.deepEqual(failures, []);
      await ctx.close();
    });
  }
});
