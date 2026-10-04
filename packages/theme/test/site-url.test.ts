// SPEC 7.1: site.yaml url, then SITE_PAGES_URL, then the repository name on GitHub, then local dev.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSiteUrl } from '../src/lib/site-url.ts';

const pick = ({ origin, base, source }: { origin: string; base: string; source: string }) => ({ origin, base, source });

test('local dev without any URL', () => {
  assert.deepEqual(pick(resolveSiteUrl(undefined, {})), { origin: 'http://localhost:4321', base: '/', source: 'local' });
});

test('SITE_PAGES_URL: user site, project site, custom domain, inherited domain', () => {
  const cases = {
    'https://u.github.io': ['https://u.github.io', '/'],
    'https://u.github.io/': ['https://u.github.io', '/'],
    'https://u.github.io/hangfolio': ['https://u.github.io', '/hangfolio'],
    'https://u.github.io/hangfolio/': ['https://u.github.io', '/hangfolio'],
    'https://example.com': ['https://example.com', '/'],
    'https://example.com/repo': ['https://example.com', '/repo'],
  };
  for (const [value, [origin, base]] of Object.entries(cases)) {
    assert.deepEqual(pick(resolveSiteUrl(undefined, { SITE_PAGES_URL: value })), { origin, base, source: 'SITE_PAGES_URL' }, value);
  }
});

test('an empty SITE_PAGES_URL counts as unset', () => {
  assert.equal(resolveSiteUrl(undefined, { SITE_PAGES_URL: '' }).source, 'local');
});

test('site.yaml url wins over SITE_PAGES_URL, with a warning when they differ', () => {
  const same = resolveSiteUrl('https://example.com', { SITE_PAGES_URL: 'https://example.com/' });
  assert.deepEqual(pick(same), { origin: 'https://example.com', base: '/', source: 'site.yaml' });
  assert.equal(same.warning, undefined);

  const differ = resolveSiteUrl('https://example.com', { SITE_PAGES_URL: 'https://u.github.io/site' });
  assert.deepEqual(pick(differ), { origin: 'https://example.com', base: '/', source: 'site.yaml' });
  assert.match(differ.warning ?? '', /site\.yaml says https:\/\/example\.com but GitHub Pages serves https:\/\/u\.github\.io\/site; using site\.yaml/);
});

test('validation builds on GitHub use the repository name', () => {
  const ci = (repo: string) => pick(resolveSiteUrl(undefined, { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repo }));
  assert.deepEqual(ci('Someone/someone.github.io'), { origin: 'https://someone.github.io', base: '/', source: 'GITHUB_REPOSITORY' });
  assert.deepEqual(ci('someone/Someone.GitHub.io'), { origin: 'https://someone.github.io', base: '/', source: 'GITHUB_REPOSITORY' });
  assert.deepEqual(ci('someone/website'), { origin: 'https://someone.github.io', base: '/website', source: 'GITHUB_REPOSITORY' });
  assert.deepEqual(ci('someone/other.github.io'), { origin: 'https://someone.github.io', base: '/other.github.io', source: 'GITHUB_REPOSITORY' });
});

test('outside GitHub Actions the repository name is ignored (Codespaces sets it too)', () => {
  assert.equal(resolveSiteUrl(undefined, { GITHUB_REPOSITORY: 'someone/website' }).source, 'local');
});

test('a URL that is not absolute fails with a clear message', () => {
  assert.throws(() => resolveSiteUrl('example.com', {}), /site\.yaml url must be an absolute URL/);
  assert.throws(() => resolveSiteUrl(undefined, { SITE_PAGES_URL: '/repo' }), /SITE_PAGES_URL must be an absolute URL/);
});
