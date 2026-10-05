// The engine's CI workflow (.github/workflows/ci.yml, SPEC 10.2) keeps its safety properties:
// actions pinned to commit SHAs, read-only permissions, superseded runs cancelled, every job time
// limited, and one job per gate, each running a script or test file that exists.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const text = readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8');
type Step = { uses?: string; run?: string; with?: Record<string, unknown>; 'working-directory'?: string };
type Job = { permissions?: Record<string, string>; 'timeout-minutes'?: number; steps: Step[]; 'runs-on': string };
const workflow = parse(text) as { on: Record<string, unknown>; permissions: unknown; concurrency: Record<string, string>; jobs: Record<string, Job> };
const jobs = Object.entries(workflow.jobs);

test('runs on pull requests and on pushes to main', () => {
  assert.ok('pull_request' in workflow.on);
  assert.deepEqual((workflow.on.push as { branches: string[] }).branches, ['main']);
});

test('every action is pinned to a full commit SHA, with its version in a comment', () => {
  const uses = [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)];
  assert.ok(uses.length > 0);
  for (const [, ref, comment] of uses) {
    assert.match(ref, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${ref} is not pinned to a commit SHA`);
    assert.match(comment, /^ # v\d+\.\d+\.\d+$/, `${ref} needs a "# vX.Y.Z" comment`);
  }
});

test('least privilege: no permissions by default, contents: read where a job checks out', () => {
  assert.deepEqual(workflow.permissions, {});
  for (const [name, job] of jobs) assert.deepEqual(job.permissions, { contents: 'read' }, name);
  for (const [name, job] of jobs) {
    for (const step of job.steps.filter((s) => s.uses?.startsWith('actions/checkout@'))) {
      assert.equal(step.with?.['persist-credentials'], false, `${name}: checkout keeps the token`);
    }
  }
  assert.doesNotMatch(text, /pull_request_target|secrets\./);
});

test('superseded pull request runs are cancelled, and every job has a time limit', () => {
  assert.match(workflow.concurrency.group, /github\.workflow/);
  assert.equal(workflow.concurrency['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
  for (const [name, job] of jobs) assert.ok((job['timeout-minutes'] ?? 0) > 0 && (job['timeout-minutes'] ?? 0) <= 30, name);
});

test('jobs that install packages cache npm', () => {
  for (const [name, job] of jobs) {
    if (!job.steps.some((s) => s.run?.includes('npm ci'))) continue;
    const setup = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'));
    assert.equal(setup?.with?.cache, 'npm', name);
  }
});

test('one job per gate, each running a script or test file that exists', () => {
  const scripts = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts as Record<string, string>;
  const gates: Record<string, RegExp> = {
    unit: /npm test/,
    tokens: /test\/token-contrast\.test\.ts test\/tokens\.test\.ts/,
    matrix: /npm run test:matrix/,
    'no-network': /npm run build/,
    e2e: /npm run test:e2e/,
    a11y: /npm run test:a11y/,
    screenshots: /npm run test:screenshots/,
    docs: /test\/docs\/\*\.test\.ts/,
  };
  assert.deepEqual(Object.keys(workflow.jobs).sort(), Object.keys(gates).sort());
  for (const [name, job] of jobs) {
    const runs = job.steps.map((s) => s.run ?? '').join('\n');
    assert.match(runs, gates[name], name);
    for (const [, script] of runs.matchAll(/npm run ([\w:-]+)/g)) assert.ok(scripts[script], `${name}: npm run ${script} is not a script`);
    for (const step of job.steps.filter((s) => s.run?.includes('node --test'))) {
      const dir = join(REPO, step['working-directory'] ?? '.');
      for (const [file] of step.run!.matchAll(/test\/[\w/*.-]+\.test\.ts/g)) {
        const [folder, pattern] = [join(dir, file.slice(0, file.lastIndexOf('/'))), file.slice(file.lastIndexOf('/') + 1)];
        const matches = existsSync(folder) ? readdirSync(folder).filter((f) => new RegExp(`^${pattern.replace(/\./g, '\\.').replace('*', '.*')}$`).test(f)) : [];
        assert.ok(matches.length > 0, `${name}: ${file} matches no test file`);
      }
    }
  }
});

test('browser jobs check that Chrome is installed, since the browser tests skip without it', () => {
  for (const name of ['e2e', 'a11y', 'screenshots']) {
    assert.ok(workflow.jobs[name].steps.some((s) => s.run === '"$CHROME_PATH" --version'), name);
  }
});

test('the tests that build sites run without the GitHub variables that would move them under /hangfolio/', () => {
  for (const name of ['matrix', 'e2e', 'a11y', 'screenshots']) {
    const runs = workflow.jobs[name].steps.map((s) => s.run ?? '').filter((r) => r.includes('npm run test:'));
    assert.ok(runs.length > 0 && runs.every((r) => r.startsWith('env -u GITHUB_ACTIONS -u GITHUB_REPOSITORY npm run ')), name);
  }
});

test('the no-network build blocks requests and checks that it does', () => {
  const job = workflow.jobs['no-network'] as Job & { env: Record<string, string> };
  for (const key of ['http_proxy', 'https_proxy', 'all_proxy']) assert.equal(job.env[key], 'http://127.0.0.1:9', key);
  // Workflow env keys are case-insensitive: HTTP_PROXY next to http_proxy would be a duplicate.
  const keys = Object.keys(job.env).map((key) => key.toLowerCase());
  assert.equal(new Set(keys).size, keys.length, 'an env key appears twice in different case');
  assert.equal(job.env.NODE_USE_ENV_PROXY, '1');
  const runs = job.steps.map((s) => s.run ?? '');
  assert.ok(runs.findIndex((r) => r.includes('fetch(')) < runs.findIndex((r) => r.includes('npm run build')));
});
