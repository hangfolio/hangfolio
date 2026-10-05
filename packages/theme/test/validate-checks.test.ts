// The checks beyond the schemas: files in public/ (E501, W603), links that include the base
// (W601), the deferred /card messages (W801, W802, N803: off in v0.1), and the report as a whole.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { baseLinkIssues } from '../src/validate/base-links.ts';
import { photoIssue } from '../src/validate/card.ts';
import { findPublicFile, largeFiles } from '../src/validate/files.ts';
import { plainLines } from '../src/validate/format.ts';
import { validateSite } from '../src/validate/index.ts';

const BASE = fileURLToPath(new URL('../../../fixtures/broken/_base/', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'hangfolio-checks-'));
after(() => rmSync(work, { recursive: true, force: true }));

let n = 0;
/** A site from fixtures/broken/_base with these files written on top. */
function site(files: Record<string, string>): string {
  const dir = join(work, `site-${++n}`);
  cpSync(BASE, dir, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const ID = 'name: "Juniper Ash"\nemail: "juniper@ash.test"\n';

test('public files are matched by exact name, with a hint for the near misses', () => {
  const dir = site({ 'public/images/Avatar.JPG': 'x', 'public/files/cv.pdf': 'x' });
  assert.deepEqual(findPublicFile(dir, '/images/Avatar.JPG'), { exists: true });
  assert.deepEqual(findPublicFile(dir, 'files/cv.pdf'), { exists: true });
  assert.deepEqual(findPublicFile(dir, '/images/avatar.jpg'), { exists: false, hint: 'Did you mean /images/Avatar.JPG? File names are case-sensitive on GitHub Pages.' });
  assert.deepEqual(findPublicFile(dir, '/imagez/me.jpg'), { exists: false, hint: 'Did you mean /images/me.jpg?' });
  assert.deepEqual(findPublicFile(dir, '/talks/me.pdf'), { exists: false, hint: 'There is no public/talks folder.' });
  assert.deepEqual(findPublicFile(dir, '/files'), { exists: false, hint: 'public/files is a folder, not a file.' });
});

test('a file path that already has the base says what to write', async () => {
  const dir = site({ 'site.yaml': `${ID}url: "https://u.github.io/my-site"\ncv: "/my-site/files/cv.pdf"\n`, 'public/files/cv.pdf': 'x' });
  const report = await validateSite(dir, { env: {} });
  assert.equal(plainLines(report.issues), "site.yaml:4:1 E501 cv: /my-site/files/cv.pdf doesn't exist. It starts with your base path (/my-site); write /files/cv.pdf.");
});

test('a file path that starts with public/ says to leave it out', async () => {
  const dir = site({ 'site.yaml': `${ID}avatar: "public/images/me.jpg"\ncv: "/public/files/cv.pfd"\n`, 'public/images/me.jpg': 'x', 'public/files/cv.pdf': 'x' });
  const report = await validateSite(dir, { env: {} });
  assert.equal(
    plainLines(report.issues),
    [
      "site.yaml:3:1 E501 avatar: public/images/me.jpg doesn't exist. Leave out public/ (paths start inside it): /images/me.jpg",
      "site.yaml:4:1 E501 cv: /public/files/cv.pfd doesn't exist. Leave out public/ (paths start inside it). Did you mean /files/cv.pdf?",
    ].join('\n'),
  );
});

test('W601 finds Markdown links, HTML attributes and YAML values that include the base', () => {
  const text = 'A [link](/my-site/projects) and <a href="/my-site">home</a>.\nurl: "/my-site/x.pdf"\n![img](/my-site-2/x.png)\n';
  assert.deepEqual(
    baseLinkIssues('content/writing/x.md', text, '/my-site/').map((i) => `${i.line}:${i.col} ${i.message}`),
    ['1:10 /my-site/projects already includes your base path. Write /projects.', '1:42 /my-site already includes your base path. Write /.', '2:7 /my-site/x.pdf already includes your base path. Write /x.pdf.'],
  );
  assert.deepEqual(baseLinkIssues('site.yaml', '# url: /my-site/x\n', '/my-site'), []);
  assert.deepEqual(baseLinkIssues('site.yaml', 'url: /my-site/x\n', '/'), []);
});

test('W603: a file over 50 MB in public/', () => {
  const dir = site({ 'public/files/small.txt': 'x', 'public/files/talk.mp4': '' });
  // A sparse 51 MB file: it takes no disk space.
  truncateSync(join(dir, 'public/files/talk.mp4'), 51 * 1024 * 1024);
  assert.deepEqual(largeFiles(dir).map((i) => `${i.file} ${i.code} ${i.message}`), [
    'public/files/talk.mp4 W603 This file is 51 MB. GitHub Pages works best with files under 50 MB; put it somewhere else and link to it.',
  ]);
});

test('W802: without sharp, only a JPEG or PNG of 64 KB or less goes into card.vcf', () => {
  const dir = site({ 'public/images/a.png': 'x'.repeat(1000), 'public/images/b.png': 'x'.repeat(70_000), 'public/images/c.webp': 'x' });
  assert.deepEqual(photoIssue(dir, '/images/a.png', false, undefined, false), []);
  assert.deepEqual(photoIssue(dir, '/images/b.png', true, undefined, false), []);
  const [big] = photoIssue(dir, '/images/b.png', false, undefined, false);
  assert.equal(big.message, 'The avatar (68 KB PNG) is too large to embed in card.vcf without resizing, so the contact file has no photo. Use a JPEG or PNG under 64 KB if you want one.');
  assert.equal(big.file, 'public/images/b.png');
  assert.match(photoIssue(dir, '/images/c.webp', false, undefined, false)[0].message, /^The avatar \(1 bytes WebP\) can't be embedded in card.vcf in that format/);
});

test('the card checks stay off while the /card page is deferred, even with pages.card set', async () => {
  assert.deepEqual((await validateSite(site({}), { mode: 'dev', env: {} })).issues, []);
  const dir = site({ 'site.yaml': `${ID}pages: { card: true }\n`, 'public/images/avatar.heic': 'x' });
  assert.deepEqual((await validateSite(dir, { mode: 'dev', env: {} })).issues, []);
  // A long address from the repository name (SPEC 7.1) would be W801 with the card on.
  const github = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'a-research-group-with-a-long-name/tide-gauges-for-small-harbours-and-estuaries' };
  assert.deepEqual((await validateSite(dir, { env: github })).issues, []);
});

test('a site without site.yaml gets one error that says what to add', async () => {
  const dir = site({});
  rmSync(join(dir, 'site.yaml'));
  const report = await validateSite(dir, { env: {} });
  assert.equal(plainLines(report.issues), 'site.yaml E203 There is no site.yaml next to package.json. Every site needs one, with at least name: and email: lines.');
  assert.equal(report.visible, undefined);
});

test('in demo mode nothing is hidden and no example value is an error', async () => {
  const dir = site({ 'site.yaml': 'name: "Rowan Vale"\nemail: "rowan@example.edu"\ntagline: "I build storage systems that stay correct when machines fail."\navatar: "/example/avatar.jpg"\n', 'public/example/avatar.jpg': 'x' });
  const report = await validateSite(dir, { env: {} });
  assert.equal(report.demo, true);
  assert.deepEqual(report.issues, []);
  assert.equal(report.visible?.avatar, '/example/avatar.jpg');
});

test('a reference to a hidden example is broken outside demo mode', async () => {
  const dir = site({
    'content/publications.bib': '@article{vale2024bounded,\n  example = {true},\n  title = {X}\n}\n',
    'content/home.yaml': 'research:\n  featured: vale2024bounded\n',
  });
  const report = await validateSite(dir, { env: {} });
  assert.equal(
    plainLines(report.issues.filter((i) => i.code === 'E302')),
    "content/home.yaml:2:3 E302 research.featured is 'vale2024bounded', an example paper that is hidden on your site. Feature one of your own papers, or delete the line.",
  );
});
