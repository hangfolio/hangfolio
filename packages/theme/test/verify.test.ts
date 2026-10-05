// `hangfolio verify` (SPEC 7.2, 10.1): each check on a small hand-written dist/, the scanner's
// edge cases, and the command's exit codes, report and GitHub output.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runVerify, verifySummary } from '../src/lib/verify-cli.ts';
import { cssRefs, scanHtml, scanXml, srcsetUrls } from '../src/lib/verify-html.ts';
import { verifyDist, type VerifyOptions } from '../src/lib/verify.ts';
import { where } from '../src/validate/format.ts';
import { docsUrl } from '../src/validate/issue.ts';

const BIN = fileURLToPath(new URL('../bin/hangfolio.mjs', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'hangfolio-verify-'));
after(() => rmSync(work, { recursive: true, force: true }));

let count = 0;
/** Writes the files into a new folder and returns its path. */
function folder(files: Record<string, string>): string {
  const dir = join(work, String(++count));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

/** A page with the head every hangfolio page has, for https://u.github.io/hangfolio. */
const page = (path: string, body: string, head = '') =>
  `<!DOCTYPE html><html lang="en"><head><link rel="canonical" href="https://u.github.io/hangfolio${path}"><meta property="og:url" content="https://u.github.io/hangfolio${path}">${head}</head><body>${body}</body></html>`;

/** Verify's issues as `file:line:col CODE message` lines. */
function verify(files: Record<string, string>, options: Partial<VerifyOptions> = {}) {
  const dist = folder(files);
  const result = verifyDist({ dist, origin: 'https://u.github.io', base: '/hangfolio', urlFormat: 'preserve', ...options });
  return { ...result, lines: result.issues.map((issue) => `${where(issue)} ${issue.code} ${issue.message}`) };
}

const codes = (lines: string[]) => lines.map((line) => line.split(' ')[1]);

describe('a clean site', () => {
  test('pages, assets, styles, fragments, sitemap, feed, robots and manifest all resolve', () => {
    const result = verify({
      'index.html': page(
        '/',
        [
          '<a href="/hangfolio/projects">Projects</a>',
          '<a href="/hangfolio/writing/">Writing</a>',
          '<a href="/hangfolio/writing">Writing, no slash</a>',
          '<a href="/hangfolio/writing/post/#results">A heading</a>',
          '<a href="writing/post/">Relative</a>',
          '<a href="#main">Skip</a><main id="main"></main>',
          '<a href="#">Top</a><a href="#top">Top</a>',
          '<a href="/hangfolio/files/cv.pdf#page=2">CV</a>',
          '<a href="mailto:a@b.test?subject=Hi&amp;x=1">Mail</a><a href="tel:+1555">Call</a>',
          '<a href="https://example.org/x">External</a><a href="https://u.github.io/">The user site</a>',
          '<script src="//cdn.example.com/x.js"></script>',
          '<img src="/hangfolio/images/a.png" srcset="/hangfolio/images/a.png 1x, /hangfolio/images/a@2x.png 2x" alt="">',
          '<img src="data:image/png;base64,AAAA" alt="">',
          '<script type="application/ld+json">{"@graph":[{"@id":"https://u.github.io/hangfolio/#person","url":"https://u.github.io/hangfolio/","image":"https://u.github.io/hangfolio/images/a.png"}]}</script>',
        ].join(''),
        '<link rel="stylesheet" href="/hangfolio/_astro/site.css"><link rel="manifest" href="/hangfolio/manifest.webmanifest"><meta property="og:image" content="https://u.github.io/hangfolio/images/a.png">',
      ),
      'projects.html': page('/projects', '<a href="/hangfolio/">Home</a>'),
      'writing/index.html': page('/writing/', '<a href="post/">Post</a>'),
      'writing/post/index.html': page('/writing/post/', '<h2 id="results">Results</h2>'),
      '404.html': '<html><head></head><body><a href="/hangfolio/">Home</a><a href="#x" id="x">x</a></body></html>',
      'files/cv.pdf': '%PDF',
      'images/a.png': 'png',
      'images/a@2x.png': 'png',
      '_astro/site.css': '@font-face{src:url(/hangfolio/_astro/f.woff2) format("woff2"),url("./f.woff")}body{background:url(data:image/svg+xml,abc)}',
      '_astro/f.woff2': 'font',
      '_astro/f.woff': 'font',
      'manifest.webmanifest': JSON.stringify({ start_url: '/hangfolio/', icons: [{ src: 'images/a.png' }] }),
      'sitemap.xml': '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://u.github.io/hangfolio/</loc></url><url><loc>https://u.github.io/hangfolio/projects</loc></url></urlset>',
      'feed.xml': '<?xml version="1.0"?><rss version="2.0"><channel><link>https://u.github.io/hangfolio/</link><item><link>https://u.github.io/hangfolio/writing/post/</link><guid isPermaLink="false">post-1</guid><description><![CDATA[<a href="/nope">x</a>]]></description></item></channel></rss>',
      'robots.txt': 'User-agent: *\nAllow: /\nSitemap: https://u.github.io/hangfolio/sitemap.xml\n',
    });
    assert.deepEqual(result.lines, []);
    assert.equal(result.pages, 5);
    assert.equal(result.css, 1);
    assert.equal(result.xml, 2);
    assert.ok(result.links >= 25, `${result.links} links checked`);
  });
});

describe('E602: links and files that GitHub Pages cannot serve', () => {
  test('a missing page, with the closest page suggested and the link text quoted', () => {
    const { lines, issues } = verify({ 'index.html': page('/', '<a href="/hangfolio/projets">My <em>projects</em></a>'), 'projects.html': page('/projects', '') });
    assert.deepEqual(lines, [
      'dist/index.html:1:179 E602 Links to /hangfolio/projets ("My projects"), which is not a page or file in this site. Did you mean /hangfolio/projects?',
    ]);
    assert.equal(issues[0].target, '/projets');
  });

  test("urlFormat 'preserve': a final slash on a projects.html page", () => {
    const { lines } = verify({ 'index.html': page('/', '<a href="/hangfolio/projects/">P</a>'), 'projects.html': page('/projects', '') });
    assert.match(lines[0], /E602 Links to \/hangfolio\/projects\/ \("P"\), which is not a page or file in this site\. GitHub Pages serves projects\.html at \/hangfolio\/projects, without the final slash \(advanced\.urlFormat is 'preserve'\); link to \/hangfolio\/projects\.$/);
  });

  test("urlFormat 'directory': /projects and /projects/ both reach projects/index.html", () => {
    const { lines } = verify(
      { 'index.html': page('/', '<a href="/hangfolio/projects/">P</a><a href="/hangfolio/projects">P</a>'), 'projects/index.html': page('/projects/', '') },
      { urlFormat: 'directory' },
    );
    assert.deepEqual(lines, []);
  });

  test('case matters on GitHub Pages; missing images, styles, fonts and srcset candidates', () => {
    const { lines } = verify({
      'index.html': page(
        '/',
        '<a href="/hangfolio/Files/CV.pdf">CV</a><img src="/hangfolio/images/b.png" srcset="/hangfolio/images/a.png 1x, /hangfolio/images/c.png 2x" alt="">',
        '<link rel="stylesheet" href="/hangfolio/_astro/missing.css"><link rel="stylesheet" href="/hangfolio/_astro/site.css">',
      ),
      'files/CV.pdf': '%PDF',
      'images/a.png': 'png',
      '_astro/site.css': '@font-face{src:url(/hangfolio/_astro/gone.woff2)}',
    });
    assert.deepEqual(codes(lines), ['E602', 'E602', 'E602', 'E602', 'E602']);
    assert.match(lines[0], /^dist\/_astro\/site\.css:1:16 E602 Loads \/hangfolio\/_astro\/gone\.woff2, which is not a file in this site\./);
    assert.match(lines.join('\n'), /Links to \/hangfolio\/Files\/CV\.pdf \("CV"\), which is not a page or file in this site\. Did you mean \/hangfolio\/files\/CV\.pdf\? Addresses are case-sensitive on GitHub Pages\./);
    assert.match(lines.join('\n'), /Loads \/hangfolio\/_astro\/missing\.css, which is not a file in this site\./);
    assert.match(lines.join('\n'), /Loads \/hangfolio\/images\/b\.png, which is not a file/);
    assert.match(lines.join('\n'), /Loads \/hangfolio\/images\/c\.png, which is not a file/);
  });

  test('the base path twice, and a redirect page pointing nowhere', () => {
    const { lines } = verify({
      'index.html': page('/', '<a href="/hangfolio/hangfolio/projects">P</a>'),
      'about.html': '<html><head><meta http-equiv="refresh" content="0; url=/hangfolio/aboutme"></head></html>',
      'projects.html': page('/projects', ''),
    });
    assert.match(lines[0], /^dist\/about\.html:1:\d+ E602 Redirects to \/hangfolio\/aboutme, which is not a file in this site\./);
    assert.match(lines[1], /E602 Links to \/hangfolio\/hangfolio\/projects \("P"\), which is not a page or file in this site\. It has the base path twice; link to \/hangfolio\/projects\.$/);
  });

  test('at base /: a link to a path nothing in the site starts with may be another site', () => {
    const { lines } = verify({ 'index.html': '<a href="/paper-demo/">Demo</a><a href="https://u.github.io/paper-demo/">Demo</a>' }, { base: '/' });
    assert.deepEqual(lines, [
      'dist/index.html:1:4 E602 Links to /paper-demo/ ("Demo"), which is not a page or file in this site. Nothing in the site starts with /paper-demo. If it\'s another site at this address, link to it with its full address (https://u.github.io/paper-demo/).',
    ]);
  });
});

describe('E606: links that leave the base', () => {
  test('a root-relative link or image without the base, and a relative link climbing out', () => {
    const { lines } = verify({
      'index.html': page('/', '<a href="/projects">P</a><img src="/images/a.png" alt=""><a href="../../elsewhere">E</a>'),
      'projects.html': page('/projects', ''),
      'images/a.png': 'png',
    });
    assert.deepEqual(codes(lines), ['E606', 'E606', 'E606']);
    assert.match(lines[0], /Links to \/projects \("P"\), which leaves this site: it is served under \/hangfolio\/, so on GitHub Pages this opens another site or a 404\. Use \/hangfolio\/projects \(\/hangfolio\/projects exists\); in site\.yaml and Markdown, write \/projects and the base is added for you\.$/);
    assert.match(lines[1], /Loads \/images\/a\.png, which leaves this site/);
    assert.match(lines[2], /Links to \.\.\/\.\.\/elsewhere \("E"\), which leaves this site/);
  });

  test('a relative link on 404.html, which GitHub serves at every missing address', () => {
    const { lines } = verify({ '404.html': '<a href="projects">Projects</a><a href="/hangfolio/">Home</a>', 'index.html': '', 'projects.html': '' });
    assert.deepEqual(lines, [
      'dist/404.html:1:4 E606 Links to projects ("Projects"), a relative address. GitHub Pages shows 404.html for every missing address, so it must start with the base path: /hangfolio/projects.',
    ]);
  });

  test('at base /, nothing can leave the base', () => {
    const { lines } = verify({ 'index.html': '<a href="/projects">P</a>', 'projects.html': '' }, { base: '/' });
    assert.deepEqual(lines, []);
  });
});

describe('E607: // in a path', () => {
  test('//projects names a server; /hangfolio//x has an empty segment', () => {
    const { lines } = verify({
      'index.html': page('/', '<a href="//projects">P</a><a href="/hangfolio//projects">P</a><img src="https://u.github.io/hangfolio//a.png" alt="">'),
      'projects.html': '',
      'a.png': '',
    });
    assert.deepEqual(lines.map((line) => line.replace(/^\S+ /, '')), [
      'E607 Links to //projects ("P"), which starts with //, so browsers read "projects" as the name of another server. Use /hangfolio/projects.',
      'E607 Links to /hangfolio//projects ("P"), which has // in its path. Use /hangfolio/projects.',
      'E607 Loads https://u.github.io/hangfolio//a.png, which has // in its path. Use /hangfolio/a.png.',
    ]);
  });
});

describe('E608: the site address', () => {
  test('a canonical or og:url on another origin, outside the base, relative, or on this computer', () => {
    const { lines } = verify({
      'index.html': '<link rel="canonical" href="https://example.com/"><meta property="og:url" content="http://localhost:4321/">',
      'a.html': '<link rel="canonical" href="https://u.github.io/a"><meta property="og:url" content="/hangfolio/a">',
    });
    assert.deepEqual(lines.map((line) => line.replace(/ but th(?:is|e) site.*| which is.*/, '')), [
      'dist/a.html:1:23 E608 The canonical address is https://u.github.io/a,',
      'dist/a.html:1:76 E608 og:url is /hangfolio/a,',
      'dist/index.html:1:23 E608 The canonical address is https://example.com/,',
      'dist/index.html:1:75 E608 og:url is http://localhost:4321/, an address on this computer,',
    ]);
    assert.match(lines[0], /which is outside this site \(https:\/\/u\.github\.io\/hangfolio\/\), so search engines would list the wrong address\.$/);
    assert.match(lines[2], /but this site is built for https:\/\/u\.github\.io\/hangfolio\/, so search engines would list the wrong address\. Build again with the address the site is published at/);
  });

  test('a sitemap or robots.txt naming another site, and a local address in JSON-LD', () => {
    const { lines } = verify({
      'index.html': page('/', '<script type="application/ld+json">{"@id":"http://localhost:4321/#person"}</script>'),
      'sitemap.xml': '<urlset><url><loc>https://u.github.io/</loc></url><url><loc>/hangfolio/</loc></url><url><loc>https://u.github.io/hangfolio/</loc></url></urlset>',
      'robots.txt': 'Sitemap: https://example.com/sitemap.xml\n',
    });
    assert.deepEqual(codes(lines), ['E608', 'E608', 'E608', 'E608']);
    assert.match(lines[0], /^dist\/index\.html:1:\d+ E608 The JSON-LD @id is http:\/\/localhost:4321\/#person, an address on this computer/);
    assert.match(lines[1], /^dist\/robots\.txt:1:10 E608 robots\.txt names the sitemap https:\/\/example\.com\/sitemap\.xml, but this site is built for/);
    assert.match(lines[2], /^dist\/sitemap\.xml:1:19 E608 The sitemap lists https:\/\/u\.github\.io\/, which is outside this site/);
    assert.match(lines[3], /^dist\/sitemap\.xml:1:\d+ E608 The sitemap lists \/hangfolio\/, which is not a full address\./);
  });

  test('a site built for localhost may use localhost', () => {
    const { lines } = verify({ 'index.html': '<link rel="canonical" href="http://localhost:4321/">' }, { origin: 'http://localhost:4321', base: '/' });
    assert.deepEqual(lines, []);
  });
});

describe('E609 and W610: ids and fragments', () => {
  test('an id used twice; ids inside <template> and <a name> are not duplicates', () => {
    const { lines } = verify({
      'index.html': page('/', '<h2 id="news">News</h2>\n<section id="news"></section><template><p id="news"></p></template><a name="news"></a><div id="other"></div>'),
    });
    assert.deepEqual(lines, ['dist/index.html:2:10 E609 The id "news" is used 2 times on this page (first at line 1, column 180). Each id must be unique, so that links to #news and screen readers find the right element.']);
  });

  test('a fragment naming no id, on this page or another, with the closest id suggested', () => {
    const { lines } = verify({
      'index.html': page('/', '<a href="#reserch">R</a><section id="research"></section><a href="/hangfolio/writing/#nope">W</a><a name="legacy"></a><a href="#legacy">L</a>'),
      'writing/index.html': page('/writing/', ''),
    });
    assert.deepEqual(lines.map((line) => line.replace(/^\S+ /, '')), [
      'W610 Links to #reserch ("R"), but this page has no element with id "reserch". Did you mean #research?',
      'W610 Links to /hangfolio/writing/#nope ("W"), but /hangfolio/writing/ has no element with id "nope".',
    ]);
  });
});

describe('W603: sizes', () => {
  test('a file over 50 MB', () => {
    const dist = folder({ 'index.html': '<p>hi</p>', 'files/talk.mp4': '' });
    truncateSync(join(dist, 'files/talk.mp4'), 51 * 1024 * 1024);
    const { issues } = verifyDist({ dist, origin: 'https://u.github.io', base: '/', urlFormat: 'preserve' });
    assert.deepEqual(issues.map((issue) => `${issue.file} ${issue.code} ${issue.message}`), [
      'dist/files/talk.mp4 W603 This file is 51 MB. GitHub Pages works best with files under 50 MB; put it somewhere else and link to it.',
    ]);
  });
});

describe('the scanner', () => {
  test('skips comments, scripts, styles and title text; decodes entities; reads meta refresh', () => {
    const scan = scanHtml(
      '<!-- <a href="/c1"> --><title><a href="/t"></title><script>var s = \'<a href="/s1">\';</script><style>p{background:url(/bg.png)}</style>' +
        '<a href="/x?a=1&amp;b=2" id=plain>x</a><A HREF=\'/y\'>y</A><meta http-equiv="Refresh" content="0;URL=\'/z\'"><svg><use href="#icon"/></svg>',
    );
    assert.deepEqual(scan.refs.map((ref) => `${ref.attr} ${ref.url}`), ['url() /bg.png', 'href /x?a=1&b=2', 'href /y', 'http-equiv="refresh" /z', 'href #icon']);
    assert.deepEqual(scan.ids.map((id) => id.id), ['plain']);
  });

  test('srcset candidates, with commas in data: URLs and descriptors', () => {
    assert.deepEqual(srcsetUrls('/a.png 1x, /b.png 2x,/c.png'), ['/a.png', '/b.png', '/c.png']);
    assert.deepEqual(srcsetUrls('data:image/png;base64,AAA= 1x, /d.png 480w'), ['data:image/png;base64,AAA=', '/d.png']);
  });

  test('CSS url() and @import, ignoring comments', () => {
    assert.deepEqual(cssRefs('/* url(/no.png) */ @import "a.css"; b { src: url( "/f.woff2" ) url(g.png) }').map((ref) => ref.url), ['/f.woff2', 'g.png', 'a.css']);
  });

  test('XML: element text and href attributes, skipping guids that are not links', () => {
    const { root, refs } = scanXml('<feed xmlns="http://www.w3.org/2005/Atom"><link href="https://u.github.io/"/><entry><id>urn:x</id><guid isPermaLink="false">g</guid><link>https://u.github.io/a</link></entry></feed>');
    assert.equal(root, 'feed');
    assert.deepEqual(refs.map((ref) => `${ref.element} ${ref.url}`), ['link https://u.github.io/', 'link https://u.github.io/a']);
  });
});

describe('hangfolio verify', () => {
  const capture = () => {
    let text = '';
    return { stream: { write: (chunk: string) => (text += chunk), isTTY: false }, text: () => text };
  };
  async function cli(root: string, args: string[] = [], env: Record<string, string> = {}) {
    const out = capture();
    const err = capture();
    const code = await runVerify({ root, args, env, out: out.stream, err: err.stream });
    return { code, out: out.text(), err: err.text() };
  }
  const siteYaml = (extra = '') => `name: "Ada Quill"\nemail: "ada@quill.test"\n${extra}`;

  test('exit codes, the report, and the address taken from SITE_PAGES_URL', async () => {
    const root = folder({ 'site.yaml': siteYaml(), 'dist/index.html': page('/', '<a href="/hangfolio/nope">x</a><a href="#gone">y</a>') });
    const failed = await cli(root, [], { SITE_PAGES_URL: 'https://u.github.io/hangfolio' });
    assert.equal(failed.code, 1);
    assert.equal(
      failed.out,
      [
        'hangfolio verify: dist/ for https://u.github.io/hangfolio/ (urlFormat preserve)',
        '1 page, 0 stylesheets, 0 XML files; 3 internal links and file references checked',
        '',
        'Errors',
        '  dist/index.html:1:179  error E602  Links to /hangfolio/nope ("x"), which is not a page or file in this site. Check the spelling, or whether that page is turned off.',
        '',
        'Warnings',
        '  dist/index.html:1:210  warning W610  Links to #gone ("y"), but this page has no element with id "gone".',
        '',
        `1 error, 1 warning. Fix them, then build and verify again. Help: ${docsUrl()} (#e602, #w610)`,
        '',
      ].join('\n'),
    );

    const warnOnly = folder({ 'site.yaml': siteYaml(), 'dist/index.html': page('/', '<a href="#gone">y</a>') });
    const warned = await cli(warnOnly, [], { SITE_PAGES_URL: 'https://u.github.io/hangfolio' });
    assert.equal(warned.code, 0, 'warnings alone pass');
    assert.match(warned.out, /\nNo errors, 1 warning\. Help: /);

    assert.equal((await cli(root, ['--fix'])).code, 2);
    assert.match((await cli(root, ['--fix'])).err, /^hangfolio verify: unknown option --fix\nUsage: hangfolio verify \[folder\] \[--github\]/);
    const missing = await cli(root, ['build']);
    assert.equal(missing.code, 1);
    assert.equal(missing.err, 'hangfolio verify: there is no build/ folder. Build the site first: npx hangfolio build\n');
  });

  test('site.yaml url and advanced.urlFormat win; another folder can be named', async () => {
    const root = folder({
      'site.yaml': siteYaml('url: "https://example.com/site"\nadvanced: { urlFormat: directory }\n'),
      'out/index.html': '<link rel="canonical" href="https://example.com/site/"><a href="/site/about/">About</a>',
      'out/about/index.html': '',
    });
    const result = await cli(root, ['out'], { SITE_PAGES_URL: 'https://u.github.io/other' });
    assert.equal(result.code, 0, result.out);
    assert.equal(result.out.split('\n')[0], 'hangfolio verify: out/ for https://example.com/site/ (urlFormat directory)');
    assert.match(result.out, /\nNo problems\.\n$/);
  });

  test('--github: an annotation per issue and a job summary', async () => {
    const root = folder({ 'site.yaml': siteYaml(), 'dist/index.html': '<link rel="canonical" href="https://elsewhere.test/">' });
    const summary = join(root, 'summary.md');
    writeFileSync(summary, '');
    const result = await cli(root, ['--github'], { SITE_PAGES_URL: 'https://u.github.io', GITHUB_WORKSPACE: root, GITHUB_STEP_SUMMARY: summary });
    assert.equal(result.code, 1);
    const annotation = result.out.split('\n').find((line) => line.startsWith('::'));
    assert.equal(
      annotation,
      '::error file=dist/index.html,line=1,col=23,title=E608 Wrong site address::The canonical address is https://elsewhere.test/, but this site is built for https://u.github.io/, so search engines would list the wrong address. Build again with the address the site is published at (site.yaml url, or the GitHub Pages address).%0AHelp: ' + docsUrl('E608'),
    );
    assert.match(readFileSync(summary, 'utf8'), /^## hangfolio verify\n\n\*\*1 error, 0 warnings\*\* \(1 page and 0 internal links checked for https:\/\/u\.github\.io\/\)\.\n\n\| \| Where \| Code \| What to do \|\n\|---\|---\|---\|---\|\n\| error \| `dist\/index\.html:1:23` \| \[E608\]\(https:\/\/github\.com\/hangfolio\/hangfolio\/blob\/hangfolio@[^/]+\/docs\/troubleshooting\.md#e608\) Wrong site address \| The canonical address is/);
    assert.equal(verifySummary({ issues: [], pages: 2, xml: 0, css: 1, links: 9, bytes: 1 }, 'https://u.github.io/'), '## hangfolio verify\n\nNo problems: 2 pages and 9 internal links checked for https://u.github.io/.\n');
  });

  test('the real command loads through the bin', () => {
    const root = folder({ 'site.yaml': siteYaml(), 'dist/index.html': page('/', '<a href="/hangfolio/">Home</a>') });
    const result = spawnSync(process.execPath, [BIN, 'verify'], { cwd: root, env: { ...process.env, SITE_PAGES_URL: 'https://u.github.io/hangfolio', NO_COLOR: '1' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^hangfolio verify: dist\/ for https:\/\/u\.github\.io\/hangfolio\/ \(urlFormat preserve\)\n1 page, .*\n\nNo problems\.\n$/);
  });
});
