// The engine's reusable workflows (.github/workflows/build.yml and deploy.yml, SPEC 8.2 and 8.3)
// and the starter's caller, Dependabot config and legacy-build safety net (SPEC 8.1, 8.4, 9).
// Structure is checked from the parsed YAML; every script step runs here with fake `gh`, `npm` and
// `sleep` commands, the way the runner would run it (see workflow-steps.ts).
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { parse } from 'yaml';
import { generatorContent } from '../src/lib/head.ts';
import { cleanUp, fakeCommand, folder, readRepo, REPO, runStep, step, workflow, type Job, type Step } from './workflow-steps.ts';

after(cleanUp);

const BUILD = workflow('.github/workflows/build.yml');
const DEPLOY = workflow('.github/workflows/deploy.yml');
const CALLER = workflow('starter/.github/workflows/deploy.yml');
const CALLER_TEXT = readRepo('starter/.github/workflows/deploy.yml');
const ENGINE_FILES = ['.github/workflows/build.yml', '.github/workflows/deploy.yml'];

const REPOSITORY = 'rowan-vale/website';
const SETTINGS = `https://github.com/${REPOSITORY}/settings/pages`;
const CREATE = 'https://github.com/new?template_owner=hangfolio&template_name=starter&owner=%40me&visibility=public';
/** An annotation's message as GitHub shows it. */
const unescape = (text: string) => text.replace(/%0A/g, '\n').replace(/%0D/g, '\r').replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%25/g, '%');
const annotationsIn = (stdout: string) => stdout.split('\n').filter((line) => line.startsWith('::')).map(unescape);

describe('workflow structure', () => {
  const jobs = (wf: typeof BUILD) => Object.entries(wf.jobs) as [string, Job][];
  const allSteps = (wf: typeof BUILD) => jobs(wf).flatMap(([, job]) => job.steps ?? []);

  test('build.yml is a reusable workflow with the planned input, secret and outputs', () => {
    const call = BUILD.on.workflow_call as Record<string, Record<string, Record<string, unknown>>>;
    assert.deepEqual(Object.keys(BUILD.on), ['workflow_call']);
    assert.equal(call.inputs['site-url'].default, '');
    assert.equal(call.inputs['site-url'].type, 'string');
    assert.equal(call.secrets.GOOGLE_WALLET_KEY.required, false);
    assert.equal(call.outputs.deploy.value, '${{ jobs.build.outputs.deploy }}');
    assert.equal(call.outputs['page-url'].value, '${{ jobs.build.outputs.page-url }}');
    assert.deepEqual(Object.keys(BUILD.jobs), ['preflight', 'build', 'setup-needed']);
    assert.ok(BUILD.jobs.build.outputs?.deploy && BUILD.jobs.build.outputs['page-url']);
  });

  test('deploy.yml runs one job in the github-pages environment, one at a time, never cancelled', () => {
    assert.deepEqual(Object.keys(DEPLOY.on), ['workflow_call']);
    const job = DEPLOY.jobs.deploy as Job & { environment: { name: string; url: string }; concurrency: Record<string, unknown> };
    assert.deepEqual(Object.keys(DEPLOY.jobs), ['deploy']);
    assert.deepEqual(job.environment, { name: 'github-pages', url: '${{ steps.deploy.outputs.page_url }}' });
    assert.deepEqual(job.concurrency, { group: 'pages-${{ github.repository }}', 'cancel-in-progress': false });
    assert.match(job.steps![0].uses!, /^actions\/deploy-pages@/);
    assert.equal(job.steps![0].id, 'deploy');
  });

  test('every job runs on ubuntu-24.04 with its own least-privilege permissions', () => {
    for (const wf of [BUILD, DEPLOY]) {
      assert.deepEqual(wf.permissions, {});
      for (const [, job] of jobs(wf)) {
        assert.equal(job['runs-on'], 'ubuntu-24.04');
        assert.ok(job.permissions, `${job.name} declares permissions`);
        assert.ok(typeof job['timeout-minutes'] === 'number', `${job.name} has a timeout`);
      }
    }
    assert.deepEqual(BUILD.jobs.preflight.permissions, { contents: 'read', pages: 'read' });
    assert.deepEqual(BUILD.jobs.build.permissions, { contents: 'read', pages: 'read' });
    assert.deepEqual(BUILD.jobs['setup-needed'].permissions, {});
    assert.deepEqual(DEPLOY.jobs.deploy.permissions, { pages: 'write', 'id-token': 'write' });
  });

  test("the caller grants each engine job at least what it declares (S6: otherwise GitHub refuses the run)", () => {
    const level = { none: 0, read: 1, write: 2 } as Record<string, number>;
    const covers = (granted: Record<string, string> = {}, needed: Record<string, string> = {}) =>
      Object.entries(needed).every(([scope, want]) => (level[granted[scope] ?? 'none'] ?? 0) >= level[want]);
    for (const [name, job] of jobs(BUILD)) assert.ok(covers(CALLER.jobs.build.permissions, job.permissions), `build.yml ${name}`);
    for (const [name, job] of jobs(DEPLOY)) assert.ok(covers(CALLER.jobs.deploy.permissions, job.permissions), `deploy.yml ${name}`);
  });

  test('actions are pinned by full SHA with the version in a comment, the same SHA everywhere', () => {
    const pins = new Map<string, string>();
    for (const file of ENGINE_FILES) {
      for (const line of readRepo(file).split('\n').filter((l) => /^\s*(- )?uses:/.test(l))) {
        const m = /uses: ([\w-]+\/[\w-]+)@([0-9a-f]{40}) # v\d+\.\d+\.\d+$/.exec(line);
        assert.ok(m, `${file}: ${line.trim()}`);
        assert.equal(pins.get(m[1]) ?? m[2], m[2], `${m[1]} is pinned to two SHAs`);
        pins.set(m[1], m[2]);
      }
    }
    assert.deepEqual([...pins.keys()].sort(), [
      'actions/checkout',
      'actions/configure-pages',
      'actions/deploy-pages',
      'actions/setup-node',
      'actions/upload-pages-artifact',
    ]);
  });

  test('scripts take every ${{ }} value through env, and the wallet secret never reaches one', () => {
    for (const wf of [BUILD, DEPLOY]) {
      for (const s of allSteps(wf).filter((x) => x.run)) {
        assert.ok(!s.run!.includes('${{'), `${s.name} has an expression in its script`);
        assert.ok(s.shell === 'bash' || s.shell === 'node {0}', `${s.name} sets its shell`);
      }
    }
    const uses = readRepo('.github/workflows/build.yml').split('\n').filter((l) => l.includes('secrets.'));
    assert.deepEqual(uses.map((l) => l.trim()), ["HAS_WALLET_KEY: ${{ secrets.GOOGLE_WALLET_KEY != '' }}"]);
  });

  test('the build job installs, checks, builds, verifies and uploads in that order', () => {
    const steps = BUILD.jobs.build.steps!;
    const at = (pattern: RegExp) => steps.findIndex((s) => pattern.test(s.uses ?? s.run ?? ''));
    const order = [/^actions\/checkout@/, /^actions\/setup-node@/, /npm ci/, /^actions\/configure-pages@/, /^npx --no hangfolio check --github$/, /^npm run build$/, /^npx --no hangfolio verify dist --github$/, /^actions\/upload-pages-artifact@/];
    const found = order.map(at);
    assert.ok(found.every((i, n) => i >= 0 && (n === 0 || i > found[n - 1])), String(found));
    const byId = Object.fromEntries(steps.filter((s) => s.id).map((s) => [s.id, s]));
    assert.equal(byId.pages.if, "needs.preflight.outputs.build-type == 'workflow'");
    assert.equal(byId.upload.if, "needs.preflight.outputs.ready == 'true'");
    assert.deepEqual(byId.upload.with, { path: 'dist' });
    const build = steps.find((s) => s.run === 'npm run build')!;
    assert.equal(build.env?.SITE_PAGES_URL, '${{ inputs.site-url || steps.pages.outputs.base_url }}');
    // verify checks the site for the address it was built for.
    const verify = steps.find((s) => s.run?.startsWith('npx --no hangfolio verify'))!;
    assert.equal(verify.env?.SITE_PAGES_URL, build.env?.SITE_PAGES_URL);
    const node = steps[1].with!;
    assert.equal(node['node-version'], '${{ needs.preflight.outputs.node-version }}');
    assert.equal(node.cache, "${{ needs.preflight.outputs.lockfile == 'true' && 'npm' || '' }}");
    assert.equal(BUILD.jobs.build.outputs!.deploy, "${{ steps.upload.outcome == 'success' }}");
  });

  test('"One step left" runs only for a publishing run that is not ready and not the first', () => {
    const job = BUILD.jobs['setup-needed'];
    assert.equal(job.name, 'One step left: turn on GitHub Pages');
    assert.equal(job.needs, 'preflight');
    assert.equal(job.if, "needs.preflight.outputs.intent == 'true' && needs.preflight.outputs.ready != 'true' && needs.preflight.outputs.first-run != 'true'");
  });

  test("the starter's caller is SPEC 8.1 with the optional wallet secret and no secrets: inherit", () => {
    assert.equal(CALLER.name, 'Deploy site');
    assert.deepEqual(CALLER.on, { push: null, pull_request: null, workflow_dispatch: null });
    assert.deepEqual(CALLER.permissions, {});
    assert.deepEqual(Object.keys(CALLER.jobs), ['build', 'deploy']);
    assert.equal(CALLER.jobs.build.uses, 'hangfolio/hangfolio/.github/workflows/build.yml@v1');
    assert.deepEqual(CALLER.jobs.build.permissions, { contents: 'read', pages: 'read' });
    assert.deepEqual(CALLER.jobs.build.secrets, { GOOGLE_WALLET_KEY: '${{ secrets.GOOGLE_WALLET_KEY }}' });
    assert.equal(CALLER.jobs.deploy.uses, 'hangfolio/hangfolio/.github/workflows/deploy.yml@v1');
    assert.equal(CALLER.jobs.deploy.needs, 'build');
    assert.equal(CALLER.jobs.deploy.if, "needs.build.outputs.deploy == 'true'");
    assert.deepEqual(CALLER.jobs.deploy.permissions, { pages: 'write', 'id-token': 'write' });
    assert.doesNotMatch(CALLER_TEXT, /inherit/);
    assert.match(CALLER_TEXT.split('\n')[1], /^# hangfolio-plumbing: 1$/);
    // The engine files the caller names exist at those paths.
    for (const job of Object.values(CALLER.jobs)) assert.ok(existsSync(join(REPO, job.uses!.replace(/^hangfolio\/hangfolio\//, '').replace(/@v1$/, ''))));
  });

  test('Dependabot: the theme monthly from npm, both engine refs together from github-actions (S7)', () => {
    const text = readRepo('starter/.github/dependabot.yml');
    assert.match(text, /^# hangfolio-plumbing: 1$/m);
    const config = parse(text);
    assert.equal(config.version, 2);
    const [npm, actions] = config.updates;
    assert.deepEqual(npm, {
      'package-ecosystem': 'npm',
      directory: '/',
      schedule: { interval: 'monthly' },
      allow: [{ 'dependency-name': 'hangfolio' }],
      'open-pull-requests-limit': 1,
      'commit-message': { prefix: 'Update site theme' },
    });
    assert.equal(actions['package-ecosystem'], 'github-actions');
    assert.deepEqual(actions.schedule, { interval: 'monthly' });
    assert.deepEqual(actions.groups, { engine: { patterns: ['hangfolio/hangfolio/*'] } });
    assert.equal(config.updates.length, 2);
    assert.ok(!('cooldown' in npm) && !('cooldown' in actions), "S7: keep Dependabot's default 3-day cooldown");
  });

  test('the legacy-build safety net: an empty .nojekyll and a noindex "Almost there" index.html (SPEC 8.4)', () => {
    assert.equal(readRepo('starter/.nojekyll'), '');
    const html = readRepo('starter/index.html');
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /hangfolio-plumbing: 1/);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.match(html, /<title>Almost there<\/title>/);
    assert.doesNotMatch(html, /<(link|img)\b|src=|url\(/, 'no external files: GitHub serves it as it is');
  });
});

// ---------- preflight ----------

const FACTS = step(BUILD, 'preflight', 'facts');
const SCAN = step(BUILD, 'preflight', 'scan');
const PAGES = step(BUILD, 'preflight', 'pages');
const REPORT = step(BUILD, 'preflight', 'report');
const CALLER_REF = `${REPOSITORY}/.github/workflows/deploy.yml@refs/heads/main`;

describe('preflight: what a run does', () => {
  const facts = (env: Record<string, string>, lock?: unknown) => {
    const cwd = folder('facts');
    if (lock !== undefined) writeFileSync(join(cwd, 'package-lock.json'), typeof lock === 'string' ? lock : JSON.stringify(lock));
    return runStep(FACTS, { EVENT_NAME: 'push', REF: 'refs/heads/main', DEFAULT_BRANCH: 'main', RUN_NUMBER: '3', RUN_ATTEMPT: '1', HAS_WALLET_KEY: 'false', ...env }, { cwd });
  };

  test('only a push or a manual run of the default branch publishes', async () => {
    const cases: [Record<string, string>, string][] = [
      [{}, 'true'],
      [{ EVENT_NAME: 'workflow_dispatch' }, 'true'],
      [{ REF: 'refs/heads/master', DEFAULT_BRANCH: 'master' }, 'true'],
      [{ REF: 'refs/heads/edit-about' }, 'false'],
      [{ EVENT_NAME: 'pull_request', REF: 'refs/pull/2/merge' }, 'false'],
      [{ REF: 'refs/tags/main' }, 'false'],
      [{ EVENT_NAME: 'schedule' }, 'false'],
    ];
    for (const [env, intent] of cases) assert.equal((await facts(env)).outputs.intent, intent, JSON.stringify(env));
  });

  test('run 1 is the first run (S5), and the wallet key is reduced to true or false', async () => {
    const first = await facts({ RUN_NUMBER: '1', HAS_WALLET_KEY: 'true' });
    assert.equal(first.outputs['first-run'], 'true');
    assert.equal(first.outputs['wallet-key'], 'true');
    const later = await facts({ RUN_ATTEMPT: '2' });
    assert.equal(later.outputs['first-run'], 'false');
    assert.equal(later.outputs['wallet-key'], 'false');
    assert.equal(later.outputs.attempt, '2', 'the attempt that read the settings, for "One step left"');
  });

  test("Node is the highest of 24 and 22 that the theme's engines.node allows", async () => {
    const lock = (node: string) => ({ lockfileVersion: 3, packages: { '': {}, 'node_modules/hangfolio': { version: '1.0.0', engines: { node } } } });
    const cases: Record<string, string> = {
      '^22.12.0 || ^24.0.0': '24',
      '>=22.12': '24',
      '>= 22.12.0': '24',
      '^22.12.0': '22',
      '22.x': '22',
      '~22.12': '~22.12', // the newest 22 is past 22.12.x, so setup-node gets the range and picks 22.12.x
      '~22': '22',
      '>=20 <24': '22',
      '>=20.0.0 <=22': '22',
      '<23': '22',
      '22.12 - 24': '24',
      '22.12.0 - 23': '22',
      '^24': '24',
      '24.x || 22.x': '24',
      '*': '24',
      '>=26': '>=26',
      '^20': '^20',
      'not a range!': '24',
    };
    for (const [range, expected] of Object.entries(cases)) {
      const { outputs } = await facts({}, lock(range));
      assert.equal(outputs['node-version'], expected, range);
      assert.equal(outputs.lockfile, 'true');
    }
  });

  test('without a lockfile, or with the theme as a workspace link, Node still resolves', async () => {
    const none = await facts({});
    assert.deepEqual([none.outputs.lockfile, none.outputs['node-version']], ['false', '24']);
    const broken = await facts({}, '{ not json');
    assert.deepEqual([broken.outputs.lockfile, broken.outputs['node-version']], ['true', '24']);
    const link = await facts({}, { packages: { 'node_modules/hangfolio': { resolved: 'packages/theme', link: true }, 'packages/theme': { engines: { node: '^22.12.0' } } } });
    assert.equal(link.outputs['node-version'], '22');
    // This repository's own lockfile: the theme is a workspace with engines ^22.12.0 || ^24.0.0.
    const repo = await runStep(FACTS, { EVENT_NAME: 'push', REF: 'refs/heads/main', DEFAULT_BRANCH: 'main', RUN_NUMBER: '9', HAS_WALLET_KEY: 'false' }, { cwd: REPO });
    assert.equal(repo.outputs['node-version'], '24');
  });
});

// S10's rule, run on the cases from the spike note: GitHub's suggestions, hand-made variants and lookalikes.
const STATIC_YML = `# Simple workflow for deploying static content to GitHub Pages
name: Deploy static content to Pages

on:
  # Runs on pushes targeting the default branch
  push:
    branches: ["main"]

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
const ASTRO_YML = `name: Deploy Astro site to Pages
on:
  push:
    branches: ["main"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Detect package manager
        id: detect-package-manager
        run: |
          if [ -f "\${{ github.workspace }}/yarn.lock" ]; then
            echo "manager=yarn" >> $GITHUB_OUTPUT
          fi
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - uses: actions/configure-pages@v5
      - run: npx --no-install astro build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;

describe('preflight: other workflows that publish to GitHub Pages (S10)', () => {
  /** The files of .github/workflows, next to the copy's own deploy.yml unless that is set to null. */
  const scan = async (files: Record<string, string | null>, self = CALLER_REF) => {
    const cwd = folder('scan');
    const all = { 'deploy.yml': CALLER_TEXT, ...files };
    for (const [name, text] of Object.entries(all)) {
      if (text === null) continue;
      mkdirSync(join(cwd, '.github/workflows', name, '..'), { recursive: true });
      writeFileSync(join(cwd, '.github/workflows', name), text);
    }
    const result = await runStep(SCAN, { WORKFLOW_REF: self }, { cwd });
    assert.equal(result.status, 0, result.stderr);
    return { findings: JSON.parse(result.outputs.findings) as { kind: string; path: string; label: string }[], blocking: result.outputs.blocking };
  };
  const one = (kind: string, file: string, label = '') => [{ kind, path: `.github/workflows/${file}`, label }];

  test("the copy's own deploy.yml alone is fine, and so is the engine's own pair", async () => {
    assert.deepEqual((await scan({})).findings, []);
    const engine = Object.fromEntries(ENGINE_FILES.map((f) => [f.split('/').pop()!.replace('.yml', '-engine.yml'), readRepo(f)]));
    assert.deepEqual((await scan(engine)).findings, []);
  });

  test("GitHub's suggested workflows are named by their card", async () => {
    assert.deepEqual((await scan({ 'static.yml': STATIC_YML })).findings, one('competing', 'static.yml', 'Static HTML'));
    assert.deepEqual((await scan({ 'astro.yml': ASTRO_YML })).findings, one('competing', 'astro.yml', 'Astro'));
    const renamed = await scan({ 'publish.yml': STATIC_YML });
    assert.deepEqual(renamed.findings, one('competing', 'publish.yml'));
    assert.equal(renamed.blocking, '1');
  });

  test('hand-made variants are caught', async () => {
    const variants: Record<string, string> = {
      'pinned.yml': 'on: push\njobs:\n  d:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4.0.5\n',
      'Upper.YAML': '"on": [push, workflow_dispatch]\njobs:\n  d:\n    steps:\n      - uses: "Actions/Deploy-Pages@v4"\n',
      'flow.yml': 'on: { push: {} }\njobs:\n  d:\n    steps:\n      - { name: up, uses: actions/upload-pages-artifact@v3, with: { path: dist } }\n',
      'crlf.yml': '\uFEFFon:\r\n  push:\r\njobs:\r\n  d:\r\n    steps:\r\n      - uses: actions/deploy-pages@v4\r\n',
      'mixed.yml': 'on:\n  workflow_call:\n  push:\njobs:\n  d:\n    steps:\n      - uses: actions/deploy-pages@v4\n',
    };
    for (const [name, text] of Object.entries(variants)) {
      assert.deepEqual((await scan({ [name]: text })).findings, one('competing', name), name);
    }
  });

  test('a deploy job pasted into deploy.yml, a local reusable chain, a duplicate caller and a gh-pages publisher', async () => {
    const pasted = `${CALLER_TEXT}  pages:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/deploy-pages@v4\n`;
    assert.deepEqual((await scan({ 'deploy.yml': pasted })).findings, one('competing', 'deploy.yml'));

    const reusable = 'on:\n  workflow_call:\njobs:\n  d:\n    steps:\n      - uses: actions/deploy-pages@v4\n';
    assert.deepEqual((await scan({ 'pages-reusable.yml': reusable })).findings, [], 'only runs when called');
    const chain = await scan({ 'pages-reusable.yml': reusable, 'pages.yml': 'on: push\njobs:\n  p:\n    uses: ./.github/workflows/pages-reusable.yml\n' });
    assert.deepEqual(chain.findings, one('competing', 'pages.yml'));

    const duplicate = await scan({ 'deploy-copy.yml': CALLER_TEXT });
    assert.deepEqual(duplicate.findings, one('duplicate', 'deploy-copy.yml'));
    assert.equal(duplicate.blocking, '1');

    const branch = await scan({ 'gh-pages.yml': 'on: push\njobs:\n  b:\n    steps:\n      - uses: peaceiris/actions-gh-pages@v4\n' });
    assert.deepEqual(branch.findings, one('branch', 'gh-pages.yml'));
    assert.equal(branch.blocking, '0', 'a branch publisher is only a warning');
  });

  test('lookalikes are not flagged', async () => {
    const lookalikes: Record<string, string> = {
      'static.yml': `name: Static analysis
on: push
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # - uses: actions/deploy-pages@v4   (disabled)
      - name: Explain that deploy happens elsewhere, not via actions/deploy-pages
        run: echo "deploy is done by deploy.yml, not actions/deploy-pages@v4"
      - name: Script mentioning the action
        run: |
          echo uses: actions/deploy-pages@v4
            uses: actions/upload-pages-artifact@v3
      - name: Folded
        run: >-
          echo
          uses: actions/deploy-pages@v4
      - uses: actions/upload-artifact@v4   # not a Pages artifact
`,
      'reuses.yml': 'name: reuses\non: push\nenv:\n  reuses: actions/deploy-pages@v4\n  NOTE: "uses: actions/deploy-pages@v4"\njobs:\n  x:\n    steps:\n      - run: true\n',
      'jekyll-check.yml': 'on: push\njobs:\n  j:\n    steps:\n      - uses: actions/jekyll-build-pages@v1\n      - uses: actions/configure-pages@v5\n',
      'old/static.yml': STATIC_YML,
      'static.yml.disabled': STATIC_YML,
      'empty.yml': '',
    };
    assert.deepEqual((await scan(lookalikes)).findings, []);
  });

  test('a renamed caller is recognised from github.workflow_ref', async () => {
    const self = `${REPOSITORY}/.github/workflows/site.yml@refs/heads/main`;
    assert.deepEqual((await scan({ 'deploy.yml': null, 'site.yml': CALLER_TEXT }, self)).findings, []);
    // With the old copy still there, that one is the duplicate.
    assert.deepEqual((await scan({ 'site.yml': CALLER_TEXT }, self)).findings, one('duplicate', 'deploy.yml'));
  });
});

/** A fake gh that answers GET /repos/{repo}/pages from a list: workflow, legacy, 404 or an HTTP status. */
function fakeGh(answers: string[]) {
  const bin = folder('bin');
  writeFileSync(join(bin, 'answers'), `${answers.join('\n')}\n`);
  fakeCommand(
    bin,
    'gh',
    `here=$(dirname "$0")
echo "$* token=\${GH_TOKEN:+set}" >>"$here/calls"
n=$(( $(wc -l <"$here/calls") ))
answer=$(sed -n "\${n}p" "$here/answers"); [ -n "$answer" ] || answer=$(tail -n 1 "$here/answers")
case $answer in
  workflow|legacy) printf '{"html_url":"https://rowan-vale.github.io/website/","build_type":"%s","status":"built"}\\n' "$answer" ;;
  404) echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;
  *) echo "gh: Server Error (HTTP $answer)" >&2; exit 1 ;;
esac
`,
  );
  // Records each wait instead of taking it.
  fakeCommand(bin, 'sleep', 'echo "$1" >>"$(dirname "$0")/sleeps"; exec /bin/sleep 0.05\n');
  const lines = (file: string) => (existsSync(join(bin, file)) ? readFileSync(join(bin, file), 'utf8').trim().split('\n') : []);
  return { bin, calls: () => lines('calls'), sleeps: () => lines('sleeps') };
}

describe('preflight: reading the Pages settings (S4) and waiting for them', () => {
  const pages = async (answers: string[], env: Record<string, string> = {}) => {
    const gh = fakeGh(answers);
    const result = await runStep(PAGES, { GH_TOKEN: 'job-token', REPOSITORY, SERVER_URL: 'https://github.com', RUN_NUMBER: '1', BLOCKING: '0', ...env }, { bin: gh.bin });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return { ...result, calls: gh.calls(), sleeps: gh.sleeps() };
  };

  test('workflow, legacy, and 404 as off, read once with the job token', async () => {
    const workflow = await pages(['workflow']);
    assert.equal(workflow.outputs['build-type'], 'workflow');
    assert.equal(workflow.outputs['html-url'], 'https://rowan-vale.github.io/website/');
    assert.deepEqual(workflow.calls, [`api repos/${REPOSITORY}/pages token=set`]);
    assert.equal((await pages(['legacy'])).outputs['build-type'], 'legacy');
    const off = await pages(['404']);
    assert.deepEqual([off.outputs['build-type'], off.outputs['html-url'], off.calls.length], ['none', '', 1]);
  });

  test('another failure is "error", never "off", after 3 tries', async () => {
    const error = await pages(['502']);
    assert.equal(error.outputs['build-type'], 'error');
    assert.equal(error.outputs.detail, 'gh: Server Error (HTTP 502)');
    assert.deepEqual([error.calls.length, error.sleeps], [3, ['5', '5']]);
    assert.equal((await pages(['502', 'legacy'])).outputs['build-type'], 'legacy');
  });

  test('runs 2 to 5 wait for Source to become GitHub Actions, every 15 seconds', async () => {
    const waited = await pages(['404', 'legacy', 'workflow'], { RUN_NUMBER: '2' });
    assert.equal(waited.outputs['build-type'], 'workflow');
    assert.deepEqual(waited.sleeps, ['15', '15']);
    assert.match(waited.stdout, /Waiting for GitHub Pages: open https:\/\/github\.com\/rowan-vale\/website\/settings\/pages/);
    // The loop counts whole seconds ($SECONDS), so a 1-second limit can end after a single poll
    // when the clock ticks right away; 2 seconds always leaves at least one full second of polls.
    const timedOut = await pages(['404'], { RUN_NUMBER: '5', HANGFOLIO_POLL_LIMIT: '2' });
    assert.equal(timedOut.outputs['build-type'], 'none');
    assert.ok(timedOut.calls.length > 2);
  });

  test('no wait on the first run, after run 5, or when another workflow blocks the deploy', async () => {
    for (const env of [{ RUN_NUMBER: '1' }, { RUN_NUMBER: '6' }, { RUN_NUMBER: '3', BLOCKING: '1' }]) {
      const result = await pages(['404', 'workflow'], env);
      assert.deepEqual([result.outputs['build-type'], result.calls.length], ['none', 1], JSON.stringify(env));
    }
  });
});

describe('preflight: messages for each case', () => {
  const report = (env: Record<string, string>) =>
    runStep(REPORT, {
      INTENT: 'true',
      FIRST_RUN: 'false',
      BUILD_TYPE: 'none',
      HTML_URL: '',
      DETAIL: '',
      FINDINGS: '[]',
      REPOSITORY,
      SERVER_URL: 'https://github.com',
      DEFAULT_BRANCH: 'main',
      FORK: 'false',
      PRIVATE: 'false',
      WORKFLOW: 'Deploy site',
      WORKFLOW_REF: CALLER_REF,
      ...env,
    });

  test('a check build and a ready site say nothing', async () => {
    const check = await report({ INTENT: 'false', BUILD_TYPE: '' });
    assert.deepEqual([check.outputs.state, check.outputs.ready, check.summary], ['n/a', 'false', '']);
    assert.equal(check.outputs['site-url'], 'https://rowan-vale.github.io/website/');
    const ready = await report({ BUILD_TYPE: 'workflow', HTML_URL: 'https://example.org/' });
    assert.deepEqual([ready.outputs.state, ready.outputs.ready, ready.summary, ready.outputs['setup-message']], ['ready', 'true', '', undefined]);
    assert.equal(ready.outputs['site-url'], 'https://example.org/');
    assert.deepEqual(annotationsIn(ready.stdout), []);
  });

  test('Pages off on a later run: the settings link, then Re-run all jobs', async () => {
    const { outputs, summary } = await report({ BUILD_TYPE: 'none' });
    assert.deepEqual([outputs.state, outputs.ready, summary], ['none', 'false', '']);
    assert.equal(
      outputs['setup-message'],
      [
        '## One step left: turn on GitHub Pages',
        `**Turn on GitHub Pages.** Open [Settings → Pages](${SETTINGS}) and under *Build and deployment → Source* choose **GitHub Actions**. Do not click *Configure* on any suggested workflow: Deploy site already publishes your site.`,
        'Then click **Re-run all jobs** at the top of this page. Your site goes live at https://rowan-vale.github.io/website/ about 2 minutes later.',
      ].join('\n\n'),
    );
    assert.equal(unescape(outputs['setup-error']), `GitHub Pages is not turned on. Open ${SETTINGS} and set Source to "GitHub Actions". Then click "Re-run all jobs".`);
    assert.equal(outputs['setup-title'], 'One step left%3A turn on GitHub Pages');
  });

  test('the first run is a green Welcome with direct links (SPEC 3.1)', async () => {
    const { outputs, summary, stdout } = await report({ FIRST_RUN: 'true', BUILD_TYPE: 'none' });
    assert.equal(outputs.ready, 'false');
    assert.match(summary, /^## Welcome: 2 steps left\n\nThis run builds the example site to check your copy; nothing is published yet\. Your site will be at https:\/\/rowan-vale\.github\.io\/website\/\./);
    assert.ok(summary.includes(`1. **Turn on GitHub Pages.** Open [Settings → Pages](${SETTINGS})`));
    assert.ok(summary.includes(`2. **Make it yours.** Open [site.yaml](https://github.com/${REPOSITORY}/edit/main/site.yaml)`));
    assert.ok(summary.includes(`[Actions → Deploy site](https://github.com/${REPOSITORY}/actions/workflows/deploy.yml)`));
    assert.doesNotMatch(summary, /Re-run/, 'the next commit runs again by itself');
    const [notice] = annotationsIn(stdout);
    assert.match(notice, /^::notice title=Welcome: 2 steps left::Next: GitHub Pages is not turned on\. Open .*settings\/pages and set Source to "GitHub Actions"\. Then edit site\.yaml/);
  });

  test("a new <owner>.github.io copy in branch mode, and a copy whose Pages is already on", async () => {
    const user = await report({ FIRST_RUN: 'true', BUILD_TYPE: 'legacy', REPOSITORY: 'rowan-vale/rowan-vale.github.io', HTML_URL: 'https://rowan-vale.github.io/', DEFAULT_BRANCH: 'master' });
    assert.match(user.summary, /^## Welcome: 2 steps left/);
    assert.ok(user.summary.includes('**Switch GitHub Pages to GitHub Actions.** GitHub Pages is set to *Deploy from a branch*'));
    assert.ok(user.summary.includes('so https://rowan-vale.github.io/ shows an "Almost there" page instead of your site'));
    assert.ok(user.summary.includes('https://github.com/rowan-vale/rowan-vale.github.io/edit/master/site.yaml'));
    const ready = await report({ FIRST_RUN: 'true', BUILD_TYPE: 'workflow' });
    assert.equal(ready.outputs.ready, 'true');
    assert.match(ready.summary, /^## Welcome: 1 step left\n\nGitHub Pages is already set up, so this run builds the example site and publishes it at/);
    assert.match(ready.summary, /1\. \*\*Make it yours\.\*\*.*That commit replaces the example about 2 minutes later\./);
  });

  test('private on a free plan, a fork, and an unreadable setting', async () => {
    const priv = await report({ PRIVATE: 'true' });
    assert.match(priv.outputs['setup-message'], /This repository is private, and on GitHub's free plan Pages needs a public repository/);
    assert.ok(priv.outputs['setup-message'].includes(`[Settings → General](https://github.com/${REPOSITORY}/settings)`));
    assert.match(unescape(priv.outputs['setup-error']), /^GitHub Pages needs a public repository on the free plan\./);
    // A private repository whose Pages works (a paid plan) is just ready.
    assert.equal((await report({ PRIVATE: 'true', BUILD_TYPE: 'workflow' })).outputs.ready, 'true');

    const fork = await report({ FORK: 'true' });
    assert.ok(fork.outputs['setup-message'].includes(`[Create your site](${CREATE})`));
    assert.ok(fork.outputs['setup-error'].includes('owner=%2540me'), 'the % in the link is escaped for the annotation');
    assert.ok(unescape(fork.outputs['setup-error']).startsWith(`This repository is a fork. Start over with your own copy: ${CREATE}`));

    const error = await report({ BUILD_TYPE: 'error', DETAIL: 'gh: Server Error (HTTP 502)' });
    assert.equal(error.outputs.state, 'error');
    assert.match(error.outputs['setup-message'], /^## One step left: check the GitHub Pages settings\n\n\*\*Check the GitHub Pages settings\.\*\* This run could not read the GitHub Pages settings \(gh: Server Error \(HTTP 502\)\)\. Open \[Settings → Pages\]\(.*\) and check that \*Build and deployment → Source\* is \*\*GitHub Actions\*\*\. If it already is, GitHub had a temporary problem\./);
    assert.match(unescape(error.outputs['setup-error']), /Check that Source is "GitHub Actions" in .*\. Then click "Re-run all jobs"\.$/);
    assert.equal(error.outputs['setup-title'], 'One step left%3A check the GitHub Pages settings');
  });

  test('a competing workflow fails with a delete link, even when Pages is set up', async () => {
    const findings = JSON.stringify([{ kind: 'competing', path: '.github/workflows/static.yml', label: 'Static HTML' }]);
    const { outputs } = await report({ BUILD_TYPE: 'workflow', FINDINGS: findings });
    assert.deepEqual([outputs.state, outputs.ready], ['competing', 'false']);
    const del = `https://github.com/${REPOSITORY}/delete/main/.github/workflows/static.yml`;
    assert.equal(
      outputs['setup-message'],
      [
        '## One step left: delete the extra Pages workflow',
        `**Delete the extra Pages workflow.** \`.github/workflows/static.yml\` is GitHub's suggested "Static HTML" workflow from Settings → Pages. It also publishes to GitHub Pages, so it overwrites your site. [Delete it](${del}); Deploy site already builds and publishes your site.`,
        'Deleting the file is a commit, which runs Deploy site again and publishes your site at https://rowan-vale.github.io/website/.',
      ].join('\n\n'),
    );
    assert.equal(unescape(outputs['setup-error']), `.github/workflows/static.yml also publishes to GitHub Pages and overwrites your site. Delete it: ${del}`);
    assert.equal(outputs['setup-title'], 'One step left%3A delete the extra Pages workflow', 'the annotation names the real step, not "turn on"');

    const both = await report({ BUILD_TYPE: 'none', FINDINGS: JSON.stringify([{ kind: 'duplicate', path: '.github/workflows/deploy-copy.yml', label: '' }]) });
    assert.match(both.outputs['setup-message'], /deploy-copy\.yml` is a second copy of Deploy site/);
    assert.match(both.outputs['setup-message'], /Open \[Settings → Pages\]/);
    assert.match(both.outputs['setup-message'], /Change the setting first\./);
  });

  test('a misnamed X.github.io repository and a gh-pages publisher are warnings', async () => {
    const misnamed = await report({ REPOSITORY: 'rowan-vale/vale.github.io', BUILD_TYPE: 'workflow', FINDINGS: JSON.stringify([{ kind: 'branch', path: '.github/workflows/gh-pages.yml', label: '' }]) });
    assert.equal(misnamed.outputs.ready, 'true');
    assert.deepEqual(annotationsIn(misnamed.stdout), [
      '::warning title=Repository name::This repository will be served at https://rowan-vale.github.io/vale.github.io/. To get https://rowan-vale.github.io/, rename it to rowan-vale.github.io (Settings → General).',
      '::warning title=Unused Pages workflow::.github/workflows/gh-pages.yml publishes a gh-pages branch, which GitHub Pages ignores while Source is "GitHub Actions". You can delete it.',
    ]);
    const off = await report({ REPOSITORY: 'Rowan-Vale/Vale.github.io' });
    assert.match(off.outputs['setup-message'], /This repository is named `Vale\.github\.io`, but it belongs to `Rowan-Vale`, so your site is at https:\/\/rowan-vale\.github\.io\/Vale\.github\.io\//);
    assert.match(unescape(off.outputs['setup-error']), /Note: this repository is served at https:\/\/rowan-vale\.github\.io\/Vale\.github\.io\/; rename it to rowan-vale\.github\.io/);
    assert.equal((await report({ REPOSITORY: 'Rowan-Vale/rowan-vale.GitHub.io', BUILD_TYPE: 'workflow' })).stdout.includes('::warning'), false, 'case does not matter');
  });
});

describe('preflight: the M8 scenarios, step by step', () => {
  /** Runs the preflight steps in order, as the runner would, skipping the ones whose if: is false. */
  async function preflight(o: { answers: string[]; run: number; workflows?: Record<string, string>; event?: string; ref?: string; repo?: string; branch?: string; limit?: string }) {
    const repo = o.repo ?? REPOSITORY;
    const branch = o.branch ?? 'main';
    const cwd = folder('checkout');
    mkdirSync(join(cwd, '.github/workflows'), { recursive: true });
    for (const [name, text] of Object.entries({ 'deploy.yml': CALLER_TEXT, ...o.workflows })) writeFileSync(join(cwd, '.github/workflows', name), text);
    const gh = fakeGh(o.answers);
    const facts = await runStep(FACTS, { EVENT_NAME: o.event ?? 'push', REF: o.ref ?? `refs/heads/${branch}`, DEFAULT_BRANCH: branch, RUN_NUMBER: String(o.run), RUN_ATTEMPT: '1', HAS_WALLET_KEY: 'false' }, { cwd });
    const intent = facts.outputs.intent === 'true';
    const ref = `${repo}/.github/workflows/deploy.yml@refs/heads/${branch}`;
    const scan = intent ? await runStep(SCAN, { WORKFLOW_REF: ref }, { cwd }) : undefined;
    const pages = intent
      ? await runStep(PAGES, { GH_TOKEN: 't', REPOSITORY: repo, SERVER_URL: 'https://github.com', RUN_NUMBER: String(o.run), BLOCKING: scan!.outputs.blocking, ...(o.limit && { HANGFOLIO_POLL_LIMIT: o.limit }) }, { cwd, bin: gh.bin })
      : undefined;
    const report = await runStep(REPORT, {
      INTENT: facts.outputs.intent,
      FIRST_RUN: facts.outputs['first-run'],
      BUILD_TYPE: pages?.outputs['build-type'] ?? '',
      HTML_URL: pages?.outputs['html-url'] ?? '',
      DETAIL: pages?.outputs.detail ?? '',
      FINDINGS: scan?.outputs.findings ?? '',
      REPOSITORY: repo,
      SERVER_URL: 'https://github.com',
      DEFAULT_BRANCH: branch,
      FORK: 'false',
      PRIVATE: 'false',
      WORKFLOW: 'Deploy site',
      WORKFLOW_REF: ref,
    });
    const out = report.outputs;
    // The job-level if: of setup-needed and the upload step's if:.
    const setupNeeded = facts.outputs.intent === 'true' && out.ready !== 'true' && facts.outputs['first-run'] !== 'true';
    return { deploy: out.ready === 'true', setupNeeded, welcome: report.summary, error: out['setup-error'] && unescape(out['setup-error']), ghCalls: gh.calls().length };
  }

  test('(a) Source never set: run 1 is green with the Welcome, a later run is red with One step left', async () => {
    const first = await preflight({ answers: ['404'], run: 1 });
    assert.deepEqual([first.deploy, first.setupNeeded], [false, false]);
    assert.match(first.welcome, /^## Welcome: 2 steps left/);
    const later = await preflight({ answers: ['404'], run: 7 });
    assert.deepEqual([later.deploy, later.setupNeeded, later.welcome], [false, true, '']);
    assert.match(later.error, /GitHub Pages is not turned on/);
  });

  test('(b) Source set while run 2 waits: it deploys', async () => {
    const run = await preflight({ answers: ['404', '404', 'workflow'], run: 2 });
    assert.deepEqual([run.deploy, run.setupNeeded, run.ghCalls], [true, false, 3]);
  });

  test('(c) a new <owner>.github.io copy in branch mode starts green and explains the Almost-there page', async () => {
    const run = await preflight({ answers: ['legacy'], run: 1, repo: 'rowan-vale/rowan-vale.github.io' });
    assert.deepEqual([run.deploy, run.setupNeeded], [false, false]);
    assert.match(run.welcome, /"Almost there" page/);
  });

  test('(d) a committed Static HTML suggestion fails with a delete link, without waiting', async () => {
    const run = await preflight({ answers: ['workflow'], run: 4, workflows: { 'static.yml': STATIC_YML } });
    assert.deepEqual([run.deploy, run.setupNeeded, run.ghCalls], [false, true, 1]);
    assert.match(run.error, /^\.github\/workflows\/static\.yml also publishes to GitHub Pages and overwrites your site\. Delete it: https:\/\/github\.com\/rowan-vale\/website\/delete\/main\/\.github\/workflows\/static\.yml$/);
  });

  test('(e) a Dependabot pull request builds and does not deploy or read Pages', async () => {
    const run = await preflight({ answers: ['workflow'], run: 12, event: 'pull_request', ref: 'refs/pull/3/merge' });
    assert.deepEqual([run.deploy, run.setupNeeded, run.ghCalls], [false, false, 0]);
  });

  test('(h) a default branch named master deploys', async () => {
    const run = await preflight({ answers: ['workflow'], run: 9, branch: 'master' });
    assert.deepEqual([run.deploy, run.setupNeeded], [true, false]);
  });
});

describe('"One step left: turn on GitHub Pages"', () => {
  const say = step(BUILD, 'setup-needed', 'Say what to do');
  const message = '## One step left: turn on GitHub Pages\n\n**Turn on GitHub Pages.** …';

  test('writes the summary and one error, then fails', async () => {
    const result = await runStep(say, { MESSAGE: message, TITLE: 'One step left%3A turn on GitHub Pages', ERROR: 'GitHub Pages is not turned on. Open https://x%2540y', CHECKED_IN: '1', ATTEMPT: '1' });
    assert.equal(result.status, 1);
    assert.equal(result.summary, `${message}\n`);
    assert.equal(result.stdout, '::error title=One step left%3A turn on GitHub Pages::GitHub Pages is not turned on. Open https://x%2540y\n');
    const competing = await runStep(say, { MESSAGE: message, TITLE: 'One step left%3A delete the extra Pages workflow', ERROR: 'x', CHECKED_IN: '1', ATTEMPT: '1' });
    assert.equal(competing.stdout, '::error title=One step left%3A delete the extra Pages workflow::x\n');
  });

  test('"Re-run failed jobs" repeats an old answer, so it asks for Re-run all jobs', async () => {
    const result = await runStep(say, { MESSAGE: message, TITLE: 'One step left%3A turn on GitHub Pages', ERROR: 'x', CHECKED_IN: '1', ATTEMPT: '2' });
    assert.equal(result.status, 1);
    assert.match(result.summary, /^## Choose Re-run all jobs\n\nOnly this job ran again, .* open \*\*Re-run jobs\*\* and choose \*\*Re-run all jobs\*\*: that checks the settings again\.\n\n## One step left/);
    const [first, second] = annotationsIn(result.stdout);
    assert.match(first, /^::error title=Choose Re-run all jobs::Only this job ran again/);
    assert.equal(second, '::error title=One step left: turn on GitHub Pages::x');
  });
});

// ---------- build ----------

describe('build: installing the theme', () => {
  const install = step(BUILD, 'build', 'Install the theme');
  const run = (mode: string, lockfile = true) => {
    const cwd = folder('site');
    if (lockfile) writeFileSync(join(cwd, 'package-lock.json'), '{}');
    const bin = folder('bin');
    const messages: Record<string, string> = {
      ok: 'added 275 packages in 2s',
      sync: 'npm error code EUSAGE\nnpm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.\nnpm error Missing: hangfolio@1.1.0 from lock file',
      network: 'npm error code ECONNRESET\nnpm error network aborted',
      other: 'npm error code EACCES',
    };
    fakeCommand(bin, 'npm', `echo "npm $*"\ncat <<'EOF'\n${messages[mode]}\nEOF\n${mode === 'ok' ? 'exit 0' : 'exit 1'}\n`);
    return runStep(install, {}, { cwd, bin });
  };
  const error = (stdout: string) => annotationsIn(stdout).find((l) => l.startsWith('::error')) ?? '';

  test('npm ci passes through', async () => {
    const ok = await run('ok');
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /^npm ci --no-audit --no-fund\n/);
  });

  test('a lockfile out of step with package.json gets the hint (SPEC 8.2 step 3)', async () => {
    const sync = await run('sync');
    assert.equal(sync.status, 1);
    assert.equal(
      error(sync.stdout),
      '::error file=package.json,title=package.json and package-lock.json disagree::package.json and package-lock.json disagree; if you edited package.json by hand, undo that edit. To change the theme version, merge the "Update site theme" pull request instead, or run npm install on your computer and commit both files.',
    );
  });

  test('a network failure says re-run, anything else points at the log, and a missing lockfile is named', async () => {
    assert.match(error((await run('network')).stdout), /npm could not reach the package registry\. This is usually temporary: click "Re-run failed jobs"\./);
    assert.match(error((await run('other')).stdout), /Installing the theme failed; the log above says why/);
    const missing = await run('ok', false);
    assert.equal(missing.status, 1);
    assert.match(error(missing.stdout), /^::error file=package\.json,title=package-lock\.json is missing::/);
  });
});

describe('build: the summary', () => {
  const summary = step(BUILD, 'build', 'Summary');
  const run = async (env: Record<string, string>) =>
    (
      await runStep(summary, {
        JOB_STATUS: 'success',
        INTENT: 'true',
        READY: 'true',
        FIRST_RUN: 'false',
        UPLOADED: 'success',
        PAGE_URL: 'https://rowan-vale.github.io/website',
        PINNED_URL: '',
        SITE_URL: 'https://rowan-vale.github.io/website/',
        EVENT_NAME: 'push',
        DEFAULT_BRANCH: 'main',
        REPOSITORY,
        ...env,
      })
    ).summary;

  test('says what happened to this build', async () => {
    assert.match(await run({}), /^### Your site\n\nBuilt for https:\/\/rowan-vale\.github\.io\/website\. The \*\*Publish site\*\* job puts it live\. GitHub can cache pages for up to 10 minutes/);
    assert.match(await run({ PINNED_URL: 'https://example.org' }), /Built for https:\/\/example\.org\./);
    assert.match(await run({ INTENT: 'false', EVENT_NAME: 'pull_request', UPLOADED: 'skipped' }), /This pull request builds without errors\. Nothing was published: merging it into `main` publishes the site\./);
    assert.match(await run({ INTENT: 'false', UPLOADED: 'skipped', DEFAULT_BRANCH: 'master' }), /only commits to `master` publish your site/);
    assert.match(await run({ READY: 'false', UPLOADED: 'skipped', FIRST_RUN: 'true' }), /the Welcome summary above lists the steps/);
    assert.match(await run({ READY: 'false', UPLOADED: 'skipped' }), /GitHub Pages needs one more step \(see \*\*One step left: turn on GitHub Pages\*\*\)/);
    assert.match(await run({ JOB_STATUS: 'failure', UPLOADED: '' }), /Nothing was published, and your live site is unchanged\./);
  });
});

// ---------- deploy ----------

describe('deploy: the live check (SPEC 8.3)', () => {
  const check = step(DEPLOY, 'deploy', 'Check the live site');
  const SHA = '0123456789abcdef0123456789abcdef01234567';

  /** Serves a page under /website/ with the given generator tag and a stylesheet that answers `css`. */
  async function site(generator: string | undefined, css = 200, linkTag = '<link rel="stylesheet" href="/website/_astro/Base.abc.css">') {
    const requests: string[] = [];
    const server = createServer((req, res) => {
      requests.push(req.url ?? '');
      if (req.url?.startsWith('/website/_astro/')) {
        res.writeHead(css, { 'content-type': 'text/css' }).end('body{}');
      } else if (req.url?.startsWith('/website/')) {
        const meta = generator === undefined ? '' : `<meta content="${generator}" name="generator">`;
        res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><html><head>${meta}${linkTag}</head><body></body></html>`);
      } else res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/website/`;
    return { url, requests, close: () => new Promise((resolve) => server.close(resolve)) };
  }
  const run = (url: string) => runStep(check, { PAGE_URL: url, SHA, HANGFOLIO_SMOKE_WAIT: '0' });

  test('the page, its stylesheet and the build SHA in the generator tag', async () => {
    const s = await site(`hangfolio 1.0.0 (${SHA.slice(0, 7)})`);
    try {
      const result = await run(s.url);
      assert.equal(result.status, 0);
      assert.equal(result.summary, `## Live at ${s.url}\n\nPublished commit 0123456. Checked build 0123456 and its stylesheet on the live site.\n\nGitHub can cache pages for up to 10 minutes: if your site looks out of date, hard-refresh the page (Ctrl+Shift+R, or Cmd+Shift+R on a Mac).\n`);
      assert.deepEqual(s.requests, ['/website/?hangfolio-check=0123456-1', '/website/_astro/Base.abc.css?hangfolio-check=0123456-1']);
    } finally {
      await s.close();
    }
  });

  test("the theme's own generator tag (lib/head.ts) carries the SHA the check looks for", async () => {
    const s = await site(generatorContent('1.0.0', 'Astro v7.3.5', SHA));
    try {
      assert.match((await run(s.url)).summary, /Checked build 0123456 and its stylesheet on the live site\./);
    } finally {
      await s.close();
    }
    const old = await site(generatorContent('1.0.0', 'Astro v7.3.5', 'fedcba9876543210fedcba9876543210fedcba98'));
    try {
      assert.match((await run(old.url)).stdout, /still shows build fedcba9876543210fedcba9876543210fedcba98, not 0123456\./);
    } finally {
      await old.close();
    }
  });

  test('an older build on the page is retried 3 times, then a warning, never a failure', async () => {
    const s = await site('hangfolio 1.0.0 (fedcba9)');
    try {
      const result = await run(s.url);
      assert.equal(result.status, 0);
      assert.equal(s.requests.length, 3);
      assert.match(result.stdout, /::warning title=Published; the live check did not pass yet::.* still shows build fedcba9, not 0123456\./);
      assert.match(result.summary, /^## Published to http/);
    } finally {
      await s.close();
    }
  });

  test('a missing stylesheet or page is a warning; a theme without a build stamp still passes', async () => {
    const css = await site(undefined, 404);
    try {
      assert.match((await run(css.url)).stdout, /its stylesheet http:\/\/127\.0\.0\.1:\d+\/website\/_astro\/Base\.abc\.css answered HTTP 404/);
    } finally {
      await css.close();
    }
    const plain = await site('Astro v7.3.5', 200, "<link href='_astro/Base.abc.css' rel='preload stylesheet'>");
    try {
      const result = await run(plain.url);
      assert.match(result.summary, /^## Live at .*\n\nPublished commit 0123456\. Checked the page and its stylesheet on the live site\./);
      assert.equal(plain.requests[1], '/website/_astro/Base.abc.css?hangfolio-check=0123456-1', 'a relative href resolves against the page');
    } finally {
      await plain.close();
    }
    const gone = await run('http://127.0.0.1:9/website/');
    assert.match(gone.stdout, /::warning title=Published; the live check did not pass yet::http:\/\/127\.0\.0\.1:9\/website\/ could not be fetched/);
  });

  test('a failed publish says how to retry', async () => {
    const explain = step(DEPLOY, 'deploy', 'Explain a failed publish');
    assert.equal(explain.if, "failure() && steps.deploy.outcome == 'failure'");
    const result = await runStep(explain, { SETTINGS });
    assert.match(result.summary, /^## Not published\n\nGitHub Pages did not take this build, so your live site is unchanged\./);
    assert.match(result.summary, /click \*\*Re-run failed jobs\*\*/);
    assert.match(result.stdout, /^::error title=Not published::/);
  });
});
