import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inferLabel, normalizeLinks } from '../src/lib/links.ts';
import { navItems, availablePages } from '../src/lib/nav.ts';
import type { SiteYaml } from '../src/lib/site.ts';

test('labels are inferred from the host (SPEC 5.1)', () => {
  assert.equal(inferLabel('https://github.com/someone'), 'GitHub');
  assert.equal(inferLabel('https://scholar.google.com/citations?user=x'), 'Google Scholar');
  assert.equal(inferLabel('https://orcid.org/0000-0002-1825-0097'), 'ORCID');
  assert.equal(inferLabel('https://www.linkedin.com/in/someone'), 'LinkedIn');
  assert.equal(inferLabel('https://twitter.com/someone'), 'X');
  assert.equal(inferLabel('https://x.com/someone'), 'X');
  assert.equal(inferLabel('https://bsky.app/profile/someone'), 'Bluesky');
  assert.equal(inferLabel('https://blog.example.org/'), 'blog.example.org');
});

test('links: bare URLs and objects, with defaults and ids', () => {
  const links = normalizeLinks([
    'https://github.com/someone',
    { url: 'https://orcid.org/0000-0002-1825-0097', label: 'ORCID iD' },
    { url: 'https://www.linkedin.com/in/someone', contact: false, id: 'li' },
  ]);
  assert.deepEqual(links, [
    { url: 'https://github.com/someone', label: 'GitHub', id: 'github', hero: true, contact: true, footer: true },
    { url: 'https://orcid.org/0000-0002-1825-0097', label: 'ORCID iD', id: 'orcid-id', hero: true, contact: true, footer: true },
    { url: 'https://www.linkedin.com/in/someone', label: 'LinkedIn', id: 'li', hero: true, contact: false, footer: true },
  ]);
  assert.deepEqual(normalizeLinks(undefined), []);
});

test('nav: only pages that exist, in order, plus explicit {label, href} items', () => {
  const site = { name: 'A', email: 'a@b.test', cv: '/files/cv.pdf' } as SiteYaml;
  assert.deepEqual(navItems(site, availablePages(site)), [{ key: 'cv', label: 'CV', href: '/files/cv.pdf' }]);
  assert.deepEqual(navItems({ ...site, cv: undefined }, availablePages({ ...site, cv: undefined })), []);
  const explicit = { ...site, nav: ['projects', { label: 'Notes', href: '/notes' }, 'cv'] } as SiteYaml;
  assert.deepEqual(navItems(explicit, availablePages(explicit)), [
    { label: 'Notes', href: '/notes' },
    { key: 'cv', label: 'CV', href: '/files/cv.pdf' },
  ]);
});

// SPEC 7.2: every internal href and src in the theme goes through url(), so no template may
// write a root-relative value literally.
test('no theme template writes a literal root-relative href or src', () => {
  const src = fileURLToPath(new URL('../src/', import.meta.url));
  const files = readdirSync(src, { recursive: true }).map(String).filter((f) => f.endsWith('.astro'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const text = readFileSync(join(src, file), 'utf8');
    assert.doesNotMatch(text, /\b(?:href|src)=["'`]\//, `${file} has a literal root-relative href or src`);
    assert.doesNotMatch(text, /\b(?:href|src)=\{`\//, `${file} builds a root-relative href or src without url()`);
  }
});
