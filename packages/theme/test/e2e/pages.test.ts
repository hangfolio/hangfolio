// M4: the interior pages. fixtures/kitchen-sink and fixtures/owner-like build at base / and
// /hangfolio in both URL formats (advanced.urlFormat preserve and directory) with exactly the
// expected files, every internal link under the base and every canonical at its page's address;
// the redirect files are written exactly. Then each page's content, pages turned off and moved, a
// paused booking, and, in the installed Chrome: no sideways scrolling, text contrast in both
// themes, the contact page's still status dot, the photo gallery's columns, and the Cal.com
// calendar reloading only when the visitor clicks the theme toggle.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { listFiles } from '../helpers.ts';
import { contrastFailures } from './contrast.ts';
import { buildSite, serve } from './fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const noChrome = !existsSync(CHROME) && `Chrome not found at ${CHROME}; set CHROME_PATH`;

const copies: string[] = [];
after(() => copies.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** Copies a site into .tmp/<name> (inside the workspace, so it finds hangfolio), with site.yaml edited. */
function copySite(from: string, name: string, edit: (yaml: string) => string = (yaml) => yaml): string {
  const dir = join(REPO, '.tmp', name);
  rmSync(dir, { recursive: true, force: true });
  copies.push(dir);
  for (const entry of ['site.yaml', 'content', 'public', 'astro.config.mjs', 'src', 'package.json']) {
    if (existsSync(join(REPO, from, entry))) cpSync(join(REPO, from, entry), join(dir, entry), { recursive: true });
  }
  writeFileSync(join(dir, 'site.yaml'), edit(readFileSync(join(dir, 'site.yaml'), 'utf8')));
  return dir;
}

const htmlFiles = (dist: string) => listFiles(dist).filter((file) => file.endsWith('.html'));
const canonicalOf = (html: string) => html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
const mainOf = (html: string) => html.match(/<main[^>]*>(.*)<\/main>/s)![1].replace(/ data-astro-cid-\w+/g, '');

// The pages each fixture writes, in each URL format (sorted, as listFiles gives them).
const KITCHEN_SINK = {
  preserve: [
    '404.html', 'contact.html', 'experience.html', 'index.html', 'meet.html', 'projects.html', 'projects/shoal/index.html',
    'writing/bottom-up/index.html', 'writing/cache-lied/index.html', 'writing/index.html', 'writing/reading-traces/index.html', 'writing/tracing-overhead/index.html',
  ],
  directory: [
    '404.html', 'contact/index.html', 'experience/index.html', 'index.html', 'meet/index.html', 'projects/index.html', 'projects/shoal/index.html',
    'writing/bottom-up/index.html', 'writing/cache-lied/index.html', 'writing/index.html', 'writing/reading-traces/index.html', 'writing/tracing-overhead/index.html',
  ],
};
const OWNER_LIKE = {
  preserve: [
    '404.html', 'about.html', 'about/index.html', 'contact.html', 'index.html', 'meet.html', 'projects.html', 'work-experience.html',
    'writing/idle-radio-drain/index.html', 'writing/index.html', 'writing/pondskip-flaky-tests/index.html',
  ],
  directory: [
    '404.html', 'about.html', 'about/index.html', 'contact/index.html', 'index.html', 'meet/index.html', 'projects/index.html', 'work-experience/index.html',
    'writing/idle-radio-drain/index.html', 'writing/index.html', 'writing/pondskip-flaky-tests/index.html',
  ],
};

/** The address a page file is served at, as its canonical names it: projects.html is /projects, writing/index.html /writing/. */
const addressOf = (file: string) => file.replace(/index\.html$/, '').replace(/\.html$/, '');

for (const [fixture, expected] of [['kitchen-sink', KITCHEN_SINK], ['owner-like', OWNER_LIKE]] as const) {
  for (const format of ['preserve', 'directory'] as const) {
    for (const pagesUrl of ['https://u.github.io', 'https://u.github.io/hangfolio']) {
      describe(`fixtures/${fixture} pages, urlFormat ${format}, SITE_PAGES_URL=${pagesUrl}`, () => {
        const base = new URL(pagesUrl).pathname.replace(/\/$/, '');
        let dist = '';
        const read = (file: string) => readFileSync(join(dist, file), 'utf8');
        before(() => {
          const dir =
            format === 'preserve'
              ? join('fixtures', fixture)
              : copySite(join('fixtures', fixture), `pages-${fixture}-directory`, (yaml) =>
                  yaml.includes('\nadvanced:\n') ? yaml.replace('\nadvanced:\n', '\nadvanced:\n  urlFormat: "directory"\n') : `${yaml}advanced: { urlFormat: "directory" }\n`,
                ).slice(REPO.length);
          dist = buildSite(dir, pagesUrl);
        });

        test('writes exactly the expected pages', () => {
          assert.deepEqual(htmlFiles(dist), expected[format]);
        });

        test('every root-relative href and src stays under the base, with no //; every canonical is the page address', () => {
          for (const file of htmlFiles(dist)) {
            const html = read(file);
            for (const [, ref] of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
              assert.ok(!ref.includes('//'), `${file}: ${ref} contains //`);
              if (base) assert.match(ref, new RegExp(`^${base}(/|$)`), `${file}: ${ref} escapes ${base}`);
            }
            if (file === '404.html' || /^about/.test(file)) continue;
            assert.equal(canonicalOf(html), `${pagesUrl}/${addressOf(file)}`, file);
          }
        });

        if (fixture === 'owner-like') {
          test('the redirects are written exactly, with a base-aware refresh and canonical, and are never indexed', () => {
            for (const file of ['about.html', 'about/index.html']) {
              assert.equal(
                read(file),
                '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>' +
                  `<link rel="canonical" href="${pagesUrl}/"><meta name="robots" content="noindex">` +
                  `<meta http-equiv="refresh" content="0; url=${base}/"></head>` +
                  `<body><p>This page has moved to <a href="${base}/">${pagesUrl}/</a>.</p></body></html>`,
              );
            }
          });
        }
      });
    }
  }
}

describe('fixtures/kitchen-sink: what each interior page shows (base /hangfolio)', () => {
  const base = '/hangfolio';
  let dist = '';
  const page = (file: string) => readFileSync(join(dist, file), 'utf8');
  before(() => {
    dist = buildSite('fixtures/kitchen-sink', 'https://u.github.io/hangfolio');
  });

  test('projects: groups in projects.yaml order with their ids and links, jump links, one numbering, compact lists', () => {
    const main = mainOf(page('projects.html'));
    assert.match(main, /<nav class="jump" aria-label="Project groups"><ul class="links mono"><li><a href="#developer-tools">Developer tools<\/a><\/li><li><a href="#research-artifacts">Research<\/a><\/li><li><a href="#libraries">Libraries<\/a><\/li><\/ul><\/nav><\/header>/);
    const groups = [...main.matchAll(/<section id="([^"]+)" class="group" aria-labelledby="([^"]+)"><div class="sec-head"><h2 id="([^"]+)" class="eyebrow">([^<]+)<\/h2>(?:<a href="([^"]+)">([^<]+)<\/a>)?<\/div>/g)].map((m) => m.slice(1).join(' | '));
    assert.deepEqual(groups, [
      'developer-tools | developer-tools-h | developer-tools-h | Developer tools | https://github.com/hangfolio/hangfolio | GitHub',
      'research-artifacts | artifacts-h | artifacts-h | Research | https://hangfolio.github.io/ | All notes',
      'libraries | libraries-h | libraries-h | Libraries |  | ',
    ]);
    const items = [...main.matchAll(/<li class="hang (full|compact)"><div class="m"><span class="n">(\d+)<\/span>.*?<h3>([^<]+)<\/h3>/g)].map((m) => `${m[2]} ${m[3]} (${m[1]})`);
    assert.deepEqual(items, ['01 Quay (full)', '02 Shoal (full)', '03 Driftnet (full)', '04 Kelp (compact)']);
    assert.deepEqual([...main.matchAll(/<ol class="([^"]+)"( start="\d+")?>/g)].map((m) => m[1] + (m[2] ?? '')), ['works', 'works start="3"', 'works compact start="4"']);
    assert.doesNotMatch(main, /Batched fsync|Tern/, 'a project with listed: false stays off /projects');
    assert.match(main, /<dl class="facts">.*<dt>Problem<\/dt>.*<div class="well terminal" role="group" aria-label="Install Shoal from source">/s);
    assert.match(main, new RegExp(`<div class="links"><a href="${base}/projects/shoal/">Case study</a><a href="https://github.com/hangfolio/hangfolio">Code</a>`));
  });

  test('a project page: back link, title, summary, kicker and dates, the body and the links', () => {
    const html = page('projects/shoal/index.html');
    const main = mainOf(html);
    assert.match(html, /<title>Shoal — Tamsin Rook<\/title>/);
    assert.match(html, /<meta name="description" content="Traces every cache miss in a build back to the input that caused it, so a slow build explains itself\.">/);
    assert.match(main, new RegExp(`^<header class="page-head"><p class="eyebrow back"><a href="${base}/projects" class="soft">Projects</a></p><h1>Shoal</h1>`));
    assert.match(main, /<p class="meta"><span>Build tracer · Rust<\/span><span aria-hidden="true"> · <\/span><span class="range"><span>Feb 2025<\/span> <span>– present<\/span><\/span><\/p>/);
    assert.match(main, /<article class="prose post"><p>Shoal records which inputs each build action read/);
    assert.match(html, new RegExp(`<a href="${base}/projects" class="quiet" aria-current="page"`));
  });

  test('experience: the sections in order with their ids, the margin, programs with education, photos, earlier as paragraphs', () => {
    const main = mainOf(page('experience.html'));
    const sections = [...main.matchAll(/<section class="block" aria-labelledby="([^"]+)"><div class="sec-head"><h2 id="\1" class="eyebrow">([^<]+)<\/h2><\/div>/g)].map((m) => `${m[1]}: ${m[2]}`);
    assert.deepEqual(sections, ['professional: Professional experience', 'research-experience: Research experience', 'teaching: Teaching experience', 'education: Education &amp; programs', 'earlier: Earlier experience']);
    assert.match(main, new RegExp(`<div class="links"><a href="${base}/files/cv.pdf">Résumé \\(PDF\\)</a><a href="mailto:tamsin@rook.test">Email</a></div></header>`));
    assert.match(main, /<div class="m"><span class="range"><span>Sep 2023<\/span> <span>– May 2028<\/span> <span>\(expected\)<\/span><\/span><\/div>/);
    assert.match(main, /<div class="m"><span class="range"><span>Jul 2025<\/span><\/span><span class="where">Kestrel Harbour<\/span><\/div>/);
    assert.match(main, new RegExp(`<figure class="gallery"><div class="shots"><a href="${base}/images/summer-school/hall.png"><img src="${base}/images/summer-school/hall-thumb.png" alt="The lecture hall, drawn as rows of seats facing a screen" width="240" height="320" loading="lazy" decoding="async"></a>`));
    assert.match(main, /<figcaption>Example Systems Summer School, <em>Kestrel Harbour<\/em><\/figcaption>/);
    assert.match(main, /<h3>Freelance developer <span class="org">· Self-employed<\/span><\/h3><p class="desc">Small web tools for local businesses\.<\/p>/);
  });

  test('writing: published posts newest first, with date, excerpt and reading time (or its pin); drafts left out', () => {
    const main = mainOf(page('writing/index.html'));
    const posts = [...main.matchAll(/<time datetime="([\d-]+)">[^<]+<\/time><\/div><article><h2><a href="([^"]+)">([^<]+)<\/a><\/h2><p>[^<]*<\/p><p class="meta">([^<]+)<\/p>/g)].map((m) => `${m[1]} ${m[2]} ${m[4]}`);
    assert.deepEqual(posts, [
      `2026-09-14 ${base}/writing/cache-lied/ 1 min read`,
      `2025-11-02 ${base}/writing/bottom-up/ 1 min read`,
      `2024-03-20 ${base}/writing/tracing-overhead/ 1 min read`,
      `2023-02-10 ${base}/writing/reading-traces/ 4 min read`,
    ]);
    assert.doesNotMatch(main, /hermetic toolchains/);
  });

  test('a post: dates, reading time, <Note> and <Terminal> without imports, pinned anchors, the byline and JSON-LD', () => {
    const html = page('writing/reading-traces/index.html');
    const main = mainOf(html);
    assert.match(main, /<p class="meta"><time datetime="2023-02-10">Feb 10, 2023<\/time><span> · updated <time datetime="2023-03-01">Mar 1, 2023<\/time><\/span><span> · 4 min read<\/span><\/p>/);
    assert.match(main, /<aside class="note"><p class="eyebrow">Note<\/p><div class="note-body">.*Traces are written next to the build log/s);
    assert.match(main, /<aside class="note"><p class="eyebrow">Tip<\/p>/);
    assert.match(main, /<div class="well terminal" role="group" aria-label="A short trace">.*<span class="sev high">\[HIGH\]<\/span> CI_RUN_ID leaks into the cache key/s);
    assert.match(main, /<h2 id="architecture">How it works<\/h2>/);
    assert.match(main, new RegExp(`<footer class="post-foot"><p>Written by Tamsin Rook, PhD candidate in Computer Systems at Institute of Example Studies\\. Questions or corrections: <a href="mailto:tamsin@rook.test">tamsin@rook.test</a>\\.</p><p><a href="${base}/writing/">← All writing</a></p></footer>`));
    assert.match(html, /<meta property="og:type" content="article">/);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])['@graph'];
    const article = graph.find((node: { '@type': string }) => node['@type'] === 'BlogPosting');
    assert.equal(article['@id'], 'https://u.github.io/hangfolio/writing/reading-traces/#article');
    assert.equal(article.dateModified, '2023-03-01');
    assert.deepEqual(article.author, { '@id': 'https://u.github.io/hangfolio/#person' });
  });

  test('contact: the address with the availability subject, the rows, and the status line; ContactPage JSON-LD', () => {
    const html = page('contact.html');
    const main = mainOf(html);
    assert.match(main, /<h1>Contact<\/h1><a href="mailto:tamsin@rook\.test\?subject=Summer%202027%20internship" class="mail">tamsin@rook\.test<\/a><\/header>/);
    const rows = [...main.matchAll(/<dt class="m label">([^<]+)<\/dt><dd>(?:<a href="([^"]+)">)?([^<]+)/g)].map((m) => `${m[1]}: ${m[3]}${m[2] ? ` → ${m[2]}` : ''}`);
    assert.deepEqual(rows, [
      'Location: Saltmarsh Bay',
      'GitHub: github.com/hangfolio/hangfolio → https://github.com/hangfolio/hangfolio',
      'Notes: hangfolio.github.io → https://hangfolio.github.io/',
      'Bluesky: bsky.app/profile/rook.test → https://bsky.app/profile/rook.test',
      'Lab list: lab@rook.test → mailto:lab@rook.test',
      `Book a call: Pick a time → ${base}/meet`,
    ]);
    assert.match(main, /<p class="status rule"><span class="dot" aria-hidden="true"><\/span><span>I'm looking for a <strong>Summer 2027<\/strong> internship in systems research, then returning to my PhD\.<\/span><\/p>/);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])['@graph'];
    assert.deepEqual(graph.at(-1), {
      '@type': 'ContactPage',
      '@id': 'https://u.github.io/hangfolio/contact#webpage',
      url: 'https://u.github.io/hangfolio/contact',
      name: 'Contact — Tamsin Rook',
      isPartOf: { '@id': 'https://u.github.io/hangfolio/#website' },
      about: { '@id': 'https://u.github.io/hangfolio/#person' },
    });
  });

  test('booking in link mode: a button out to the booking page and no third-party script', () => {
    const html = page('meet.html');
    const main = mainOf(html);
    assert.match(main, /<h1>Book a call<\/h1><\/header><section class="booking" aria-label="Booking"><p><a class="btn" href="https:\/\/example\.org\/book\/tamsin">Book a call<svg class="ext"/);
    assert.match(main, /Booking is on example\.org\. Or email <a href="mailto:tamsin@rook\.test\?subject=Meeting%20request">tamsin@rook\.test<\/a>\./);
    assert.doesNotMatch(html, /cal\.com/);
  });

  test('404: base-aware links to home, projects, writing and the CV', () => {
    const main = mainOf(page('404.html'));
    const links = [...main.matchAll(/<li><a href="([^"]+)">([^<]+)<\/a><\/li>/g)].map((m) => `${m[2]} ${m[1]}`);
    assert.deepEqual(links, [`Home ${base}/`, `Projects ${base}/projects`, `Writing ${base}/writing/`, `Résumé (PDF) ${base}/files/cv.pdf`]);
  });
});

describe('fixtures/owner-like: the reference design’s paths and ids', () => {
  let dist = '';
  const page = (file: string) => readFileSync(join(dist, file), 'utf8');
  before(() => {
    dist = buildSite('fixtures/owner-like', 'https://u.github.io');
  });

  test('experience at /work-experience, linked from the home page; the research group keeps the heading id research-h', () => {
    assert.match(page('index.html'), /<a href="\/work-experience">Full history<\/a>/);
    assert.equal(canonicalOf(page('work-experience.html')), 'https://u.github.io/work-experience');
    assert.match(page('work-experience.html'), /<title>Work Experience \| Kasia Morrow<\/title>/);
    assert.match(mainOf(page('work-experience.html')), /<h1>Work Experience<\/h1><p class="lede">Engineering and research work at Northlake/);
    assert.match(mainOf(page('projects.html')), /<section id="research" class="group" aria-labelledby="research-h"><div class="sec-head"><h2 id="research-h" class="eyebrow">Research<\/h2>/);
  });

  test('the nav as site.yaml orders it, booking to the booking page, and Contact in the footer', () => {
    const html = page('contact.html');
    const nav = [...html.matchAll(/<a href="([^"]+)" class="quiet"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`);
    assert.deepEqual(nav, ['Research /#research', 'Projects /projects', 'Writing /writing/', 'CV /files/cv.pdf', 'Book a 1:1 /meet']);
    assert.match(html, /<nav aria-label="Elsewhere" class="row"[^>]*>.*<a href="\/contact"[^>]*>Contact<\/a><\/nav>/);
  });
});

describe('pages turned off and moved, a paused booking, redirects public/ already has, and a homepage-only project page', () => {
  let dist = '';
  const page = (file: string) => readFileSync(join(dist, file), 'utf8');
  before(() => {
    const dir = copySite('fixtures/minimal', 'pages-switches', (yaml) =>
      yaml +
        'booking: { keepPageWhenOff: true, path: "/book" }\n' +
        'pages:\n' +
        '  writing: false\n' +
        '  contact: { path: "/about-me/", heading: "Say hello", title: "Hello", lede: "Email is *best*." }\n' +
        '  notFound: false\n' +
        'redirects:\n' +
        '  - { from: "/old-notes/", to: "https://example.org/notes" }\n' +
        '  - { from: "/cv", to: "/files/cv.pdf" }\n' +
        '  - { from: "/legacy.html", to: "/" }\n',
    );
    writeFileSync(join(dir, 'public/legacy.html'), '<p>kept from public/</p>\n');
    mkdirSync(join(dir, 'content/projects'), { recursive: true });
    writeFileSync(join(dir, 'content/projects/weir.md'), '---\ntitle: "Weir"\nsummary: "A homepage-only project."\nlisted: false\n---\nHow the weir was built.\n');
    dist = buildSite(dir.slice(REPO.length), 'https://u.github.io/hangfolio');
  });

  test('writes the moved contact page, the paused booking page and the redirects; no writing pages and no 404', () => {
    assert.deepEqual(htmlFiles(dist), ['about-me/index.html', 'book.html', 'cv.html', 'index.html', 'legacy.html', 'old-notes/index.html', 'projects/weir/index.html']);
    assert.equal(page('legacy.html'), '<p>kept from public/</p>\n');
    assert.match(page('old-notes/index.html'), /<meta http-equiv="refresh" content="0; url=https:\/\/example\.org\/notes">/);
    assert.match(page('cv.html'), /<link rel="canonical" href="https:\/\/u\.github\.io\/hangfolio\/files\/cv\.pdf"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=\/hangfolio\/files\/cv\.pdf">/);
  });

  test('the overrides show: path, title, heading and lede; the nav and footer follow', () => {
    const html = page('about-me/index.html');
    assert.match(html, /<title>Hello — Wren Halloway<\/title>/);
    assert.equal(canonicalOf(html), 'https://u.github.io/hangfolio/about-me/');
    assert.match(mainOf(html), /<h1>Say hello<\/h1><p class="lede">Email is <em>best<\/em>\.<\/p>/);
    const home = page('index.html');
    const nav = [...home.matchAll(/<a href="([^"]+)" class="quiet"[^>]*>([^<]+)<\/a>/g)].map((m) => `${m[2]} ${m[1]}`);
    assert.deepEqual(nav, ['CV /hangfolio/files/cv.pdf', 'Contact /hangfolio/about-me/']);
    assert.doesNotMatch(home, /first-note|data-section="writing"/);
  });

  test('a project with a body but listed: false gets its page, with no back link to a /projects that was not built', () => {
    const main = mainOf(page('projects/weir/index.html'));
    assert.match(main, /^<header class="page-head"><h1>Weir<\/h1><p class="lede">A homepage-only project\.<\/p><\/header>/);
    assert.doesNotMatch(main, /href="\/hangfolio\/projects"/);
  });

  test('a paused booking keeps its page, pointing to email, with no calls to action or nav item', () => {
    const main = mainOf(page('book.html'));
    assert.match(main, /<h1>Book a 1:1<\/h1><\/header><p>Online booking isn’t open right now\. Email me at <a href="mailto:wren@halloway\.test\?subject=Meeting%20request">wren@halloway\.test<\/a> and we’ll find a time\.<\/p>/);
    assert.doesNotMatch(page('index.html'), /Book a 1:1|\/book"/);
    assert.doesNotMatch(page('about-me/index.html'), /Book a call/);
  });
});

describe('the interior pages in Chrome', { skip: noChrome }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;
  let paths: string[] = [];

  async function open(path: string, options: { width?: number; colorScheme?: 'light' | 'dark'; reducedMotion?: 'reduce' | 'no-preference' } = {}) {
    const { width = 1280, colorScheme = 'light', reducedMotion = 'no-preference' } = options;
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion });
    const page = await ctx.newPage();
    await page.goto(site.home + path);
    await page.evaluate(() => document.fonts.ready);
    return { ctx, page };
  }

  before(async () => {
    const dist = buildSite('fixtures/kitchen-sink', 'https://u.github.io/hangfolio');
    paths = htmlFiles(dist)
      .filter((file) => file !== 'index.html')
      .map((file) => file.replace(/index\.html$/, '').replace(/\.html$/, ''));
    site = await serve(dist, '/hangfolio');
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  for (const width of [320, 375]) {
    test(`nothing scrolls sideways at ${width}px on any interior page`, async () => {
      const { ctx, page } = await open('', { width });
      const wide: string[] = [];
      for (const path of paths) {
        await page.goto(site.home + path);
        if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) wide.push(path);
      }
      await ctx.close();
      assert.deepEqual(wide, []);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`every piece of text has contrast of at least 4.5:1 on every interior page (${colorScheme})`, async () => {
      const { ctx, page } = await open('', { colorScheme, reducedMotion: 'reduce' });
      const failures: string[] = [];
      for (const path of paths) {
        await page.goto(site.home + path);
        failures.push(...(await page.evaluate(contrastFailures, 4.5)).map((failure) => `/${path}: ${failure}`));
      }
      await ctx.close();
      assert.deepEqual(failures, []);
    });
  }

  test("the contact page's status dot holds still, as on the reference design (only the home page's pulses)", async () => {
    const animation = (page: Page, selector: string) => page.$eval(selector, (dot) => getComputedStyle(dot).animationName);
    const contact = await open('contact');
    assert.equal(await animation(contact.page, '.status.rule .dot'), 'none');
    await contact.ctx.close();
    const home = await open('');
    assert.equal(await animation(home.page, '.status.box .dot'), 'ping');
    await home.ctx.close();
  });

  test('photos sit two to a row, one under 540px; dates and places hang in the margin on wide screens', async () => {
    const tops = (page: Page) => page.$$eval('.gallery .shots > a', (shots) => shots.map((shot) => Math.round(shot.getBoundingClientRect().top)));
    const wide = await open('experience', { width: 1440 });
    assert.equal(new Set(await tops(wide.page)).size, 1);
    const gaps = await wide.page.$$eval('.roles .hang > .m', (notes) => notes.map((note) => note.getBoundingClientRect().right - note.nextElementSibling!.getBoundingClientRect().left));
    for (const gap of gaps) assert.ok(gap <= -30, `margin note ends ${gap}px from its text`);
    await wide.ctx.close();
    const phone = await open('experience', { width: 375 });
    assert.equal(new Set(await tops(phone.page)).size, 2);
    await phone.ctx.close();
  });
});

describe('the Cal.com calendar on the booking page', { skip: noChrome }, () => {
  let browser: Browser;
  let site: Awaited<ReturnType<typeof serve>>;

  // A stand-in for Cal.com's embed script: it draws the inline calendar as an iframe whose
  // address carries the theme, as the real one does, and records the settings it was given.
  const FAKE_EMBED = `(function () {
    var api = window.Cal.ns.meet;
    window.calCalls = api.q.map(function (args) { return Array.prototype.slice.call(args); });
    api.q.forEach(function (args) {
      if (args[0] !== 'inline') return;
      var frame = document.createElement('iframe');
      frame.title = 'Booking calendar';
      frame.src = 'https://app.cal.com/' + args[1].calLink + '?embed=true&theme=' + args[1].config.theme;
      document.querySelector(args[1].elementOrSelector).appendChild(frame);
    });
  })();`;

  before(async () => {
    const dir = copySite('fixtures/minimal', 'pages-calcom', (yaml) => `${yaml}booking: { calcom: "wren-halloway/30min" }\n`);
    site = await serve(buildSite(dir.slice(REPO.length), 'https://u.github.io'), '/');
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser?.close();
    await site?.close();
  });

  async function open(colorScheme: 'light' | 'dark') {
    const ctx = await browser.newContext({ colorScheme });
    await ctx.route('https://app.cal.com/**', (route) =>
      route.request().url().endsWith('/embed/embed.js')
        ? route.fulfill({ contentType: 'text/javascript', body: FAKE_EMBED })
        : route.fulfill({ contentType: 'text/html', body: '<p>calendar</p>' }),
    );
    const page = await ctx.newPage();
    await page.goto(`${site.home}meet`);
    await page.locator('#cal-inline iframe').waitFor({ state: 'attached' });
    return { ctx, page, frame: () => page.$eval('#cal-inline iframe', (el) => new URL((el as HTMLIFrameElement).src)) };
  }

  test("opens in the visitor's theme, with brand colours from the accent tokens", async () => {
    const { ctx, page, frame } = await open('dark');
    assert.equal((await frame()).searchParams.get('theme'), 'dark');
    const calls = await page.evaluate(() => (window as unknown as { calCalls: unknown[][] }).calCalls);
    assert.deepEqual(calls.find((call) => call[0] === 'ui'), [
      'ui',
      { theme: 'dark', layout: 'month_view', hideEventTypeDetails: false, cssVarsPerTheme: { light: { 'cal-brand': '#2c5aa0' }, dark: { 'cal-brand': '#8fb2ea' } } },
    ]);
    assert.match(await page.locator('.fallback').innerHTML(), /Book at <a href="https:\/\/cal\.com\/wren-halloway\/30min"[^>]*>cal\.com\/wren-halloway\/30min<\/a>/);
    await ctx.close();
  });

  test('reloads in the new theme when the visitor clicks the toggle, but not on an OS or other-tab change', async () => {
    const { ctx, page, frame } = await open('light');
    assert.equal((await frame()).searchParams.get('theme'), 'light');
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'dark', preference: 'system', source: 'system' } })));
    assert.equal((await frame()).searchParams.get('theme'), 'light');
    await page.locator('[data-theme-toggle]').click();
    const after = await frame();
    assert.equal(after.searchParams.get('theme'), 'dark');
    assert.equal(after.searchParams.get('ui.color-scheme'), 'dark');
    await ctx.close();
  });
});
