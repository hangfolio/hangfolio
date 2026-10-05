// M6: the generated files and head tags in real builds. At base / and /hangfolio, every
// canonical, og:url, JSON-LD URL, sitemap URL and feed link starts with the site's home URL (the
// abs-URL checker), the feed is valid RSS 2.0, robots.txt exists only at base /, and a file in
// public/ always wins over a generated one, byte for byte.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../helpers.ts';
import { absUrlProblems } from './abs-urls.ts';
import { buildFixture, buildSite } from './fixture.ts';
import { rssProblems } from './rss-check.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const SHA = '0123456789abcdef0123456789abcdef01234567';
process.env.GITHUB_SHA = SHA; // the builds below inherit it: the generator meta carries it
const SITES = ['https://u.github.io', 'https://u.github.io/hangfolio'];

const readIn = (dist: string) => (file: string) => readFileSync(join(dist, file), 'utf8');
const headOf = (html: string) => html.slice(0, html.indexOf('</head>'));
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const pngHeader = (width: number, height: number) => {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'latin1');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ihdr]);
};

for (const pagesUrl of SITES) {
  const home = `${pagesUrl}/`;
  const base = new URL(pagesUrl).pathname.replace(/\/$/, '');

  describe(`fixtures/owner-like SEO with SITE_PAGES_URL=${pagesUrl}`, () => {
    let dist = '';
    let read: (file: string) => string;
    before(() => {
      dist = buildFixture('owner-like', pagesUrl);
      read = readIn(dist);
    });

    test('the abs-URL checker finds nothing', () => {
      assert.deepEqual(absUrlProblems(dist, home), []);
    });

    test('public/robots.txt and public/images/manifest.json are output byte-identical, and nothing is generated over them', () => {
      const pub = join(REPO, 'fixtures/owner-like/public');
      assert.ok(readFileSync(join(dist, 'robots.txt')).equals(readFileSync(join(pub, 'robots.txt'))), 'cmp public/robots.txt dist/robots.txt');
      assert.ok(readFileSync(join(dist, 'images/manifest.json')).equals(readFileSync(join(pub, 'images/manifest.json'))));
      assert.ok(!existsSync(join(dist, 'manifest.webmanifest')));
      assert.match(read('index.html'), new RegExp(`<link rel="manifest" href="${base}/images/manifest.json">`));
    });

    test('the feed is valid RSS 2.0 with every published post, newest first, under the base', () => {
      const xml = read('feed.xml');
      assert.deepEqual(rssProblems(xml), []);
      assert.match(xml, /<channel><title>Kasia Morrow — Writing<\/title><description>PhD student in edge and mobile systems, Northlake Institute of Technology<\/description>/);
      assert.match(xml, new RegExp(`<link>${home}</link><language>en-us</language>`));
      assert.deepEqual([...xml.matchAll(/<guid isPermaLink="true">([^<]*)<\/guid>/g)].map((m) => m[1]), [`${home}writing/pondskip-flaky-tests/`, `${home}writing/idle-radio-drain/`]);
      assert.doesNotMatch(xml, /power caps/i, 'the draft stays out');
    });

    test('sitemap.xml lists the indexable pages; the sitemapAliases copy is byte-identical', () => {
      const xml = read('sitemap.xml');
      assert.ok(locs(xml).includes(home));
      assert.ok(locs(xml).every((loc) => loc.startsWith(home)));
      assert.ok(!locs(xml).some((loc) => /404|google/.test(loc)));
      assert.equal(read('sitemap-static.xml'), xml);
    });

    test('the Google verification file from advanced.googleVerification.file', () => {
      assert.equal(read('google0a1b2c3d4e5f6a7b.html'), 'google-site-verification: google0a1b2c3d4e5f6a7b.html');
    });

    test("the home page head: the reference design's title shape, profile names, icons, manifest, feed, sitemap and generator", () => {
      const head = headOf(read('index.html'));
      const title = 'Kasia Morrow | PhD student in edge and mobile systems @ Northlake Institute of Technology';
      assert.match(head, new RegExp(`<title>${title}</title>`));
      assert.match(head, new RegExp(`<meta property="og:title" content="${title}">`));
      assert.match(head, /<meta property="og:type" content="profile"><meta property="profile:first_name" content="Kasia"><meta property="profile:last_name" content="Morrow">/);
      assert.match(head, new RegExp(`<link rel="icon" type="image/svg\\+xml" href="${base}/favicon.svg">`));
      assert.match(head, new RegExp(`<link rel="alternate" type="application/rss\\+xml" title="Kasia Morrow — Writing" href="${base}/feed.xml">`));
      assert.match(head, new RegExp(`<link rel="sitemap" href="${base}/sitemap.xml">`));
      assert.match(head, new RegExp(`<meta name="generator" content="hangfolio \\d+\\.\\d+\\.\\d+[^"]* \\(Astro v[\\d.]+, build ${SHA}\\)">`));
      assert.doesNotMatch(head, /google-site-verification/, 'no meta token is set');
    });

    test('the footer links to the feed', () => {
      const footer = read('index.html').match(/<footer class="foot".*?<\/footer>/s)![0];
      assert.match(footer, new RegExp(`<a href="${base}/feed.xml"[^>]*>RSS</a></nav>`));
    });

    test('the 404 page is noindex and is no page of the sitemap', () => {
      assert.match(read('404.html'), /<meta name="robots" content="noindex, follow">/);
      assert.ok(!read('sitemap.xml').includes('404'));
    });
  });

  describe(`fixtures/minimal SEO with SITE_PAGES_URL=${pagesUrl}`, () => {
    let dist = '';
    before(() => {
      dist = buildFixture('minimal', pagesUrl);
    });

    test('the abs-URL checker finds nothing, and the feed is valid RSS 2.0', () => {
      assert.deepEqual(absUrlProblems(dist, home), []);
      assert.deepEqual(rssProblems(readIn(dist)('feed.xml')), []);
    });

    test(base ? 'no robots.txt below the host root' : 'robots.txt at the host root, with the absolute sitemap URL', () => {
      if (base) assert.ok(!existsSync(join(dist, 'robots.txt')));
      else assert.equal(readIn(dist)('robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://u.github.io/sitemap.xml\n');
    });

    test('the generated manifest: start_url and scope at home, colours from the tokens, the favicon under the base', () => {
      const manifest = JSON.parse(readIn(dist)('manifest.webmanifest'));
      assert.equal(manifest.start_url, home);
      assert.equal(manifest.scope, home);
      assert.equal(manifest.background_color, '#f5f7fa');
      assert.equal(manifest.theme_color, '#2c5aa0');
      assert.deepEqual(manifest.icons, [{ src: `${base}/favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]);
      assert.match(readIn(dist)('index.html'), new RegExp(`<link rel="manifest" href="${base}/manifest.webmanifest">`));
    });
  });
}

describe('fixtures/kitchen-sink SEO at /hangfolio', () => {
  test('the abs-URL checker finds nothing, and the feed is valid RSS 2.0 without the draft', () => {
    const dist = buildFixture('kitchen-sink', 'https://u.github.io/hangfolio');
    assert.deepEqual(absUrlProblems(dist, 'https://u.github.io/hangfolio/'), []);
    const xml = readIn(dist)('feed.xml');
    assert.deepEqual(rssProblems(xml), []);
    assert.equal([...xml.matchAll(/<item>/g)].length, 4);
    assert.doesNotMatch(xml, /hermetic toolchains/i, 'the draft stays out');
  });
});

describe('fixtures/empty SEO', () => {
  test('no posts: no feed, no feed links; the manifest and sitemap are still there', () => {
    const dist = buildFixture('empty', 'https://u.github.io');
    const html = readIn(dist)('index.html');
    assert.ok(!existsSync(join(dist, 'feed.xml')));
    assert.doesNotMatch(html, /application\/rss\+xml|>RSS</);
    // The contact page is always there (it needs no content).
    assert.deepEqual(locs(readIn(dist)('sitemap.xml')), ['https://u.github.io/', 'https://u.github.io/contact']);
    assert.ok(existsSync(join(dist, 'manifest.webmanifest')));
    assert.match(html, /<title>Sol Brennan<\/title>/);
    assert.match(html, /<meta property="profile:first_name" content="Sol"><meta property="profile:last_name" content="Brennan">/);
    assert.deepEqual(absUrlProblems(dist, 'https://u.github.io/'), []);
  });
});

describe('the starter in demo mode', () => {
  test('every page is noindex, so the sitemap lists none', () => {
    const dist = buildSite('starter', 'https://hangfolio.github.io/starter');
    assert.deepEqual(locs(readIn(dist)('sitemap.xml')), []);
    assert.deepEqual(rssProblems(readIn(dist)('feed.xml')), []);
    assert.deepEqual(absUrlProblems(dist, 'https://hangfolio.github.io/starter/'), []);
  });
});

/** A copy of fixtures/minimal in .tmp/ (inside the workspace, so it finds hangfolio), changed by `edit`. */
function copyMinimal(name: string, edit: (dir: string) => void): string {
  const dir = join(REPO, '.tmp', name);
  rmSync(dir, { recursive: true, force: true });
  for (const entry of ['site.yaml', 'content', 'public', 'astro.config.mjs', 'src', 'package.json']) {
    cpSync(join(REPO, 'fixtures/minimal', entry), join(dir, entry), { recursive: true });
  }
  edit(dir);
  return dir;
}

function editYaml(dir: string, from: string, to: string) {
  const file = join(dir, 'site.yaml');
  const text = readFileSync(file, 'utf8');
  assert.ok(text.includes(from), `site.yaml has ${from}`);
  writeFileSync(file, text.replace(from, to));
}

function put(dir: string, file: string, body: string | Buffer) {
  mkdirSync(join(dir, file, '..'), { recursive: true });
  writeFileSync(join(dir, file), body);
}

describe('every SEO option, in directory URL format', () => {
  let site = '';
  before(() => {
    site = copyMinimal('seo-options', (dir) => {
      editYaml(
        dir,
        'advanced:\n',
        [
          'advanced:',
          '  urlFormat: directory',
          '  googleVerification: { file: "google9f8e7d6c5b4a3921.html", meta: "Tq3-verification_token" }',
          '  feed: { path: "/notes.xml", title: "{name}: notes", description: "Occasional notes on replicated logs." }',
          '  sitemapAliases: ["/sitemap-static.xml"]',
          '  nameParts: { given: "Wren", family: "Halloway-Reyes" }',
          '',
        ].join('\n'),
      );
      rmSync(join(dir, 'public/favicon.svg'));
      put(dir, 'public/images/apple-touch-icon.png', pngHeader(180, 180));
      put(dir, 'public/images/safari-pinned-tab.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
      put(dir, 'public/favicon-32.png', pngHeader(32, 32));
    });
  });
  after(() => rmSync(site, { recursive: true, force: true }));

  for (const pagesUrl of SITES) {
    test(`at ${pagesUrl}: files, head tags and absolute URLs`, () => {
      const home = `${pagesUrl}/`;
      const base = new URL(pagesUrl).pathname.replace(/\/$/, '');
      const dist = buildSite('.tmp/seo-options', pagesUrl);
      const read = readIn(dist);
      const files = listFiles(dist).filter((file) => !file.startsWith('_astro/'));
      for (const file of ['notes.xml', 'google9f8e7d6c5b4a3921.html', 'manifest.webmanifest', 'sitemap.xml', 'sitemap-static.xml']) {
        assert.ok(files.includes(file) && statSync(join(dist, file)).isFile(), `${file} is written as a file`);
      }
      assert.equal(files.includes('robots.txt'), !base);
      if (!base) assert.match(read('robots.txt'), /Sitemap: https:\/\/u\.github\.io\/sitemap\.xml\nSitemap: https:\/\/u\.github\.io\/sitemap-static\.xml\n$/);
      assert.equal(read('google9f8e7d6c5b4a3921.html'), 'google-site-verification: google9f8e7d6c5b4a3921.html');
      assert.deepEqual(rssProblems(read('notes.xml')), []);
      assert.match(read('notes.xml'), /<title>Wren Halloway: notes<\/title><description>Occasional notes on replicated logs\.<\/description>/);
      assert.equal(read('sitemap-static.xml'), read('sitemap.xml'));

      const head = headOf(read('index.html'));
      assert.match(head, /<meta name="google-site-verification" content="Tq3-verification_token">/);
      assert.doesNotMatch(headOf(read('404.html')), /google-site-verification/, 'the meta token goes on the home page only');
      assert.match(head, /<meta property="profile:first_name" content="Wren"><meta property="profile:last_name" content="Halloway-Reyes">/);
      assert.match(
        head,
        new RegExp(
          `<link rel="icon" type="image/png" sizes="32x32" href="${base}/favicon-32.png">` +
            `<link rel="apple-touch-icon" href="${base}/images/apple-touch-icon.png">` +
            `<link rel="mask-icon" href="${base}/images/safari-pinned-tab.svg" color="#2c5aa0">` +
            `<link rel="manifest" href="${base}/manifest.webmanifest">` +
            `<link rel="alternate" type="application/rss\\+xml" title="Wren Halloway: notes" href="${base}/notes.xml">` +
            `<link rel="sitemap" href="${base}/sitemap.xml">`,
        ),
      );
      assert.deepEqual(JSON.parse(read('manifest.webmanifest')).icons, [
        { src: `${base}/favicon-32.png`, sizes: '32x32', type: 'image/png', purpose: 'any' },
        { src: `${base}/images/apple-touch-icon.png`, sizes: '180x180', type: 'image/png', purpose: 'any' },
      ]);
      assert.deepEqual(absUrlProblems(dist, home), []);
    });
  }
});

describe('a file in public/ wins over every generated one', () => {
  const FILES: Record<string, string> = {
    'public/feed.xml': '<?xml version="1.0"?><rss version="2.0"><channel><title>Mine</title><link>https://u.github.io/</link><description>Kept as is</description></channel></rss>\n',
    'public/robots.txt': 'User-agent: *\nDisallow: /drafts/\n',
    'public/site.webmanifest': '{ "name": "Kept as is" }\n',
    'public/sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
    'public/google1122334455667788.html': 'google-site-verification: google1122334455667788.html',
  };
  let site = '';
  before(() => {
    site = copyMinimal('seo-public-wins', (dir) => {
      editYaml(dir, 'advanced:\n', 'advanced:\n  googleVerification: { file: "google1122334455667788" }\n');
      for (const [file, body] of Object.entries(FILES)) put(dir, file, body);
    });
  });
  after(() => rmSync(site, { recursive: true, force: true }));

  test('each is output byte-identical, and the head still links the feed, manifest and sitemap', () => {
    const dist = buildSite('.tmp/seo-public-wins', 'https://u.github.io');
    for (const [file, body] of Object.entries(FILES)) assert.equal(readIn(dist)(file.slice('public/'.length)), body, file);
    assert.ok(!existsSync(join(dist, 'manifest.webmanifest')));
    const head = headOf(readIn(dist)('index.html'));
    assert.match(head, /<link rel="manifest" href="\/site.webmanifest"><link rel="alternate" type="application\/rss\+xml" title="Wren Halloway — Writing" href="\/feed.xml"><link rel="sitemap" href="\/sitemap.xml">/);
  });
});
