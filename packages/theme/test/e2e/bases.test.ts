// M1: fixtures/minimal builds at base / and at /hangfolio, renders the header, footer and theme
// toggle, and no root-relative link escapes the base.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';
import { listFiles } from '../helpers.ts';
import { buildFixture } from './fixture.ts';

const SITES = ['https://u.github.io', 'https://u.github.io/hangfolio'];

for (const pagesUrl of SITES) {
  describe(`fixtures/minimal with SITE_PAGES_URL=${pagesUrl}`, () => {
    const base = new URL(pagesUrl).pathname.replace(/\/$/, '');
    const home = `${pagesUrl}/`;
    let dist = '';
    let pages: string[] = [];
    const read = (file: string) => readFileSync(join(dist, file), 'utf8');

    // Each suite builds in before(), so the second build cannot overwrite dist/ under the first.
    before(() => {
      dist = buildFixture('minimal', pagesUrl);
      pages = listFiles(dist).filter((file) => file.endsWith('.html'));
    });

    test('writes the expected pages and public files', () => {
      assert.deepEqual(pages, ['404.html', 'contact.html', 'index.html', 'writing/first-note/index.html', 'writing/index.html']);
      for (const file of ['favicon.svg', 'files/cv.pdf', 'colophon.txt']) assert.ok(listFiles(dist).includes(file), file);
    });

    test('every root-relative href and src stays under the base, with no //', () => {
      for (const file of pages) {
        const refs = [...read(file).matchAll(/\b(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
        assert.ok(refs.length > 0, `${file} has no root-relative references`);
        for (const ref of refs) {
          assert.ok(!ref.startsWith('//'), `${file}: ${ref} starts with //`);
          assert.ok(!ref.includes('//'), `${file}: ${ref} contains //`);
          if (base) assert.match(ref, new RegExp(`^${base}(/|$)`), `${file}: ${ref} escapes ${base}`);
        }
      }
    });

    test('the canonical, og:url and JSON-LD ids use the full site URL', () => {
      const html = read('index.html');
      assert.match(html, new RegExp(`<link rel="canonical" href="${home}">`));
      assert.match(html, new RegExp(`<meta property="og:url" content="${home}">`));
      const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
      assert.deepEqual(graph['@graph'].map((node: { '@id': string }) => node['@id']), [`${home}#website`, `${home}#person`]);
    });

    test('the 404 page is noindex and links home through the base', () => {
      const html = read('404.html');
      assert.match(html, /<meta name="robots" content="noindex, follow">/);
      assert.doesNotMatch(html, /rel="canonical"/);
      assert.match(html, new RegExp(`<a href="${base}/">Home</a>`));
    });

    test('the header, footer and theme toggle render', () => {
      for (const file of pages) {
        const html = read(file);
        assert.match(html, new RegExp(`<a href="${base}/" class="quiet home"[^>]*>u\\.github\\.io</a>`), `${file}: brand`);
        assert.match(html, new RegExp(`<a href="${base}/files/cv.pdf" class="quiet"[^>]*>CV</a>`), `${file}: nav`);
        assert.match(html, /<button type="button" class="tgl" data-theme-toggle aria-label="Switch to dark theme"/, `${file}: toggle`);
        assert.match(html, /<footer class="foot"[^>]*>/, `${file}: footer`);
        assert.match(html, /<a href="https:\/\/github\.com\/hangfolio\/hangfolio"[^>]*>GitHub<\/a>/, `${file}: footer link`);
        assert.match(html, new RegExp(`<a href="${base}/colophon.txt"[^>]*>Colophon</a>`), `${file}: footer.links`);
        assert.match(html, /© \d{4} Wren Halloway/, `${file}: copyright`);
        assert.match(html, /<meta name="theme-color" content="#f5f7fa">/, `${file}: theme-color`);
      }
    });
  });
}
