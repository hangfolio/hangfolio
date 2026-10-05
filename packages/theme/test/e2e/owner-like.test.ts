// M3: fixtures/owner-like, the fictional site shaped like the reference design's home page (the
// local fidelity check compares the two side by side). It checks clean, builds at base / and
// /hangfolio with every internal link under the base, and its home page has the reference
// design's sections, in order, with the reference design's ids.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildFixture } from './fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');

test('hangfolio check finds nothing to report in fixtures/owner-like', () => {
  const result = spawnSync(process.execPath, [BIN, 'check'], { cwd: join(REPO, 'fixtures/owner-like'), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, 'hangfolio check: site.yaml and 16 files in content/\n\nNo errors.\n');
});

for (const pagesUrl of ['https://u.github.io', 'https://u.github.io/hangfolio']) {
  describe(`fixtures/owner-like home page with SITE_PAGES_URL=${pagesUrl}`, () => {
    const base = new URL(pagesUrl).pathname.replace(/\/$/, '');
    let html = '';
    let main = '';
    before(() => {
      html = readFileSync(join(buildFixture('owner-like', pagesUrl), 'index.html'), 'utf8');
      main = html.match(/<main[^>]*>(.*)<\/main>/s)![1];
    });

    test('every root-relative href and src stays under the base, with no //', () => {
      const refs = [...html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
      assert.ok(refs.length > 5);
      for (const ref of refs) {
        assert.ok(!ref.includes('//'), `${ref} contains //`);
        if (base) assert.match(ref, new RegExp(`^${base}(/|$)`), `${ref} escapes ${base}`);
      }
      assert.match(html, new RegExp(`<a href="${base}/#research" class="quiet"[^>]*>Research</a>`));
      assert.match(main, new RegExp(`<a href="${base}/files/morrow2024idle.pdf">\\[PDF\\]</a>`));
    });

    test("the sections, in order, with the reference design's ids", () => {
      const sections = [...main.matchAll(/<section [^>]*aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(sections, ['name', 'results', 'work', 'research-h', 'exp', 'news', 'writing', 'contact']);
      assert.match(main, /<section id="research" class="block" aria-labelledby="research-h" data-section="research"><div class="sec-head"><h2 id="research-h" class="eyebrow">Research<\/h2>/);
      assert.match(main, /<div class="hang pub" id="publication"><div class="m"><span>2024<\/span><\/div>/);
      // Education joins Experience, under its own id
      assert.match(main, /data-section="experience">.*<ol class="jobs">.*<\/ol><div class="hang edu" id="education"><div class="m label">Education<\/div>/s);
    });

    test('four featured projects, five jobs, three education lines, four news items and two posts', () => {
      const count = (re: RegExp) => [...main.matchAll(re)].length;
      assert.equal(count(/<li class="hang featured">/g), 4);
      assert.equal(count(/<span class="big/g), 4);
      assert.equal(count(/<ol class="approach">.*?<\/ol>/gs), 1);
      assert.equal(count(/<li><span class="num">/g), 3);
      assert.equal(count(/<span class="org">/g), 5);
      assert.equal(count(/<span class="yr">/g), 3);
      assert.equal(count(/<time datetime="\d{4}-\d{2}">/g), 4);
      assert.equal(count(/<ul class="posts"><li>.*?<\/li><li>.*?<\/li><\/ul>/gs), 1);
      assert.doesNotMatch(main, /Notes on power caps/, 'the draft post is left out');
      assert.match(main, /<span class="n">04<\/span><span>NSX ’24<\/span>/);
    });
  });
}
