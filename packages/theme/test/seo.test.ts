// M6 unit tests: the head helpers, which endpoints a build gets, the feed, robots.txt, the web
// manifest, the sitemap and the JSON-LD nodes, all at base /hangfolio so every URL must carry it.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { getRssString } from '@astrojs/rss';
import { planSeo, pngSize, publishedPosts } from '../src/lib/endpoints.ts';
import { feedOptions } from '../src/lib/feed.ts';
import { buildSha, findIcons, findPublicManifest, generatorContent, nameParts, verificationFile } from '../src/lib/head.ts';
import { blogPosting, contactPage, ids, pageNodes, scholarlyArticle, siteGraph } from '../src/lib/jsonld.ts';
import { homeTitle, pageTitle } from '../src/lib/site.ts';
import { robotsTxt, verificationBody, webManifest } from '../src/lib/site-files.ts';
import { pageEntry, sitemapEntries, sitemapXml, writeSitemaps } from '../src/lib/sitemap.ts';
import { absUrl, url } from '../src/lib/url.ts';
import { post as postSchema } from '../src/schema/post.ts';
import { site as siteSchema, type SiteInput } from '../src/schema/site.ts';
import { rssProblems } from './e2e/rss-check.ts';
import { issuesOf, parseOk } from './helpers.ts';

const ORIGIN = 'https://u.github.io';
const BASE = '/hangfolio';
const HOME = `${ORIGIN}${BASE}/`;
const abs = (path: string) => absUrl(path, ORIGIN, BASE);

const makeSite = (input: Partial<SiteInput> = {}) => parseOk(siteSchema, { name: 'Wren Halloway', email: 'wren@halloway.test', ...input });
const SITE = makeSite({ role: 'Postdoc in distributed systems', affiliation: { name: 'Institute of Example Studies', url: 'https://example.org' } });

const temps: string[] = [];
after(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A temporary site folder: files given as { 'public/x': 'text' }. */
function folder(files: Record<string, string | Buffer> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'hangfolio-seo-'));
  temps.push(dir);
  for (const [file, body] of Object.entries(files)) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), body);
  }
  return dir;
}

/** A real PNG of the given size (one grey channel, all zero). */
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, data, Buffer.alloc(4)]); // CRC left zero; pngSize reads IHDR only
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc((width + 1) * height))), chunk('IEND', Buffer.alloc(0))]);
}

const post = (front: string) => `---\n${front}\n---\nBody.\n`;

describe('head helpers', () => {
  test('the home title is "Name | role @ affiliation", like the reference design', () => {
    assert.equal(homeTitle(SITE), 'Wren Halloway | Postdoc in distributed systems @ Institute of Example Studies');
    assert.equal(pageTitle(SITE), homeTitle(SITE));
    assert.equal(homeTitle(makeSite({ role: 'Postdoc' })), 'Wren Halloway | Postdoc');
    assert.equal(homeTitle(makeSite({ affiliation: 'Example University' })), 'Wren Halloway | Example University');
    assert.equal(homeTitle(makeSite()), 'Wren Halloway');
    assert.equal(pageTitle(SITE, 'Projects'), 'Projects — Wren Halloway');
  });

  test('profile names: the last word is the family name unless advanced.nameParts says otherwise', () => {
    assert.deepEqual(nameParts(SITE), { given: 'Wren', family: 'Halloway' });
    assert.deepEqual(nameParts(makeSite({ name: 'Mara  de la Quill' })), { given: 'Mara de la', family: 'Quill' });
    assert.deepEqual(nameParts(makeSite({ name: 'Mara de la Quill', advanced: { nameParts: { given: 'Mara', family: 'de la Quill' } } })), { given: 'Mara', family: 'de la Quill' });
    assert.deepEqual(nameParts(makeSite({ name: 'Quill' })), { given: 'Quill' });
  });

  test('icons are found at the root of public/ or in images/, in head order', () => {
    const has = (files: string[]) => (file: string) => files.includes(file);
    assert.deepEqual(findIcons(has(['images/safari-pinned-tab.svg', 'images/apple-touch-icon.png', 'favicon.svg', 'images/favicon-32.png'])), [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/favicon-32.png' },
      { rel: 'apple-touch-icon', href: '/images/apple-touch-icon.png' },
      { rel: 'mask-icon', mask: true, href: '/images/safari-pinned-tab.svg' },
    ]);
    assert.deepEqual(findIcons(has(['favicon.ico', 'images/favicon.ico'])), [{ rel: 'icon', sizes: 'any', href: '/favicon.ico' }]);
    assert.deepEqual(findIcons(has(['images/favicon.png'])), [{ rel: 'icon', type: 'image/png', href: '/images/favicon.png' }]);
    assert.deepEqual(findIcons(has([])), []);
  });

  test('a manifest in public/ is found under any usual name, the root first', () => {
    assert.equal(findPublicManifest((file) => file === 'images/manifest.json'), '/images/manifest.json');
    assert.equal(findPublicManifest((file) => ['site.webmanifest', 'images/manifest.json'].includes(file)), '/site.webmanifest');
    assert.equal(findPublicManifest(() => false), undefined);
  });

  test('the verification file name takes the token with or without .html', () => {
    assert.equal(verificationFile('google0a1b2c3d4e5f6a7b'), '/google0a1b2c3d4e5f6a7b.html');
    assert.equal(verificationFile('google0a1b2c3d4e5f6a7b.html'), '/google0a1b2c3d4e5f6a7b.html');
    assert.equal(verificationBody('google0a1b2c3d4e5f6a7b.html'), 'google-site-verification: google0a1b2c3d4e5f6a7b.html');
  });

  test('the generator names the theme version, Astro and the commit built', () => {
    const sha = 'a'.repeat(40);
    assert.equal(generatorContent('0.1.0', 'Astro v7.3.5', sha), `hangfolio 0.1.0 (Astro v7.3.5, build ${sha})`);
    assert.equal(generatorContent('0.1.0', 'Astro v7.3.5'), 'hangfolio 0.1.0 (Astro v7.3.5)');
    assert.equal(buildSha(folder(), { GITHUB_SHA: sha }), sha);
    assert.equal(buildSha(folder(), {}), undefined, 'a folder outside git has no commit');
  });
});

describe('which endpoints a build gets', () => {
  const plan = (root: string, base: string, site = SITE, demo = false) => planSeo({ root, site, demo, base, publicDir: pathToFileURL(join(root, 'public') + '/') });
  const patterns = (p: ReturnType<typeof plan>) => p.routes.map((route) => `${route.pattern} ${route.entry}`);

  test('at base /: feed, robots.txt and manifest; the sitemap is written after the build', () => {
    const root = folder({ 'content/writing/a.md': post('title: A\ndraft: false'), 'public/favicon.svg': '<svg/>' });
    const result = plan(root, '/');
    assert.deepEqual(patterns(result), ['/feed.xml feed.xml.ts', '/robots.txt robots.txt.ts', '/manifest.webmanifest manifest.webmanifest.ts']);
    assert.deepEqual(result.sitemaps, ['/sitemap.xml']);
    assert.deepEqual(result.head, {
      icons: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      manifest: '/manifest.webmanifest',
      manifestIcons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
      feed: { path: '/feed.xml', title: 'Wren Halloway — Writing' },
      sitemap: '/sitemap.xml',
    });
  });

  test('robots.txt only at base /, since crawlers read it at the host root', () => {
    const root = folder();
    assert.ok(!patterns(plan(root, '/hangfolio')).some((p) => p.startsWith('/robots.txt')));
    assert.ok(!patterns(plan(root, '/hangfolio/')).some((p) => p.startsWith('/robots.txt')));
  });

  test('no posts, only drafts, or the writing page off: no feed and no feed link', () => {
    const drafts = folder({ 'content/writing/a.md': post('title: A\ndraft: true'), 'content/writing/b.mdx': post('title: B\nexample: true') });
    for (const result of [plan(folder(), '/'), plan(drafts, '/'), plan(folder({ 'content/writing/a.md': post('title: A') }), '/', makeSite({ pages: { writing: false } }))]) {
      assert.ok(!patterns(result).some((p) => p.includes('feed')));
      assert.equal(result.head.feed, undefined);
    }
  });

  test('posts counted: drafts never, examples only in demo mode, unreadable front matter still counts', () => {
    const root = folder({
      'content/writing/a.md': post('title: A'),
      'content/writing/b.md': post('title: B\ndraft: true'),
      'content/writing/c.mdx': post('title: C\nexample: true'),
      'content/writing/d.md': post('title: "D'),
      'content/writing/notes.txt': 'not a post',
    });
    assert.equal(publishedPosts(root, false), 2);
    assert.equal(publishedPosts(root, true), 3);
    assert.equal(publishedPosts(folder(), false), 0);
  });

  test('a file in public/ wins: its endpoint is not injected, and the head links to it', () => {
    const root = folder({
      'content/writing/a.md': post('title: A'),
      'public/robots.txt': 'User-agent: *\n',
      'public/notes.xml': '<rss/>',
      'public/images/manifest.json': '{}',
      'public/google0a1b2c3d4e5f6a7b.html': 'google-site-verification: google0a1b2c3d4e5f6a7b.html',
      'public/sitemap.xml': '<urlset/>',
    });
    const site = makeSite({ advanced: { feed: { path: '/notes.xml' }, googleVerification: { file: 'google0a1b2c3d4e5f6a7b' }, sitemapAliases: ['/sitemap-static.xml'] } });
    const result = plan(root, '/', site);
    assert.deepEqual(result.routes, []);
    assert.deepEqual(result.sitemaps, ['/sitemap-static.xml']);
    assert.equal(result.head.manifest, '/images/manifest.json');
    assert.deepEqual(result.head.feed, { path: '/notes.xml', title: 'Wren Halloway — Writing' });
  });

  test('the verification file and sitemap aliases; manifest icons carry their real PNG size', () => {
    const root = folder({ 'public/images/apple-touch-icon.png': png(180, 180), 'public/favicon-32.png': png(32, 32), 'public/safari-pinned-tab.svg': '<svg/>' });
    const site = makeSite({ advanced: { googleVerification: { file: 'google0a1b2c3d4e5f6a7b.html', meta: 'abc_DEF-123' }, sitemapAliases: ['/sitemap-static.xml', '/sitemap.xml'] } });
    const result = plan(root, '/hangfolio', site);
    assert.deepEqual(patterns(result), ['/manifest.webmanifest manifest.webmanifest.ts', '/google0a1b2c3d4e5f6a7b.html google-verification.ts']);
    assert.deepEqual(result.sitemaps, ['/sitemap.xml', '/sitemap-static.xml']);
    assert.deepEqual(result.head.manifestIcons, [
      { src: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { src: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ]);
    assert.deepEqual(pngSize(join(root, 'public/images/apple-touch-icon.png')), { width: 180, height: 180 });
    assert.equal(pngSize(join(root, 'public/safari-pinned-tab.svg')), undefined);
  });
});

describe('the feed', () => {
  const entries = [
    { id: 'older', data: parseOk(postSchema, { title: 'Older', date: '2026-03-01', description: 'The older one.', tags: ['logs'] }) },
    { id: 'draft', data: parseOk(postSchema, { title: 'Draft', date: '2026-09-01', description: 'Unfinished.', draft: true }) },
    { id: 'newer', data: parseOk(postSchema, { title: 'Newer & better', date: '2026-08-20', description: 'Long description.', excerpt: 'The teaser.' }) },
  ];

  test('published posts, newest first, with absolute links under the base and their description (not the list teaser)', () => {
    const options = feedOptions(SITE, entries, abs);
    assert.equal(options.title, 'Wren Halloway — Writing');
    assert.equal(options.description, 'Postdoc in distributed systems, Institute of Example Studies');
    assert.equal(options.site, HOME);
    assert.equal(options.customData, '<language>en-us</language>');
    assert.deepEqual(
      (options.items as { title: string; link: string; description: string }[]).map(({ title, link, description }) => ({ title, link, description })),
      [
        { title: 'Newer & better', link: `${HOME}writing/newer/`, description: 'Long description.' },
        { title: 'Older', link: `${HOME}writing/older/`, description: 'The older one.' },
      ],
    );
  });

  test('title and description from advanced.feed, and the XML is valid RSS 2.0', async () => {
    const site = makeSite({ advanced: { feed: { title: '{name}: notes', description: 'Occasional notes.' }, writingPath: '/notes', locale: 'en_GB' } });
    const xml = await getRssString(feedOptions(site, entries, abs));
    assert.deepEqual(rssProblems(xml), []);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?><rss version="2\.0"><channel><title>Wren Halloway: notes<\/title><description>Occasional notes\.<\/description><link>https:\/\/u\.github\.io\/hangfolio\/<\/link><language>en-gb<\/language><item>/);
    assert.match(xml, /<item><title>Newer &amp; better<\/title><link>https:\/\/u\.github\.io\/hangfolio\/notes\/newer\/<\/link><guid isPermaLink="true">https:\/\/u\.github\.io\/hangfolio\/notes\/newer\/<\/guid><description>Long description\.<\/description><pubDate>Thu, 20 Aug 2026 00:00:00 GMT<\/pubDate><\/item>/);
    assert.match(xml, /<category>logs<\/category>/);
    assert.doesNotMatch(xml, /Draft/);
  });

  test('the RSS checker catches what an RSS validator would', () => {
    const feed = (channel: string, items = '') => `<?xml version="1.0"?><rss version="2.0"><channel>${channel}${items}</channel></rss>`;
    const ok = '<title>T</title><link>https://u.github.io/</link><description>D</description>';
    assert.deepEqual(rssProblems(feed(ok, '<item><title>A</title><guid isPermaLink="false">a-1</guid></item>')), []);
    assert.deepEqual(rssProblems(feed('<title>T</title><link>/relative</link>')), ['the channel has no <description>', 'the channel <link> /relative is not an absolute http(s) URL']);
    assert.deepEqual(rssProblems(feed(ok, '<item><pubDate>Fri, 20 Aug 2026 00:00:00 GMT</pubDate><link>x</link><guid>x</guid><guid2/></item>')), [
      'item 1 has neither a <title> nor a <description>',
      'item 1: <guid2> is not an RSS 2.0 item element',
      'item 1: <link> x is not an absolute http(s) URL',
      'item 1: the permalink <guid> x is not an absolute URL',
      'item 1 <pubDate>: Fri, 20 Aug 2026 00:00:00 GMT: 20 Aug 2026 is a Thu, not a Fri',
    ]);
    assert.match(rssProblems('<rss><channel>')[0], /^not well-formed XML/);
  });
});

describe('robots.txt and the web manifest', () => {
  test('robots.txt allows everything and names every sitemap by its absolute URL', () => {
    const site = makeSite({ advanced: { sitemapAliases: ['/sitemap-static.xml'] } });
    const at = (path: string) => absUrl(path, ORIGIN, '/');
    assert.equal(robotsTxt(site, at), 'User-agent: *\nAllow: /\n\nSitemap: https://u.github.io/sitemap.xml\nSitemap: https://u.github.io/sitemap-static.xml\n');
  });

  test('the manifest: name, start_url and scope under the base, token colours, base-safe icons', () => {
    const body = webManifest(SITE, { abs, url: (path) => url(path, BASE), icons: [{ src: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }], colors: { bg: '#f5f7fa', accent: '#2c5aa0' } });
    assert.deepEqual(JSON.parse(body), {
      name: 'Wren Halloway',
      short_name: 'Wren Halloway',
      description: 'Postdoc in distributed systems, Institute of Example Studies',
      lang: 'en',
      start_url: HOME,
      scope: HOME,
      display: 'standalone',
      background_color: '#f5f7fa',
      theme_color: '#2c5aa0',
      icons: [{ src: '/hangfolio/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }],
    });
  });
});

describe('the sitemap', () => {
  const page = (head: string) => `<!doctype html><html><head>${head}</head><body><a href="x">x</a></body></html>`;
  const canonical = (path: string) => `<link rel="canonical" href="${abs(path)}">`;

  test('a page is listed by its canonical unless it is noindex or not on the site', () => {
    assert.deepEqual(pageEntry(page(canonical('/projects')), HOME), { loc: `${HOME}projects`, lastmod: undefined, published: undefined });
    assert.equal(pageEntry(page(`<meta name="robots" content="noindex, follow">${canonical('/')}`), HOME), undefined);
    assert.equal(pageEntry(page('<link rel="canonical" href="https://elsewhere.example/">'), HOME), undefined);
    assert.equal(pageEntry(page('<title>No canonical</title>'), HOME), undefined);
    assert.equal(pageEntry('google-site-verification: google1.html', HOME), undefined);
    const postHead = `${canonical('/writing/a/')}<meta property="article:published_time" content="2026-03-01T00:00:00.000Z"><meta property="article:modified_time" content="2026-04-02T00:00:00.000Z">`;
    assert.deepEqual(pageEntry(page(postHead), HOME), { loc: `${HOME}writing/a/`, lastmod: '2026-04-02', published: '2026-03-01T00:00:00.000Z' });
  });

  test('home first, then the theme pages in order, other pages, and posts newest first; written byte-identical at each path', async () => {
    const posted = (path: string, date: string) => page(`${canonical(path)}<meta property="article:published_time" content="${date}T00:00:00.000Z">`);
    const dist = folder({
      'index.html': page(canonical('/')),
      '404.html': page('<meta name="robots" content="noindex, follow">'),
      'about.html': page(`<meta http-equiv="refresh" content="0; url=/hangfolio/"><meta name="robots" content="noindex">${canonical('/')}`),
      'contact.html': page(canonical('/contact')),
      'projects.html': page(canonical('/projects')),
      'projects/tern/index.html': page(canonical('/projects/tern/')),
      'writing/index.html': page(canonical('/writing/')),
      'writing/old/index.html': posted('/writing/old/', '2025-01-02'),
      'writing/new/index.html': posted('/writing/new/', '2026-05-06'),
      'writing.html': page(canonical('/writing/')), // a second copy of a page is listed once
      '_astro/x.html': page(canonical('/x')),
    });
    const order = ['/projects', '/publications', '/writing/', '/contact'].map(abs);
    const entries = sitemapEntries(dist, HOME, order);
    assert.deepEqual(entries, [
      { loc: HOME },
      { loc: `${HOME}projects` },
      { loc: `${HOME}writing/` },
      { loc: `${HOME}contact` },
      { loc: `${HOME}projects/tern/` },
      { loc: `${HOME}writing/new/`, lastmod: '2026-05-06' },
      { loc: `${HOME}writing/old/`, lastmod: '2025-01-02' },
    ]);
    assert.equal(
      sitemapXml(entries.slice(0, 1).concat([{ loc: `${HOME}a?b&c`, lastmod: '2026-05-06' }])),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url><loc>https://u.github.io/hangfolio/</loc></url>\n' +
        '  <url><loc>https://u.github.io/hangfolio/a?b&amp;c</loc><lastmod>2026-05-06</lastmod></url>\n' +
        '</urlset>\n',
    );
    assert.equal(await writeSitemaps(dist, ['/sitemap.xml', '/maps/sitemap-static.xml'], HOME, order), 7);
    assert.equal(readFileSync(join(dist, 'sitemap.xml'), 'utf8'), sitemapXml(entries));
    assert.equal(readFileSync(join(dist, 'maps/sitemap-static.xml'), 'utf8'), sitemapXml(entries));
    assert.equal(sitemapXml([]), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n');
  });

  test('a path the build already wrote is never overwritten', async () => {
    const dist = folder({ 'index.html': '<html><head><link rel="canonical" href="https://u.github.io/hangfolio/"></head></html>', 'notes.xml': '<rss/>' });
    const taken: string[] = [];
    assert.equal(await writeSitemaps(dist, ['/sitemap.xml', '/notes.xml'], HOME, [], (path) => taken.push(path)), 1);
    assert.deepEqual(taken, ['/notes.xml']);
    assert.equal(readFileSync(join(dist, 'notes.xml'), 'utf8'), '<rss/>');
    assert.match(readFileSync(join(dist, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/u\.github\.io\/hangfolio\/<\/loc>/);
  });
});

describe('site.yaml mistakes in the SEO settings', () => {
  const issues = (advanced: Record<string, unknown>) => issuesOf(siteSchema, { name: 'Wren Halloway', email: 'wren@halloway.test', advanced });

  test('the feed and the sitemap copies are .xml files, each at its own path', () => {
    assert.deepEqual(issues({ feed: { path: '/feed' } }), ["advanced.feed.path E202: must be a file path ending in .xml, like /feed.xml (you wrote '/feed')"]);
    assert.deepEqual(issues({ feed: { path: '/feed.xml/' } }), ["advanced.feed.path E202: must be a file path ending in .xml, like /feed.xml (you wrote '/feed.xml/')"]);
    assert.deepEqual(issues({ sitemapAliases: ['/index.html'] }), [
      "advanced.sitemapAliases.0 E202: must be a file path ending in .xml, like /sitemap-static.xml (you wrote '/index.html')",
    ]);
    assert.deepEqual(issues({ feed: { path: '/sitemap.xml' } }), ["advanced.feed.path E303: is also the sitemap's path ('/sitemap.xml'); give the feed its own, like /feed.xml"]);
    assert.deepEqual(issues({ sitemapAliases: ['/sitemap-static.xml', 'feed.xml'] }), [
      "advanced.sitemapAliases.1 E303: is also the feed's path ('/feed.xml'); give the sitemap copy its own, like /sitemap-static.xml",
    ]);
    assert.deepEqual(issues({ feed: { path: 'notes.xml' }, sitemapAliases: ['/sitemap.xml', '/maps/sitemap-static.xml'] }), []);
  });

  test('Google verification: a pasted tag, address or file body, or a token under the wrong key, says what to write', () => {
    const file = 'google0a1b2c3d4e5f6a7b';
    const metaToken = 'Tq3abcDEFghiJKLmnoPQRstuVWXyz0123456789_-A';
    assert.deepEqual(issues({ googleVerification: { file, meta: metaToken } }), []);
    assert.deepEqual(issues({ googleVerification: { file: `${file}.html` } }), []);
    assert.deepEqual(issues({ googleVerification: { file: `https://wren.example/${file}.html` } }), [
      `advanced.googleVerification.file E202: must be just the file's name, '${file}.html' (you wrote 'https://wren.example/${file}.html')`,
    ]);
    assert.deepEqual(issues({ googleVerification: { file: `google-site-verification: ${file}.html` } }), [
      `advanced.googleVerification.file E202: must be just the file's name, '${file}.html' (you wrote 'google-site-verification: ${file}.html')`,
    ]);
    assert.deepEqual(issues({ googleVerification: { file: metaToken } }), [
      `advanced.googleVerification.file E202: must be the name of the file Google gives you, like google1234567890abcdef.html; '${metaToken}' looks like the meta tag's token, so put it under googleVerification.meta instead`,
    ]);
    assert.deepEqual(issues({ googleVerification: { file: 'index' } }), [
      "advanced.googleVerification.file E202: must be the name of the file Google gives you, like google1234567890abcdef.html (you wrote 'index')",
    ]);
    assert.deepEqual(issues({ googleVerification: { meta: `<meta name="google-site-verification" content="${metaToken}" />` } }), [
      `advanced.googleVerification.meta E202: must be only the token inside content="…", '${metaToken}'`,
    ]);
    assert.deepEqual(issues({ googleVerification: { meta: `${file}.html` } }), [
      `advanced.googleVerification.meta E202: is the HTML file's name ('${file}.html'), so put it under googleVerification.file instead`,
    ]);
  });
});

describe('JSON-LD', () => {
  test('the site graph: WebSite and Person with stable @ids under the base', () => {
    const graph = siteGraph(SITE, abs('/images/me.jpg'), [], abs);
    const [website, person] = graph['@graph'] as Record<string, unknown>[];
    assert.equal(website['@id'], `${HOME}#website`);
    assert.equal(website.url, HOME);
    assert.deepEqual(website.publisher, { '@id': `${HOME}#person` });
    assert.equal(person['@id'], `${HOME}#person`);
    assert.equal(person.image, `${HOME}images/me.jpg`);
    assert.deepEqual(person.worksFor, { '@type': 'Organization', name: 'Institute of Example Studies', url: 'https://example.org' });
    assert.equal(ids.website(abs), `${HOME}#website`);
  });

  test("a post's BlogPosting", () => {
    const published = new Date('2026-08-20T00:00:00Z');
    assert.deepEqual(blogPosting(SITE, { path: '/writing/a/', headline: 'A post', description: 'About a.', published, modified: new Date('2026-09-01T00:00:00Z'), tags: ['logs', 'disks'] }, abs), {
      '@type': 'BlogPosting',
      '@id': `${HOME}writing/a/#article`,
      headline: 'A post',
      description: 'About a.',
      datePublished: '2026-08-20',
      dateModified: '2026-09-01',
      author: { '@id': `${HOME}#person` },
      publisher: { '@id': `${HOME}#person` },
      mainEntityOfPage: `${HOME}writing/a/`,
      keywords: 'logs, disks',
      inLanguage: 'en-US',
    });
    const bare = blogPosting(SITE, { path: '/writing/b/', headline: 'B', published, tags: [] }, abs);
    assert.ok(!('dateModified' in bare) && !('keywords' in bare) && !('description' in bare));
  });

  test('the ContactPage', () => {
    assert.deepEqual(contactPage('/contact', 'Contact — Wren Halloway', abs), {
      '@type': 'ContactPage',
      '@id': `${HOME}contact#webpage`,
      url: `${HOME}contact`,
      name: 'Contact — Wren Halloway',
      isPartOf: { '@id': `${HOME}#website` },
      about: { '@id': `${HOME}#person` },
    });
  });

  test('the ScholarlyArticle hook: the reference design shape, the owner as the Person, extras merged over', () => {
    const paper = {
      path: '/publications',
      anchor: 'nsx24',
      title: 'Where the battery goes on an idle phone',
      authors: [{ name: 'Iva Penrose' }, { name: 'Wren Halloway', self: true }],
      date: '2024-05',
      publisher: 'Example Press',
      pages: '101--112',
      doi: 'https://doi.org/10.5555/nsx.2024.7',
    };
    assert.deepEqual(scholarlyArticle(paper, abs), {
      '@type': 'ScholarlyArticle',
      '@id': `${HOME}publications#nsx24`,
      headline: 'Where the battery goes on an idle phone',
      name: 'Where the battery goes on an idle phone',
      author: [{ '@type': 'Person', name: 'Iva Penrose' }, { '@id': `${HOME}#person` }],
      datePublished: '2024-05',
      publisher: { '@type': 'Organization', name: 'Example Press' },
      pagination: '101-112',
      identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: '10.5555/nsx.2024.7' },
      sameAs: 'https://doi.org/10.5555/nsx.2024.7',
      url: `${HOME}publications`,
    });
    const overridden = scholarlyArticle({ ...paper, doi: undefined, schema: { '@type': 'Article', inLanguage: 'en' } }, abs);
    assert.equal(overridden['@type'], 'Article');
    assert.equal(overridden.inLanguage, 'en');
    assert.ok(!('identifier' in overridden) && !('sameAs' in overridden));
  });

  test("a page's own node wins over the derived one with the same @id", () => {
    const own = { '@type': 'ContactPage', '@id': `${HOME}contact#webpage`, name: 'Mine' };
    const derived = contactPage('/contact', 'Derived', abs);
    assert.deepEqual(pageNodes([own], [derived, undefined]), [own]);
    assert.deepEqual(pageNodes([], [derived, undefined]), [derived]);
  });
});
