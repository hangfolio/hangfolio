// The build matrix (SPEC 10.2): every site (the starter and each fixture with a package.json) at
// base / and /hangfolio, in urlFormat 'preserve' and 'directory', built with the hangfolio command
// in a copy under .tmp/matrix/ and checked with `hangfolio verify`. Run with `npm run test:matrix`.
// Any verify issue fails, warnings included, apart from the PENDING links below.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { verifyDist, type VerifyIssue } from '../../src/lib/verify.ts';
import { where } from '../../src/validate/format.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');
const OUT = join(REPO, '.tmp/matrix');
const ORIGIN = 'https://u.github.io';
const BASES = ['/', '/hangfolio'];
const FORMATS = ['preserve', 'directory'] as const;

const SITES = [
  'starter',
  ...readdirSync(join(REPO, 'fixtures'))
    .filter((name) => existsSync(join(REPO, 'fixtures', name, 'package.json')))
    .sort()
    .map((name) => `fixtures/${name}`),
];

/**
 * Links to pages and files that milestones being built alongside this one add (M4: projects,
 * experience and writing pages; M5: publications; M9: the starter's paper PDF). Each entry is an
 * exact path under the base, expected as E602 in every build of that site. Once the page exists,
 * the matrix fails until the entry is removed, so nothing stays hidden here by accident.
 */
const PENDING: Record<string, string[]> = {
  starter: ['/experience', '/files/vale2024bounded.pdf', '/projects/tidepool/', '/publications', '/writing/what-fsync-promises/'],
  'fixtures/minimal': ['/writing/first-note/'],
  'fixtures/kitchen-sink': ['/writing/bottom-up/', '/writing/cache-lied/'],
  'fixtures/owner-like': ['/writing/idle-radio-drain/', '/writing/pondskip-flaky-tests/'],
};

function run(cwd: string, args: string[], base: string, extra: Record<string, string | undefined> = { SITE_PAGES_URL: `${ORIGIN}${base === '/' ? '' : base}` }) {
  const env = { ...process.env, GITHUB_ACTIONS: undefined, GITHUB_REPOSITORY: undefined, SITE_PAGES_URL: undefined, NO_COLOR: '1', ...extra };
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd, env, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const line = (issue: VerifyIssue) => `${where(issue)} ${issue.code} ${issue.message}`;

for (const dir of SITES) {
  for (const format of FORMATS) {
    describe(`${dir}, urlFormat ${format}`, () => {
      const site = join(OUT, `${basename(dir)}-${format}`);

      before(() => {
        rmSync(site, { recursive: true, force: true });
        const skip = new Set(['dist', 'node_modules', '.astro']);
        cpSync(join(REPO, dir), site, { recursive: true, filter: (src) => !skip.has(basename(src)) });
        const file = join(site, 'site.yaml');
        const doc = parseDocument(readFileSync(file, 'utf8'));
        if ((doc.getIn(['advanced', 'urlFormat']) ?? 'preserve') !== format) {
          doc.setIn(['advanced', 'urlFormat'], format);
          writeFileSync(file, doc.toString());
        }
      });
      after(() => rmSync(site, { recursive: true, force: true }));

      for (const base of BASES) {
        test(`base ${base}: builds, and verify passes`, () => {
          const build = run(site, ['build'], base);
          assert.equal(build.status, 0, `hangfolio build failed:\n${build.output}`);

          const result = verifyDist({ dist: join(site, 'dist'), origin: ORIGIN, base, urlFormat: format });
          assert.ok(result.pages > 0 && result.links > 0, `verify checked ${result.pages} pages and ${result.links} links`);
          const pending = PENDING[dir] ?? [];
          const unexpected = result.issues.filter((issue) => !(issue.code === 'E602' && issue.target && pending.includes(issue.target)));
          assert.deepEqual(unexpected.map(line), [], `hangfolio verify found problems:\n${unexpected.map(line).join('\n')}`);
          const resolved = pending.filter((path) => !result.issues.some((issue) => issue.target === path));
          assert.deepEqual(resolved, [], `these pending links now resolve; remove them from PENDING in test/matrix/matrix.test.ts: ${resolved.join(', ')}`);

          // The command adopters' builds run says the same.
          const verify = run(site, ['verify'], base);
          const errors = result.issues.some((issue) => issue.code.startsWith('E'));
          assert.equal(verify.status, errors ? 1 : 0, verify.output);
          if (result.issues.length === 0) assert.match(verify.output, /\nNo problems\.\n$/);
          assert.match(verify.output, new RegExp(`^hangfolio verify: dist/ for ${ORIGIN}${base === '/' ? '/' : `${base}/`} \\(urlFormat ${format}\\)\\n`));
        });
      }
    });
  }
}

// A validation build on GitHub before Pages is set up (SPEC 7.1, source 3): no SITE_PAGES_URL, so
// build and verify both take the address from the repository name. The two fixtures named for
// these cases link to their neighbours on https://u.github.io with full addresses.
describe('the address from the repository name, as on GitHub before Pages is set up', () => {
  const cases = [
    { dir: 'fixtures/user-site', repository: 'u/u.github.io', home: `${ORIGIN}/` },
    { dir: 'fixtures/project-site', repository: 'u/field-notes', home: `${ORIGIN}/field-notes/` },
  ];
  for (const { dir, repository, home } of cases) {
    test(`${dir} as ${repository}: built and verified for ${home}`, (t) => {
      if (!existsSync(join(REPO, dir))) return t.skip(`${dir} does not exist`);
      const site = join(OUT, `${basename(dir)}-repository`);
      rmSync(site, { recursive: true, force: true });
      cpSync(join(REPO, dir), site, { recursive: true, filter: (src) => !['dist', 'node_modules', '.astro'].includes(basename(src)) });
      try {
        const github = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository };
        const build = run(site, ['build'], '/', github);
        assert.equal(build.status, 0, `hangfolio build failed:\n${build.output}`);
        assert.match(readFileSync(join(site, 'dist/index.html'), 'utf8'), new RegExp(`<link rel="canonical" href="${home.replace(/\./g, '\\.')}">`));
        const verify = run(site, ['verify'], '/', github);
        assert.equal(verify.status, 0, verify.output);
        assert.equal(verify.output.split('\n')[0], `hangfolio verify: dist/ for ${home} (urlFormat preserve)`);
        assert.match(verify.output, /\nNo problems\.\n$/);
      } finally {
        rmSync(site, { recursive: true, force: true });
      }
    });
  }
});
