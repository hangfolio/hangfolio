// `hangfolio check --github` (SPEC 5.10, 8.2): an annotation for each issue, on its exact line in
// the commit, the run and pull request diffs, and a table of every issue in the job summary,
// because GitHub shows only a few annotations per step.
import { realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Report } from './index.ts';
import { counts, docsUrl, isHiddenExample, severity, TITLES, type Issue } from './issue.ts';
import { plural, where } from './format.ts';

type Env = Record<string, string | undefined>;

const data = (text: string) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const property = (text: string) => data(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** The path GitHub knows a file by: relative to the checkout, which may hold the site in a folder. */
function repoPath(report: Report, file: string, env: Env): string {
  const workspace = real(env.GITHUB_WORKSPACE ?? report.root);
  return relative(workspace, join(real(report.root), file)).split(sep).join('/');
}

/** The path with symlinks resolved (a temp folder on macOS is under /private), when it exists. */
function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/** One `::error file=…,line=…::message` line per issue. */
export function annotations(report: Report, env: Env): string {
  return report.issues
    .map((issue) => {
      const props: string[] = [];
      if (issue.file) props.push(`file=${property(repoPath(report, issue.file, env))}`);
      if (issue.line) props.push(`line=${issue.line}`);
      if (issue.line && issue.col) props.push(`col=${issue.col}`);
      if (issue.line && issue.endLine === issue.line && issue.endCol) props.push(`endLine=${issue.endLine}`, `endColumn=${issue.endCol}`);
      props.push(`title=${property(`${issue.code} ${TITLES[issue.code]}`)}`);
      const body = [issue.message, issue.fix && `Replace it with:\n${issue.fix}`, `Help: ${docsUrl(issue.code)}`].filter(Boolean).join('\n');
      return `::${severity(issue.code)} ${props.join(',')}::${data(body)}\n`;
    })
    .join('');
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

/** The job summary: every problem in one table and the hidden examples in another. */
export function stepSummary(report: Report, env: Env): string {
  const server = env.GITHUB_SERVER_URL ?? 'https://github.com';
  const repo = env.GITHUB_REPOSITORY;
  const branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME;
  const link = (issue: Issue) => {
    const text = `\`${where(issue) || 'site'}\``;
    if (!repo || !env.GITHUB_SHA || !issue.file) return text;
    return `[${text}](${server}/${repo}/blob/${env.GITHUB_SHA}/${repoPath(report, issue.file, env)}${issue.line ? `#L${issue.line}` : ''})`;
  };
  const code = (issue: Issue) => `[${issue.code}](${docsUrl(issue.code)})`;

  const problems = report.issues.filter((i) => !isHiddenExample(i));
  const hidden = report.issues.filter(isHiddenExample);
  const { errors, warnings, notices } = counts(problems);
  const out = ['## hangfolio check', ''];
  const tally = [plural(errors, 'error'), plural(warnings, 'warning'), plural(notices, 'notice')].join(', ');
  out.push(errors > 0 ? `**${tally}.** The site was not built; fix the errors below and commit again.` : `${tally}.`);
  if (report.demo) out.push('', 'This is the example site: `name` and `email` in `site.yaml` are still the example ones. It shows with a banner and is not indexed until you change both.');
  if (problems.length > 0) {
    out.push('', '| | Where | Code | What to do |', '|---|---|---|---|');
    for (const issue of problems) out.push(`| ${severity(issue.code)} | ${link(issue)} | ${code(issue)} | ${cell(issue.message)} |`);
  }
  if (hidden.length > 0) {
    out.push('', `### Hidden on your site: ${plural(hidden.length, 'example')}`, '', 'These are still the example content, so your site leaves them out.', '');
    out.push('| Where | Code | Why |', '|---|---|---|');
    for (const issue of hidden) out.push(`| ${link(issue)} | ${code(issue)} | ${cell(issue.message)} |`);
  }
  for (const issue of problems.filter((i) => i.fix)) {
    const edit = repo && branch && issue.file ? ` (<a href="${server}/${repo}/edit/${branch}/${repoPath(report, issue.file, env)}">edit it</a>)` : '';
    out.push('', `<details><summary>${issue.code} ${issue.file}: the replacement text${edit}</summary>`, '', '```', issue.fix!.replace(/\n$/, ''), '```', '', '</details>');
  }
  return `${out.join('\n')}\n`;
}
