// fixtures/empty (SPEC 5.1): a site.yaml with only name and email passes the checks and builds
// green at both bases, with every optional part hidden and an initials monogram for the avatar.
// The contact page stays: its content, the email address, is never missing.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../helpers.ts';
import { buildFixture } from './fixture.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');

test('hangfolio check finds nothing to report', () => {
  const result = spawnSync(process.execPath, [BIN, 'check'], { cwd: join(REPO, 'fixtures/empty'), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'hangfolio check: site.yaml and 0 files in content/\n\nNo errors.\n');
});

for (const pagesUrl of ['https://u.github.io', 'https://u.github.io/hangfolio']) {
  describe(`fixtures/empty with SITE_PAGES_URL=${pagesUrl}`, () => {
    const base = new URL(pagesUrl).pathname.replace(/\/$/, '');
    let dist = '';
    before(() => {
      dist = buildFixture('empty', pagesUrl);
    });

    test('builds the home, contact and 404 pages, indexable, with no example banner', () => {
      assert.deepEqual(listFiles(dist).filter((f) => f.endsWith('.html')), ['404.html', 'contact.html', 'index.html']);
      const html = readFileSync(join(dist, 'index.html'), 'utf8');
      assert.match(html, /<meta name="robots" content="index, follow/);
      assert.match(html, new RegExp(`<link rel="canonical" href="${pagesUrl}/">`));
      assert.doesNotMatch(html, /xbanner/);
    });

    test('shows the initials instead of a photo, and no empty sections', () => {
      const html = readFileSync(join(dist, 'index.html'), 'utf8');
      assert.match(html, /<span class="monogram" aria-hidden="true"[^>]*>SB<\/span>/);
      assert.doesNotMatch(html, /<img /);
      assert.match(html, new RegExp(`<nav aria-label="Elsewhere" class="row"[^>]*><a href="${base}/contact"[^>]*>Contact</a></nav>`));
      assert.match(html, new RegExp(`<nav class="nav" aria-label="Primary"[^>]*><a href="${base}/contact" class="quiet"[^>]*>Contact</a></nav>`));
      assert.match(html, new RegExp(`<a href="${base}/" class="quiet home"`));
    });
  });
}
