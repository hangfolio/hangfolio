// The M2 scenario (SPEC 5.2): someone copies the starter and edits site.yaml in three steps.
// 1. As copied, it is the demo: banner and noindex on every page, example files included.
// 2. Name and email changed only: the check and the build fail with E401 on tagline, role and
//    affiliation, so nothing fictional is published under a real name.
// 3. Every required field changed: green, every example hidden and listed, no /example/ in dist.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../helpers.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');
// Inside the workspace, so the copy finds hangfolio the way a fixture does.
const SITE = join(REPO, '.tmp/starter-scenario');
const DIST = join(SITE, 'dist');
const PAGES_URL = 'https://mara-quill.github.io';

function run(command: string) {
  const env = { ...process.env, SITE_PAGES_URL: PAGES_URL, NO_COLOR: '1' };
  const result = spawnSync(process.execPath, [BIN, command], { cwd: SITE, env, encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
}

/** `file:line CODE` for each issue the report lists, e.g. "site.yaml:6 E401". */
const reported = (output: string) => [...output.matchAll(/^ {2}(\S+?)(?::(\d+):\d+)? {2}(?:error|warning|notice) ([EWN]\d{3}) /gm)].map((m) => `${m[1]}${m[2] ? `:${m[2]}` : ''} ${m[3]}`);

function editSite(changes: [string, string][]) {
  let text = readFileSync(join(SITE, 'site.yaml'), 'utf8');
  for (const [from, to] of changes) {
    assert.ok(text.includes(from), `site.yaml has ${from}`);
    text = text.replace(from, to);
  }
  writeFileSync(join(SITE, 'site.yaml'), text);
}

const pages = () => listFiles(DIST).filter((file) => file.endsWith('.html'));
const read = (file: string) => readFileSync(join(DIST, file), 'utf8');

describe('starter scenario', () => {
  before(() => {
    rmSync(SITE, { recursive: true, force: true });
    for (const name of ['site.yaml', 'content', 'public', 'astro.config.mjs', 'src', 'package.json']) {
      cpSync(join(REPO, 'starter', name), join(SITE, name), { recursive: true });
    }
  });
  after(() => rmSync(SITE, { recursive: true, force: true }));

  test('1. the starter is the demo: banner and noindex on every page, example files kept', () => {
    const check = run('check');
    assert.equal(check.status, 0, check.output);
    assert.match(check.output, /Demo mode: name and email are still the example ones/);
    assert.deepEqual(reported(check.output), []);

    const build = run('build');
    assert.equal(build.status, 0, build.output);
    for (const file of pages()) {
      assert.match(read(file), /<meta name="robots" content="noindex, follow">/, file);
      assert.match(read(file), /<div class="xbanner" role="note"[^>]*><p[^>]*>This is an example site\. Edit site\.yaml to make it yours\.<\/p><\/div>/, file);
    }
    assert.ok(existsSync(join(DIST, 'example/avatar.jpg')));
    assert.match(read('index.html'), /<img class="avatar" src="\/example\/avatar\.jpg" alt="Portrait of Rowan Vale"/);
  });

  test('2. only name and email changed: E401 on tagline, role and affiliation, and no build', () => {
    editSite([
      ['"Rowan Vale"', '"Mara Quill"'],
      ['"rowan@example.edu"', '"mara@quill.test"'],
    ]);
    const check = run('check');
    assert.equal(check.status, 1, check.output);
    const errors = reported(check.output).filter((line) => / E\d{3}$/.test(line));
    assert.deepEqual(errors, ['site.yaml:6 E401', 'site.yaml:7 E401', 'site.yaml:8 E401']);
    assert.match(check.output, /site\.yaml:6:1 {2}error E401 {2}tagline is still the example text\. Write your own sentence\./);
    assert.match(check.output, /site\.yaml:7:1 {2}error E401 {2}role is still the example text\. Write your own\./);
    assert.match(check.output, /site\.yaml:8:1 {2}error E401 {2}affiliation is still the example \(Example University\)\. Write yours\./);

    rmSync(DIST, { recursive: true, force: true });
    const build = run('build');
    assert.notEqual(build.status, 0);
    assert.match(build.output, /hangfolio check found 3 errors in site\.yaml or content\/ \(listed above\), so nothing was built\./);
    assert.equal(existsSync(join(DIST, 'index.html')), false);
  });

  test('3. every required field changed: green, every example hidden and listed, no /example/ in dist', () => {
    editSite([
      ['"I build storage systems that stay correct when machines fail."', '"I measure tides with gauges that cost less than a bicycle."'],
      ['"PhD student in Computer Science"', '"Oceanographer"'],
      ['{ name: "Example University", url: "https://example.edu" }', '"Harbor Institute"'],
    ]);
    const check = run('check');
    assert.equal(check.status, 0, check.output);
    assert.deepEqual(reported(check.output), [
      'site.yaml:10 W402', // location
      'site.yaml:12 W404', // avatar
      'site.yaml:13 W404', // cv
      'site.yaml:16 W402', // the four links
      'site.yaml:17 W402',
      'site.yaml:18 W402',
      'site.yaml:19 W402',
      'site.yaml:21 W402', // availability
      'site.yaml:28 W402', // booking
      'content/experience.yaml:4 W403',
      'content/experience.yaml:5 W403',
      'content/experience.yaml:6 W403',
      'content/experience.yaml:7 W403',
      'content/home.yaml:2 W403',
      'content/news.yaml:4 W403',
      'content/news.yaml:5 W403',
      'content/projects/tidepool.md:2 W403',
      'content/publications.bib:4 W403',
      'content/publications/vale2024bounded.md:2 W403',
      'content/writing/what-fsync-promises.md:2 W403',
      'public/example W404',
    ]);
    assert.match(check.output, /\nNo errors, 21 examples hidden\./);

    const build = run('build');
    assert.equal(build.status, 0, build.output);
    assert.equal(existsSync(join(DIST, 'example')), false);
    const text = listFiles(DIST).filter((f) => /\.(html|xml|txt|js|css|json|webmanifest)$/.test(f)).map((f) => [f, read(f)] as const);
    for (const [file, content] of text) {
      assert.doesNotMatch(content, /\/example\//, file);
      assert.doesNotMatch(content, /Rowan|Example University|Tidepool|Port Alder|rowan-vale/, file);
    }
    for (const file of pages()) {
      assert.doesNotMatch(read(file), /xbanner/, file);
    }
    const home = read('index.html');
    assert.match(home, /<meta name="robots" content="index, follow/);
    assert.match(home, /<span class="monogram" aria-hidden="true"[^>]*>MQ<\/span>/);
    assert.match(home, /<p class="kicker"[^>]*>Oceanographer · Harbor Institute<\/p>/);
  });
});
