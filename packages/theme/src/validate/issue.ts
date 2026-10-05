// One problem the validator found (SPEC 5.10): its catalogue code, where it is, and what to do.
// The first letter of a code is its severity: E fails the build, W is a warning, N a notice.
import { readFileSync } from 'node:fs';

export const TITLES = {
  E101: 'YAML syntax',
  E102: 'Tabs in indentation',
  E103: 'Front matter not closed',
  E201: 'Unknown field',
  E202: 'Wrong value',
  E203: 'Missing field',
  E204: 'Bad date',
  W205: 'Text is long',
  E206: 'Stray quote',
  W206: 'Quotes shown as text',
  W301: 'BibTeX problem',
  E302: 'Broken reference',
  E303: 'Used twice',
  E401: 'Example value',
  W402: 'Example hidden',
  W403: 'Example entry hidden',
  W404: 'Example file hidden',
  E501: 'Missing file',
  W601: 'Link includes the base',
  W603: 'Large file',
  W605: 'Old result',
  N701: 'Plumbing file outdated',
  W801: 'Long QR address',
  W802: 'No photo in card.vcf',
  N803: 'Local QR address',
} as const;

export type Code = keyof typeof TITLES;
export type Severity = 'error' | 'warning' | 'notice';

export type Issue = {
  code: Code;
  /** The path in the site with forward slashes (site.yaml, content/news.yaml), if any */
  file?: string;
  line?: number;
  col?: number;
  endLine?: number;
  endCol?: number;
  /** A full sentence or two: what is wrong and how to fix it */
  message: string;
  /** Text to paste, shown under the message (N701's replacement file) */
  fix?: string;
  /** For dev notices that belong to one page, such as N803 on /card */
  page?: string;
};

export function severity(code: Code): Severity {
  return code.startsWith('E') ? 'error' : code.startsWith('W') ? 'warning' : 'notice';
}

/** W402, W403 and W404: example content that is hidden, listed apart from the problems. */
export const isHiddenExample = (issue: Issue) => issue.code === 'W402' || issue.code === 'W403' || issue.code === 'W404';

export const VERSION: string = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

/** The troubleshooting page at the installed theme's exact tag (SPEC 11). */
export function docsUrl(code?: Code): string {
  const page = `https://github.com/hangfolio/hangfolio/blob/hangfolio@${VERSION}/docs/troubleshooting.md`;
  return code ? `${page}#${code.toLowerCase()}` : page;
}

/** site.yaml first, then content/, then everything else; by line within a file. */
export function sortIssues(issues: Issue[]): Issue[] {
  const rank = (file = '') => (file === 'site.yaml' ? 0 : file.startsWith('content/') ? 1 : file ? 2 : 3);
  return [...issues].sort(
    (a, b) =>
      rank(a.file) - rank(b.file) ||
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      (a.col ?? 0) - (b.col ?? 0) ||
      a.code.localeCompare(b.code) ||
      a.message.localeCompare(b.message),
  );
}

export function counts(issues: Issue[]) {
  const by = (s: Severity) => issues.filter((issue) => severity(issue.code) === s).length;
  return { errors: by('error'), warnings: by('warning'), notices: by('notice') };
}
