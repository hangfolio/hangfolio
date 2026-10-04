// The report as text: one line per issue for the golden tests (fixtures/broken), and the
// terminal output of `hangfolio check`, `hangfolio build` and `hangfolio dev`, grouped by
// severity, with the source line under each problem.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Report } from './index.ts';
import { counts, docsUrl, isHiddenExample, severity, type Issue } from './issue.ts';

/** `site.yaml:3:10`, `site.yaml` or nothing. */
export function where(issue: Issue): string {
  if (!issue.file) return '';
  return issue.line ? `${issue.file}:${issue.line}${issue.col ? `:${issue.col}` : ''}` : issue.file;
}

/** One line per issue, `file:line:col CODE message`, with any fix text indented under it. */
export function plainLines(issues: Issue[]): string {
  return issues
    .map((issue) => {
      const head = [where(issue), issue.code, issue.message].filter(Boolean).join(' ');
      return issue.fix ? `${head}\n${indent(issue.fix, '    ')}` : head;
    })
    .join('\n');
}

const indent = (text: string, pad: string) => text.replace(/\n$/, '').split('\n').map((line) => pad + line).join('\n');

type Style = (text: string) => string;
const ANSI = (open: number, close: number): Style => (text) => `\u001b[${open}m${text}\u001b[${close}m`;

function styles(color: boolean) {
  const plain: Style = (text) => text;
  return {
    error: color ? ANSI(31, 39) : plain,
    warning: color ? ANSI(33, 39) : plain,
    notice: color ? ANSI(36, 39) : plain,
    dim: color ? ANSI(2, 22) : plain,
    bold: color ? ANSI(1, 22) : plain,
  };
}

/** Whether to color text for a stream: a terminal, and NO_COLOR not set. */
export const wantsColor = (stream: { isTTY?: boolean }, env: Record<string, string | undefined>) =>
  Boolean(stream.isTTY) && !env.NO_COLOR && env.TERM !== 'dumb';

/** The terminal report. */
export function terminalReport(report: Report, { color = false } = {}): string {
  const s = styles(color);
  const sources = new Map<string, string[] | undefined>();
  const linesOf = (file: string) => {
    if (!sources.has(file)) {
      try {
        sources.set(file, readFileSync(join(report.root, file), 'utf8').split('\n'));
      } catch {
        sources.set(file, undefined);
      }
    }
    return sources.get(file);
  };
  const show = (issue: Issue) => {
    const level = severity(issue.code);
    const head = `  ${where(issue) ? `${s.bold(where(issue))}  ` : ''}${s[level](`${level} ${issue.code}`)}  ${issue.message}`;
    const text = issue.file && issue.line ? linesOf(issue.file)?.[issue.line - 1]?.replace(/\r$/, '') : undefined;
    const out = [head];
    if (text !== undefined && !isHiddenExample(issue)) {
      const n = String(issue.line);
      out.push(s.dim(`    ${n} | ${text}`), s.dim(`    ${' '.repeat(n.length)} | ${' '.repeat(Math.max(0, (issue.col ?? 1) - 1))}^`));
    }
    if (issue.fix) out.push(s.dim(indent(issue.fix, '      ')));
    return out.join('\n');
  };

  const problems = report.issues.filter((i) => !isHiddenExample(i));
  const hidden = report.issues.filter(isHiddenExample);
  const groups: [string, Issue[]][] = [
    ['Errors', problems.filter((i) => severity(i.code) === 'error')],
    ['Warnings', problems.filter((i) => severity(i.code) === 'warning')],
    ['Notices', problems.filter((i) => severity(i.code) === 'notice')],
    ['Hidden on your site because they are still examples', hidden],
  ];
  const content = report.files.filter((f) => f.startsWith('content/')).length;
  const out = [s.bold(`hangfolio check: site.yaml and ${content} ${content === 1 ? 'file' : 'files'} in content/`)];
  if (report.demo) {
    out.push(
      '',
      'Demo mode: name and email are still the example ones, so the whole example site shows, with a',
      'banner and noindex. Change both in site.yaml to make the site yours.',
    );
  }
  for (const [title, issues] of groups) {
    if (issues.length > 0) out.push('', s.bold(title), ...issues.map(show));
  }
  out.push('', summary(report, s));
  return `${out.join('\n')}\n`;
}

/** The last line: how many of each, and where the help is. */
function summary(report: Report, s: ReturnType<typeof styles>): string {
  const { errors, warnings, notices } = counts(report.issues.filter((i) => !isHiddenExample(i)));
  const hidden = report.issues.filter(isHiddenExample).length;
  const parts = [
    errors > 0 ? s.error(plural(errors, 'error')) : 'No errors',
    warnings > 0 && s.warning(plural(warnings, 'warning')),
    notices > 0 && s.notice(plural(notices, 'notice')),
    hidden > 0 && `${plural(hidden, 'example')} hidden`,
  ].filter(Boolean);
  const codes = [...new Set(report.issues.map((issue) => `#${issue.code.toLowerCase()}`))].sort();
  const help = codes.length > 0 ? ` Help: ${docsUrl()} (${codes.join(', ')})` : '';
  return `${parts.join(', ')}.${help}`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
