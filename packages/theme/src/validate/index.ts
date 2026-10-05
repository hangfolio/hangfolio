// The validator (SPEC 5.10): reads site.yaml, content/ and public/, runs every check, and
// collects every issue at once. `hangfolio check` prints the report; the integration runs the
// same checks before each build and in dev, and takes from it the site the pages show.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findAvatar } from '../lib/avatar.ts';
import { readBib as parseBibFile } from '../lib/bib.ts';
import { resolveSiteUrl } from '../lib/site-url.ts';
import { isDemoIdentity, starterValues, type StarterValues } from '../lib/starter-values.ts';
import { absUrl } from '../lib/url.ts';
import { checkPlumbing } from '../schema/plumbing.ts';
import type { Site } from '../schema/site.ts';
import { baseLinkIssues } from './base-links.ts';
import { scanBib } from './bib-keys.ts';
import { cardPath, hasSharp, localQrNotice, photoIssue, qrIssue } from './card.ts';
import { loadContent, loadSite, readBib, type Loaded } from './content-files.ts';
import { staleResults, taglineIssue } from './content-checks.ts';
import { exampleEntries } from './entries.ts';
import { entryIssues, siteExamples, visibleSite } from './example.ts';
import { largeFiles, missingFiles } from './files.ts';
import { sortIssues, type Issue } from './issue.ts';
import { referenceIssues } from './references.ts';

export type Mode = 'check' | 'build' | 'dev';

export type Options = {
  mode?: Mode;
  env?: Record<string, string | undefined>;
  /** For W605; tests pin it */
  now?: Date;
  /** Whether sharp is installed (W802); found out when not given */
  sharp?: boolean;
  starter?: StarterValues;
};

export type Report = {
  root: string;
  issues: Issue[];
  /** name and email are still the starter's, so the whole example site shows (SPEC 5.2) */
  demo: boolean;
  /** site.yaml as parsed, when it is valid */
  site?: Site;
  /** What the pages show: example values hidden outside demo mode, and the avatar found */
  visible?: Site;
  /** The site's home page address */
  home: string;
  /** The files read, relative to the site */
  files: string[];
};

export async function validateSite(root: string, options: Options = {}): Promise<Report> {
  const { mode = 'check', env = process.env, now = new Date() } = options;
  const starter = options.starter ?? starterValues();
  const issues: Issue[] = [];

  const siteResult = loadSite(root);
  const siteFile = siteResult.loaded;
  const site = siteFile?.data as Site | undefined;
  const demo = isDemoIdentity(siteFile?.raw?.name, siteFile?.raw?.email, starter);
  const content = loadContent(root);
  const bibText = readBib(root);
  const bib = bibText && { file: bibText.file, entries: scanBib(bibText.text) };
  issues.push(...siteResult.issues, ...content.issues, ...plumbing(root));
  if (bibText) issues.push(...parseBibFile(bibText.text).problems.map((problem) => ({ code: 'W301' as const, file: bibText.file, line: problem.line, col: problem.col, message: problem.message })));

  const { origin, base } = resolveSiteUrl(site?.url, env);
  const home = absUrl('/', origin, base);

  // Example mode (SPEC 5.2)
  let visible = site;
  const hiddenFiles = new Set<string>();
  const hiddenKeys = new Set<string>();
  let hiddenLinkIds: string[] = [];
  if (!demo) {
    const entries = exampleEntries(content.loaded, bib);
    issues.push(...entryIssues(entries, starter));
    for (const entry of entries) {
      if (entry.kind === 'bib') hiddenKeys.add(entry.key!);
      else if (entry.kind !== 'experience' && entry.kind !== 'news') hiddenFiles.add(entry.file);
    }
    if (site && siteFile) {
      const examples = siteExamples(site, siteFile.source, starter, root);
      issues.push(...examples.issues);
      visible = visibleSite(site, examples.hidden);
      hiddenLinkIds = examples.hidden.links.map((i) => site.links[i].id);
    }
  }
  const shown = content.loaded.filter((file) => !hiddenFiles.has(file.file));

  if (visible) {
    issues.push(...referenceIssues({ loaded: content.loaded, bib, linkIds: visible.links.map((l) => l.id), hiddenLinkIds, hiddenFiles, hiddenKeys }));
  }
  const fileTargets = shown.filter((f) => f.raw).map((loaded) => ({ loaded, data: withoutHiddenItems(loaded, !demo) }));
  if (siteFile && visible) fileTargets.unshift({ loaded: siteFile, data: visible });
  issues.push(...missingFiles(root, fileTargets, base), ...largeFiles(root));

  for (const file of [siteFile, ...content.loaded]) {
    if (file) issues.push(...baseLinkIssues(file.file, file.source.text, base));
  }
  if (siteFile?.data) issues.push(...taglineIssue(siteFile));
  const homeFile = shown.find((file) => file.kind === 'home');
  if (homeFile?.data) issues.push(...staleResults(homeFile, now));

  if (visible) {
    visible = { ...visible, avatar: visible.avatar ?? findAvatar(root) };
    issues.push(...(await cardIssues(root, visible, site!, siteFile!, home, mode, options.sharp)));
  }

  const files = [siteFile, ...content.loaded].filter(Boolean).map((file) => file!.file);
  if (bib) files.push(bib.file);
  return { root, issues: tidy(issues), demo, site, visible, home, files };
}

async function cardIssues(root: string, visible: Site, site: Site, siteFile: Loaded, home: string, mode: Mode, sharp?: boolean) {
  const path = cardPath(visible);
  if (!path) return [];
  const issues = qrIssue(home, path, siteFile.source, Boolean(site.url));
  if (mode === 'dev' && new URL(home).hostname === 'localhost') issues.push(localQrNotice(home, path));
  const avatar = visible.avatar;
  if (avatar && !/^[a-z]+:|^\/\//i.test(avatar) && existsSync(join(root, 'public', avatar))) {
    issues.push(...photoIssue(root, avatar.startsWith('/') ? avatar : `/${avatar}`, sharp ?? (await hasSharp()), siteFile.source, avatar === site.avatar));
  }
  return issues;
}

/** N701 for each plumbing file that is missing, unmarked or outdated (SPEC 9, layer 4). */
function plumbing(root: string): Issue[] {
  const read = (file: string) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : undefined);
  return checkPlumbing(read).map(({ file, line, message, replacement }) => ({ code: 'N701', file, line, col: line && 1, message, fix: replacement }));
}

/** A list file's data with the example entries that example mode hides blanked out (indices kept). */
function withoutHiddenItems(loaded: Loaded, hide: boolean): unknown {
  const list = loaded.kind === 'experience' ? 'entries' : loaded.kind === 'news' ? 'items' : undefined;
  const items = list && loaded.raw?.[list];
  if (!Array.isArray(items)) return loaded.raw;
  return { ...loaded.raw, [list!]: items.map((item) => (hide && item?.example === true ? null : item)) };
}

/** Sorted, each issue once, and no W601 on a line that already has an E501. */
function tidy(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const missing = new Set(issues.filter((i) => i.code === 'E501').map((i) => `${i.file}:${i.line}`));
  return sortIssues(issues).filter((issue) => {
    const key = `${issue.code}|${issue.file}|${issue.line}|${issue.col}|${issue.message}`;
    if (seen.has(key) || (issue.code === 'W601' && missing.has(`${issue.file}:${issue.line}`))) return false;
    seen.add(key);
    return true;
  });
}

export { counts, docsUrl, isHiddenExample, severity, TITLES, type Code, type Issue } from './issue.ts';
