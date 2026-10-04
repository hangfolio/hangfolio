// `hangfolio check [--github]`: exit codes, the terminal report, GitHub annotations and the job
// summary (SPEC 5.10, 8.2). The last test runs the real command, which loads the TypeScript
// checks through Vite's module runner as it must under node_modules.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../src/validate/cli.ts';
import { annotations, stepSummary } from '../src/validate/github.ts';
import type { Report } from '../src/validate/index.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const BIN = join(REPO, 'packages/theme/bin/hangfolio.mjs');
const work = mkdtempSync(join(tmpdir(), 'hangfolio-cli-'));
after(() => rmSync(work, { recursive: true, force: true }));

/** A copy of fixtures/broken/_base plus one case, in a `site` folder inside a "checkout". */
function caseSite(name: string): { checkout: string; root: string } {
  const checkout = join(work, name);
  const root = join(checkout, 'site');
  cpSync(join(REPO, 'fixtures/broken/_base'), root, { recursive: true });
  cpSync(join(REPO, 'fixtures/broken', name), root, { recursive: true, filter: (src) => !src.endsWith('expected.txt') });
  return { checkout, root };
}

function capture() {
  let text = '';
  return { stream: { write: (chunk: string) => (text += chunk), isTTY: false }, text: () => text };
}

test('exit codes: 0 without errors, 1 with an error, 2 for an unknown option', async () => {
  const run = async (root: string, args: string[] = []) => {
    const out = capture();
    const err = capture();
    const code = await runCheck({ root, args, env: {}, out: out.stream, err: err.stream });
    return { code, out: out.text(), err: err.text() };
  };
  const starter = await run(join(REPO, 'starter'));
  assert.equal(starter.code, 0);
  assert.match(starter.out, /^hangfolio check: site\.yaml and 7 files in content\/\n\nDemo mode: /);
  assert.match(starter.out, /\nNo errors\.\n$/);

  const broken = await run(caseSite('13-e201-unknown-field').root);
  assert.equal(broken.code, 1);
  assert.equal(
    broken.out,
    [
      'hangfolio check: site.yaml and 1 file in content/',
      '',
      'Errors',
      "  content/projects/kelp.md:3:1  error E201  Unknown field 'sumary'. Did you mean 'summary'?",
      '    3 | sumary: "Counts kelp from drone photos."',
      '      | ^',
      '',
      `1 error. Help: https://github.com/hangfolio/hangfolio/blob/hangfolio@0.0.0/docs/troubleshooting.md (#e201)`,
      '',
    ].join('\n'),
  );
  const warnings = await run(caseSite('40-w404-example-avatar').root);
  assert.equal(warnings.code, 0);

  const usage = await run(join(REPO, 'starter'), ['--gihub']);
  assert.equal(usage.code, 2);
  assert.equal(usage.err, 'hangfolio check: unknown option --gihub\nUsage: hangfolio check [--github]\n');
});

const report: Report = {
  root: '/work/repo/site',
  demo: false,
  home: 'https://u.github.io/',
  files: ['site.yaml'],
  issues: [
    { code: 'E101', file: 'site.yaml', line: 3, col: 10, endLine: 3, endCol: 20, message: "This value contains ': ' and needs quotes: tagline: \"a: b, 100%\"" },
    { code: 'N701', file: 'astro.config.mjs', line: 1, col: 1, message: 'astro.config.mjs has no hangfolio-plumbing line.', fix: 'line one\nline two\n' },
    { code: 'W403', file: 'content/news.yaml', line: 4, col: 7, message: 'This news item is an example | hidden.' },
  ],
};
const env = { GITHUB_WORKSPACE: '/work/repo', GITHUB_REPOSITORY: 'juniper/site', GITHUB_SHA: 'abc123', GITHUB_REF_NAME: 'main' };

test('--github: one annotation per issue, escaped, with paths from the checkout', () => {
  const lines = annotations(report, env).trimEnd().split('\n');
  assert.equal(
    lines[0],
    '::error file=site/site.yaml,line=3,col=10,endLine=3,endColumn=20,title=E101 YAML syntax::' +
      "This value contains ': ' and needs quotes: tagline: \"a: b, 100%25\"%0AHelp: https://github.com/hangfolio/hangfolio/blob/hangfolio@0.0.0/docs/troubleshooting.md#e101",
  );
  assert.match(lines[1], /^::notice file=site\/astro\.config\.mjs,line=1,col=1,title=N701 Plumbing file outdated::.*%0AReplace it with:%0Aline one%0Aline two%0A%0AHelp: /);
  assert.match(lines[2], /^::warning file=site\/content\/news\.yaml,line=4,col=7,title=W403 Example entry hidden::/);
  assert.equal(lines.length, 3);
});

test('--github: the job summary lists every issue, the hidden examples apart, and the plumbing fix', () => {
  const summary = stepSummary(report, env);
  assert.match(summary, /^## hangfolio check\n\n\*\*1 error, 0 warnings, 1 notice\.\*\* The site was not built;/);
  assert.match(summary, /\| error \| \[`site\.yaml:3:10`\]\(https:\/\/github\.com\/juniper\/site\/blob\/abc123\/site\/site\.yaml#L3\) \| \[E101\]\(https:\/\/github\.com\/hangfolio\/hangfolio\/blob\/hangfolio@0\.0\.0\/docs\/troubleshooting\.md#e101\) \|/);
  assert.match(summary, /### Hidden on your site: 1 example\n/);
  assert.match(summary, /This news item is an example \\\| hidden\./);
  assert.match(summary, /<summary>N701 astro\.config\.mjs: the replacement text \(<a href="https:\/\/github\.com\/juniper\/site\/edit\/main\/site\/astro\.config\.mjs">edit it<\/a>\)<\/summary>\n\n```\nline one\nline two\n```/);
});

test('the hangfolio command runs the check, writes the summary and fails the step', () => {
  const { checkout, root } = caseSite('34-e401-example-tagline');
  const summary = join(checkout, 'summary.md');
  writeFileSync(summary, '');
  const result = spawnSync(process.execPath, [BIN, 'check', '--github'], {
    cwd: root,
    env: { ...process.env, ...env, GITHUB_WORKSPACE: checkout, GITHUB_STEP_SUMMARY: summary, NO_COLOR: '1' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /site\.yaml:3:1 {2}error E401 {2}tagline is still the example text\. Write your own sentence\./);
  assert.match(result.stdout, /^::error file=site\/site\.yaml,line=3,col=1,endLine=3,endColumn=\d+,title=E401 Example value::tagline is still/m);
  assert.match(readFileSync(summary, 'utf8'), /\| error \| \[`site\.yaml:3:1`\]/);
});
