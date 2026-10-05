// `hangfolio verify [dist] [--github]`: checks the built site in dist/ (or the folder given) for
// the address that the build used: site.yaml `url`, else SITE_PAGES_URL, else the repository name
// on GitHub, else localhost (SPEC 7.1). Exits 1 when there is an error; warnings don't fail.
import { appendFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { plural, wantsColor, where } from '../validate/format.ts';
import { annotations } from '../validate/github.ts';
import type { Report } from '../validate/index.ts';
import { counts, docsUrl, severity, TITLES, type Issue } from '../validate/issue.ts';
import { readSiteConfig } from './read-site.ts';
import { resolveSiteUrl } from './site-url.ts';
import { verifyDist, type VerifyResult } from './verify.ts';

type Stream = { write(text: string): unknown; isTTY?: boolean };
type Args = { root: string; args: string[]; env: Record<string, string | undefined>; out: Stream; err: Stream };

export const VERIFY_USAGE = 'Usage: hangfolio verify [folder] [--github]   (the folder is dist by default)';

export async function runVerify({ root, args, env, out, err }: Args): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    out.write(`${VERIFY_USAGE}\nChecks the links, files and addresses in the site that npx hangfolio build wrote.\n`);
    return 0;
  }
  const options = args.filter((arg) => arg.startsWith('-'));
  const folders = args.filter((arg) => !arg.startsWith('-'));
  const unknown = options.find((arg) => arg !== '--github');
  if (unknown || folders.length > 1) {
    err.write(`hangfolio verify: ${unknown ? `unknown option ${unknown}` : `one folder at most, not ${folders.join(' ')}`}\n${VERIFY_USAGE}\n`);
    return 2;
  }
  const dist = resolve(root, folders[0] ?? 'dist');
  const label = relative(root, dist).split(sep).join('/') || '.';
  if (!existsSync(dist) || !statSync(dist).isDirectory()) {
    err.write(`hangfolio verify: there is no ${label}/ folder. Build the site first: npx hangfolio build\n`);
    return 1;
  }
  if (['site.yaml', 'package.json', 'node_modules'].some((name) => existsSync(join(dist, name)))) {
    err.write(`hangfolio verify: ${label}/ is the site's own folder, not the built site. Build it with npx hangfolio build, then run npx hangfolio verify, which checks dist/.\n`);
    return 1;
  }

  const { site } = readSiteConfig(join(root, 'site.yaml'));
  let address: ReturnType<typeof resolveSiteUrl>;
  try {
    address = resolveSiteUrl(site.url, env);
  } catch (error) {
    err.write(`${(error as Error).message}\n`);
    return 1;
  }
  const urlFormat = site.advanced.urlFormat;
  const result = verifyDist({ dist, origin: address.origin, base: address.base, urlFormat, label, source: address.source });
  const home = new URL(`${address.base.replace(/\/+$/, '')}/`, address.origin).href;

  out.write(verifyReport(result, { label, home, urlFormat, color: wantsColor(out, env) }));
  if (args.includes('--github')) {
    const report: Report = { root, issues: result.issues, demo: false, home, files: [] };
    out.write(annotations(report, env));
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, verifySummary(result, home));
  }
  return counts(result.issues).errors > 0 ? 1 : 0;
}

type ReportOptions = { label: string; home: string; urlFormat: string; color?: boolean };

/** The terminal report: what was checked, each problem on one line, and a tally. */
export function verifyReport(result: VerifyResult, { label, home, urlFormat, color = false }: ReportOptions): string {
  const paint = (code: number) => (text: string) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
  const bold = paint(1);
  const tint = { error: paint(31), warning: paint(33), notice: paint(36) };
  const checked = [plural(result.pages, 'page'), plural(result.css, 'stylesheet'), plural(result.xml, 'XML file')].join(', ');
  const out = [bold(`hangfolio verify: ${label}/ for ${home} (urlFormat ${urlFormat})`), `${checked}; ${plural(result.links, 'internal link')} and file references checked`];
  const show = (issue: Issue) => `  ${where(issue) ? `${bold(where(issue))}  ` : ''}${tint[severity(issue.code)](`${severity(issue.code)} ${issue.code}`)}  ${issue.message}`;
  for (const [title, level] of [['Errors', 'error'], ['Warnings', 'warning']] as const) {
    const issues = result.issues.filter((issue) => severity(issue.code) === level);
    if (issues.length > 0) out.push('', bold(title), ...issues.map(show));
  }
  const { errors, warnings } = counts(result.issues);
  if (errors + warnings === 0) {
    out.push('', 'No problems.');
  } else {
    const codes = [...new Set(result.issues.map((issue) => `#${issue.code.toLowerCase()}`))].sort();
    const tally = [errors > 0 ? tint.error(plural(errors, 'error')) : 'No errors', warnings > 0 && tint.warning(plural(warnings, 'warning'))].filter(Boolean).join(', ');
    out.push('', `${tally}.${errors > 0 ? ` Fix ${errors + warnings === 1 ? 'it' : 'them'}, then build and verify again.` : ''} Help: ${docsUrl()} (${codes.join(', ')})`);
  }
  return `${out.join('\n')}\n`;
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

/** The job summary: one table with every problem. */
export function verifySummary(result: VerifyResult, home: string): string {
  const { errors, warnings } = counts(result.issues);
  const out = ['## hangfolio verify', ''];
  const checked = `${plural(result.pages, 'page')} and ${plural(result.links, 'internal link')} checked for ${home}`;
  out.push(errors + warnings === 0 ? `No problems: ${checked}.` : `**${plural(errors, 'error')}, ${plural(warnings, 'warning')}** (${checked}).`);
  if (result.issues.length > 0) {
    out.push('', '| | Where | Code | What to do |', '|---|---|---|---|');
    for (const issue of result.issues) {
      out.push(`| ${severity(issue.code)} | \`${where(issue) || 'site'}\` | [${issue.code}](${docsUrl(issue.code)}) ${TITLES[issue.code]} | ${cell(issue.message)} |`);
    }
  }
  return `${out.join('\n')}\n`;
}
