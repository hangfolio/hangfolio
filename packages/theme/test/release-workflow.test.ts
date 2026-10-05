// The release workflow (.github/workflows/release.yml, docs/maintaining.md): changesets on pushes
// to main, a "Version packages" pull request, and npm trusted publishing with provenance. Only the
// publish job can mint an OIDC token, and no npm token appears anywhere.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { cleanUp, fakeCommand, folder, readRepo, runStep, step, workflow, type Job } from './workflow-steps.ts';

after(cleanUp);

const FILE = '.github/workflows/release.yml';
const text = readRepo(FILE);
const release = workflow(FILE) as ReturnType<typeof workflow> & { concurrency: Record<string, unknown> };
const jobs = Object.entries(release.jobs) as [string, Job & { environment?: string; 'timeout-minutes'?: number }][];
const steps = jobs.flatMap(([, job]) => job.steps ?? []);
const uses = (prefix: string) => steps.filter((s) => s.uses?.startsWith(prefix));

test('runs on pushes to main only, never cancels a publish, and skips forks', () => {
  assert.deepEqual(release.on, { push: { branches: ['main'] } });
  assert.equal(release.concurrency['cancel-in-progress'], false);
  assert.equal(release.jobs['select-mode'].if, "github.repository == 'hangfolio/hangfolio'");
  assert.deepEqual(release.jobs.version.needs, 'select-mode');
  assert.deepEqual(release.jobs.pack.needs, 'select-mode');
  assert.deepEqual(release.jobs.publish.needs, 'pack');
  for (const [name, job] of jobs) assert.ok((job['timeout-minutes'] ?? 0) > 0 && (job['timeout-minutes'] ?? 0) <= 30, name);
});

test('every action is pinned to a full commit SHA, with its version in a comment', () => {
  const found = [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)];
  assert.ok(found.length > 0);
  for (const [, ref, comment] of found) {
    assert.match(ref, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${ref} is not pinned to a commit SHA`);
    assert.match(comment, /^ # v\d+\.\d+\.\d+$/, `${ref} needs a "# vX.Y.Z" comment`);
  }
});

test('least privilege: id-token only where npm publishes, pull-requests only where the version PR is made', () => {
  assert.deepEqual(release.permissions, {});
  assert.deepEqual(release.jobs['select-mode'].permissions, { contents: 'read' });
  assert.deepEqual(release.jobs.pack.permissions, { contents: 'read' });
  assert.deepEqual(release.jobs.version.permissions, { contents: 'write', 'pull-requests': 'write' });
  assert.deepEqual(release.jobs.publish.permissions, { contents: 'write', 'id-token': 'write' });
  assert.equal(release.jobs.publish.environment, 'npm');
  for (const s of uses('actions/checkout@')) assert.equal(s.with?.['persist-credentials'], false);
});

test('trusted publishing: Node 24, no npm token, and npm publish --provenance', () => {
  for (const s of uses('actions/setup-node@')) {
    assert.equal(s.with?.['node-version'], 24);
    assert.equal(s.with?.['package-manager-cache'], false);
    assert.equal(s.with?.['registry-url'], undefined);
  }
  // The parsed workflow, so the comments that explain why there is no token don't count.
  assert.doesNotMatch(JSON.stringify(release), /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.|pull_request_target/);
  const publish = release.jobs.publish.steps!.find((s) => s.uses?.startsWith('changesets/action/publish@'));
  assert.deepEqual(publish?.env, { NPM_CONFIG_PROVENANCE: 'true' });
  assert.equal(publish?.with?.['pack-dir-artifact-id'], '${{ needs.pack.outputs.pack-dir-artifact-id }}');
  // Nothing in the publish job runs an install script next to the token.
  for (const s of release.jobs.publish.steps!.filter((s) => s.run?.includes('npm ci'))) assert.equal(s.run, 'npm ci --ignore-scripts');
});

test('the package is built, checked for stale generated files and tested before it is packed', () => {
  const runs = release.jobs.pack.steps!.map((s) => s.run ?? '').join('\n');
  assert.match(runs, /npm run build -w packages\/theme\ngit diff --exit-code/);
  assert.match(runs, /^npm test$/m);
  const order = release.jobs.pack.steps!.map((s) => s.run ?? s.uses ?? '');
  assert.ok(order.indexOf('npm test') < order.findIndex((u) => u.startsWith('changesets/action/pack@')));
});

test('the Version packages pull request updates the lockfile with the versions', () => {
  const version = release.jobs.version.steps!.find((s) => s.uses?.startsWith('changesets/action/version@'));
  assert.deepEqual(version?.with, { script: 'npm run version-packages', 'commit-message': 'Version packages', 'pr-title': 'Version packages' });
  const scripts = JSON.parse(readRepo('package.json')).scripts as Record<string, string>;
  assert.match(scripts['version-packages'], /^changeset version && npm install --package-lock-only\b/);
  const config = JSON.parse(readRepo('.changeset/config.json'));
  assert.equal(config.baseBranch, 'main');
  assert.deepEqual(config.privatePackages, { version: false, tag: false });
});

test('the npm version check passes 11.5.1 and later and stops older versions', async () => {
  const check = step(release, 'publish', 'npm-version');
  for (const [version, ok] of [['10.9.8', false], ['11.4.2', false], ['11.5.0', false], ['11.5.1', true], ['11.6.2', true], ['12.0.0-pre.1', true]] as const) {
    const bin = folder('bin');
    fakeCommand(bin, 'npm', `echo ${version}\n`);
    const result = await runStep(check, {}, { bin });
    assert.equal(result.status === 0, ok, `npm ${version}: ${result.stdout}`);
    if (!ok) assert.match(result.stdout, /^::error title=npm is too old::npm .+ needs 11\.5\.1 or later\.$/m);
  }
});
