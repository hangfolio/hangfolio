// The docs link check (SPEC 10.2, PLAN M9): `npm run docs:check`. No network; exits 1 on any problem.
//
// 1. Every relative link in docs/ and in the starter's README.md and AGENTS.md points at a file that
//    exists, and at a heading or <a id> that exists when it has a #fragment.
// 2. Every link to the docs on GitHub (https://github.com/hangfolio/hangfolio/blob/<ref>/docs/…), in
//    those files and in the starter's comments (site.yaml's "Help:" lines), is checked the same way
//    against the local docs/.
// 3. Every code the validator can report (TITLES in packages/theme/src/validate/issue.ts) has its
//    anchor in docs/troubleshooting.md, in the form docsUrl() links to: #e201 for E201.
// 4. The field reference in docs/site-yaml.md matches the site schema (tools/site-yaml-reference.mjs).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { current, reference } from './site-yaml-reference.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DOCS = join(ROOT, 'docs');
const STARTER = join(ROOT, 'starter');
const ISSUES = join(ROOT, 'packages/theme/src/validate/issue.ts');
const DOCS_ON_GITHUB = /https:\/\/github\.com\/hangfolio\/hangfolio\/(?:blob|tree)\/[^/\s]+\/docs(\/[^\s)"'<>`]*)?/g;

const problems = [];
const report = (file, message) => problems.push(`${relative(ROOT, file)}: ${message}`);

function walk(dir, keep) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (['node_modules', 'dist', '.astro'].includes(name)) return [];
    return statSync(path).isDirectory() ? walk(path, keep) : keep(path) ? [path] : [];
  });
}

/** Markdown without fenced code, inline code and HTML comments, so examples aren't read as links. */
const prose = (text) =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');

/** GitHub's heading ids (github-slugger): lower case, punctuation dropped, spaces to hyphens. */
function slug(heading) {
  const text = heading
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, (c) => (c === '_' ? '_' : ''))
    .trim()
    .toLowerCase();
  return text.replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
}

const anchorCache = new Map();
function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const text = readFileSync(file, 'utf8').replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '');
  const found = new Set();
  const seen = new Map();
  for (const [, heading] of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) {
    const base = slug(heading);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    found.add(n === 0 ? base : `${base}-${n}`);
  }
  for (const [, id] of text.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) found.add(id);
  anchorCache.set(file, found);
  return found;
}

/** Checks that `target` (a path, maybe with #fragment) exists, relative to `from`'s folder or as given. */
function checkTarget(from, path, fragment, base = dirname(from)) {
  const target = path ? resolve(base, decodeURIComponent(path)) : from;
  if (!existsSync(target)) return report(from, `links to ${relative(ROOT, target)}, which doesn't exist`);
  if (fragment === undefined || fragment === '') return;
  if (statSync(target).isDirectory() || !target.endsWith('.md')) return report(from, `links to #${fragment} in ${relative(ROOT, target)}, which has no headings`);
  if (!anchors(target).has(decodeURIComponent(fragment))) {
    report(from, `links to #${fragment} in ${relative(ROOT, target)}, but it has no such heading or anchor`);
  }
}

/** A link to the docs on GitHub, checked against the local docs/ folder. */
function checkDocsUrl(from, found) {
  const url = found.replace(/[.,;:!?]+$/, ''); // a full stop after an address in a sentence
  const match = /\/docs(\/[^#]*)?(?:#(.*))?$/.exec(url);
  const path = (match?.[1] ?? '/').replace(/^\//, '') || '.';
  checkTarget(from, path, match?.[2], DOCS);
}

// 1 and 2: the Markdown files.
const markdown = [
  ...walk(DOCS, (path) => path.endsWith('.md') && !path.includes(`${join('docs', 'decisions')}/S`)),
  join(STARTER, 'README.md'),
  join(STARTER, 'AGENTS.md'),
];
for (const file of markdown) {
  if (!existsSync(file)) {
    report(file, 'is missing');
    continue;
  }
  const text = prose(readFileSync(file, 'utf8'));
  for (const [, target] of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
      if (target.match(DOCS_ON_GITHUB)) checkDocsUrl(file, target);
      continue;
    }
    const [path, fragment] = target.split('#');
    checkTarget(file, path, fragment);
  }
  for (const [url] of readFileSync(file, 'utf8').matchAll(DOCS_ON_GITHUB)) checkDocsUrl(file, url);
}

// 2: links to the docs in the starter's other files ("Help:" comments).
for (const file of walk(STARTER, (path) => /\.(ya?ml|bib|md|css|json|mjs|ts)$/.test(path) && !markdown.includes(path))) {
  for (const [url] of readFileSync(file, 'utf8').matchAll(DOCS_ON_GITHUB)) checkDocsUrl(file, url);
}

// 3: one troubleshooting anchor per error code, in the form the validator links to.
const issueSource = readFileSync(ISSUES, 'utf8');
const codes = [...issueSource.matchAll(/^\s+([EWN]\d{3}): '/gm)].map((m) => m[1]);
// The /card page and its codes are not part of 0.1 (DEFERRED_CODES); their entries come with it.
const DEFERRED = new Set(/DEFERRED_CODES[^=]*=\s*\[([^\]]*)\]/.exec(issueSource)?.[1].match(/[EWN]\d{3}/g) ?? []);
if (codes.length === 0) report(ISSUES, 'no codes found in TITLES; update tools/docs-check.mjs');
if (!/docs\/troubleshooting\.md/.test(issueSource) || !/code\.toLowerCase\(\)/.test(issueSource)) {
  report(ISSUES, "docsUrl() no longer links to docs/troubleshooting.md#<code in lower case>; update tools/docs-check.mjs to match");
}
const troubleshooting = join(DOCS, 'troubleshooting.md');
for (const code of codes) {
  if (DEFERRED.has(code)) continue;
  if (!anchors(troubleshooting).has(code.toLowerCase())) report(troubleshooting, `has no #${code.toLowerCase()} anchor for ${code}`);
}

// 4: the generated field reference.
try {
  const { text, a, b } = current();
  if (text.slice(a, b) !== reference()) report(join(DOCS, 'site-yaml.md'), 'the field reference is stale; run `node tools/site-yaml-reference.mjs`');
} catch (error) {
  report(join(DOCS, 'site-yaml.md'), error.message);
}

const placeholders = markdown.reduce((n, file) => n + (readFileSync(file, 'utf8').match(/<!-- SCREENSHOT step-\d/g)?.length ?? 0), 0);
if (problems.length > 0) {
  console.error(`docs check: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
const checked = codes.filter((code) => !DEFERRED.has(code)).length;
console.log(`docs check: ${markdown.length} files, ${checked} error codes anchored, field reference fresh` + (placeholders ? `; ${placeholders} screenshots still to add at release` : ''));
