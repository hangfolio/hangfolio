import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { absUrl, url } from '../src/lib/url.ts';

// Astro's BASE_URL can arrive with or without a trailing slash; both must give the same result.
const BASES = { root: ['/', ''], project: ['/hangfolio', '/hangfolio/'] };

describe('url() at base /', () => {
  for (const base of BASES.root) {
    test(`base ${JSON.stringify(base)}`, () => {
      assert.equal(url('/', base), '/');
      assert.equal(url('', base), '/');
      assert.equal(url('/projects', base), '/projects');
      assert.equal(url('projects', base), '/projects');
      assert.equal(url('/writing/', base), '/writing/');
      assert.equal(url('/writing/a-post/', base), '/writing/a-post/');
      assert.equal(url('/files/cv.pdf', base), '/files/cv.pdf');
      assert.equal(url('/#research', base), '/#research');
      assert.equal(url('/projects?tab=all#x', base), '/projects?tab=all#x');
    });
  }
});

describe('url() at base /hangfolio', () => {
  for (const base of BASES.project) {
    test(`base ${JSON.stringify(base)}`, () => {
      assert.equal(url('/', base), '/hangfolio/');
      assert.equal(url('', base), '/hangfolio/');
      assert.equal(url('/projects', base), '/hangfolio/projects');
      assert.equal(url('projects', base), '/hangfolio/projects');
      assert.equal(url('files/cv.pdf', base), '/hangfolio/files/cv.pdf');
      assert.equal(url('/writing/', base), '/hangfolio/writing/');
      assert.equal(url('/writing/a-post/', base), '/hangfolio/writing/a-post/');
      assert.equal(url('/#research', base), '/hangfolio/#research');
      assert.equal(url('?q=1', base), '/hangfolio/?q=1');
      assert.equal(url('/projects?tab=all#x', base), '/hangfolio/projects?tab=all#x');
    });
  }
});

test('url() never emits //', () => {
  for (const base of [...BASES.root, ...BASES.project, '//hangfolio//']) {
    // A value starting with // is a protocol-relative URL, so it passes through untouched instead.
    for (const path of ['/a//b', 'a//b/', '/a///b//c', '/a/b//', '']) {
      const out = url(path, base);
      assert.ok(!out.includes('//'), `${JSON.stringify(path)} at ${JSON.stringify(base)} gave ${out}`);
    }
  }
  assert.equal(url('/a//b', '/hangfolio/'), '/hangfolio/a/b');
  assert.equal(url('/a/b//', '/'), '/a/b/');
  assert.equal(url('/x', '//hangfolio//'), '/hangfolio/x');
});

test('url() leaves absolute, mailto:, tel:, #fragment and protocol-relative URLs alone', () => {
  const unchanged = [
    'https://example.org/a//b',
    'http://example.org',
    'HTTPS://EXAMPLE.ORG/X',
    'mailto:someone@example.org',
    'tel:+15550100',
    '#main',
    '#',
    '//cdn.example.org/lib.js',
    'data:image/svg+xml,%3Csvg%3E',
  ];
  for (const base of [...BASES.root, ...BASES.project]) {
    for (const href of unchanged) assert.equal(url(href, base), href);
  }
});

test('url() does not guess: a path that already includes the base is prefixed again', () => {
  // SPEC 5.1: prefixing is never guessed. A site whose repo is named like a route needs this.
  assert.equal(url('/hangfolio/projects', '/hangfolio'), '/hangfolio/hangfolio/projects');
});

describe('absUrl()', () => {
  const site = 'https://u.github.io';
  test('at base /', () => {
    for (const base of BASES.root) {
      assert.equal(absUrl('/', site, base), 'https://u.github.io/');
      assert.equal(absUrl('/projects', site, base), 'https://u.github.io/projects');
      assert.equal(absUrl('/writing/a-post/', site, base), 'https://u.github.io/writing/a-post/');
      assert.equal(absUrl('#person', site, base), 'https://u.github.io/#person');
    }
  });
  test('at base /hangfolio', () => {
    for (const base of BASES.project) {
      assert.equal(absUrl('/', site, base), 'https://u.github.io/hangfolio/');
      assert.equal(absUrl('', site, base), 'https://u.github.io/hangfolio/');
      assert.equal(absUrl('/projects', site, base), 'https://u.github.io/hangfolio/projects');
      assert.equal(absUrl('files/cv.pdf', site, base), 'https://u.github.io/hangfolio/files/cv.pdf');
      assert.equal(absUrl('/a//b', site, base), 'https://u.github.io/hangfolio/a/b');
      assert.equal(absUrl('#person', site, base), 'https://u.github.io/hangfolio/#person');
    }
  });
  test('a custom domain, and a site value with a trailing slash', () => {
    assert.equal(absUrl('/projects', 'https://example.com', '/'), 'https://example.com/projects');
    assert.equal(absUrl('/projects', 'https://example.com/', '/repo/'), 'https://example.com/repo/projects');
  });
  test('absolute URLs pass through', () => {
    assert.equal(absUrl('https://example.org/x', site, '/hangfolio'), 'https://example.org/x');
    assert.equal(absUrl('mailto:someone@example.org', site, '/hangfolio'), 'mailto:someone@example.org');
    assert.equal(absUrl('//cdn.example.org/x', site, '/hangfolio'), 'https://cdn.example.org/x');
  });
});
