// The docs link check (SPEC 10.2, 11), run by `npm run docs:check`:
// - every catalogue code (E201, W601 …) has its anchor in docs/troubleshooting.md, because every
//   message links to troubleshooting.md#<code>;
// - every relative link in the Markdown docs, and every link to this repository's own docs on
//   GitHub, points to a file that exists, and to a heading or id that exists in it.
// External links are not fetched.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { TITLES } from '../../src/validate/issue.ts';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const TROUBLESHOOTING = join(REPO, 'docs/troubleshooting.md');
// Links to this repository's files on GitHub, at any branch or tag.
const OWN_REPO = /^https:\/\/github\.com\/hangfolio\/hangfolio\/(?:blob|tree)\/[^/]+\/([^#?]*)(?:\?[^#]*)?(#.*)?$/;

/** The Markdown files whose links are checked: docs/, the READMEs and AGENTS files. */
function markdownFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.md')) found.push(path);
    }
  };
  if (existsSync(join(REPO, 'docs'))) walk(join(REPO, 'docs'));
  for (const file of ['README.md', 'AGENTS.md', 'starter/README.md', 'starter/AGENTS.md', 'fixtures/README.md']) {
    if (existsSync(join(REPO, file))) found.push(join(REPO, file));
  }
  return found.sort();
}

/** The text with fenced and inline code blanked out, so examples are not read as links. */
const withoutCode = (text: string) =>
  text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, (block) => block.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, (code) => ' '.repeat(code.length));

/** GitHub's heading ids: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function anchorsOf(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  const text = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
  for (const m of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) {
    const plain = m[1].replace(/<[^>]+>/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
    const slug = plain.toLowerCase().trim().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
    const n = counts.get(slug) ?? 0;
    counts.set(slug, n + 1);
    anchors.add(n === 0 ? slug : `${slug}-${n}`);
  }
  for (const m of markdown.matchAll(/<[a-z][^>]*\s(?:id|name)\s*=\s*["']([^"']+)["']/gi)) anchors.add(m[1]);
  return anchors;
}

/** Every link target in a Markdown file, with its line. */
function linksOf(markdown: string): { target: string; line: number }[] {
  const text = withoutCode(markdown);
  const links: { target: string; line: number }[] = [];
  const lineOf = (index: number) => text.slice(0, index).split('\n').length;
  for (const m of text.matchAll(/!?\[(?:[^\]\\]|\\.)*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) links.push({ target: m[1], line: lineOf(m.index) });
  for (const m of text.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$/gm)) links.push({ target: m[1], line: lineOf(m.index) });
  for (const m of text.matchAll(/<(?:a|img)\s[^>]*?(?:href|src)\s*=\s*["']([^"']+)["']/gi)) links.push({ target: m[1], line: lineOf(m.index) });
  return links;
}

/** What is wrong with one link from `file`, or undefined when it resolves. */
function brokenLink(file: string, target: string): string | undefined {
  let path: string;
  let hash = '';
  const own = OWN_REPO.exec(target);
  if (own) {
    path = join(REPO, decodeURIComponent(own[1]));
    hash = own[2] ?? '';
  } else if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)) {
    return undefined; // another site, or mailto:
  } else {
    const cut = target.search(/[?#]/);
    const rel = decodeURIComponent(cut === -1 ? target : target.slice(0, cut));
    hash = cut === -1 ? '' : target.slice(cut).replace(/^\?[^#]*/, '');
    path = rel === '' ? file : rel.startsWith('/') ? join(REPO, rel) : resolve(dirname(file), rel);
  }
  if (!existsSync(path)) return `${relative(REPO, path).split(sep).join('/')} does not exist`;
  const fragment = decodeURIComponent(hash.replace(/^#/, ''));
  if (!fragment || !path.endsWith('.md') || statSync(path).isDirectory()) return undefined;
  if (/^L\d+(?:-L\d+)?$/.test(fragment)) return undefined; // a line link
  const anchors = anchorsOf(readFileSync(path, 'utf8'));
  if (anchors.has(fragment) || anchors.has(fragment.toLowerCase())) return undefined;
  return `${relative(REPO, path).split(sep).join('/')} has no heading or id "${fragment}"`;
}

test('docs/troubleshooting.md has an anchor for every error, warning and notice code', () => {
  assert.ok(existsSync(TROUBLESHOOTING), 'docs/troubleshooting.md does not exist; every message links to it');
  const anchors = anchorsOf(readFileSync(TROUBLESHOOTING, 'utf8'));
  const missing = Object.keys(TITLES).filter((code) => !anchors.has(code.toLowerCase()));
  assert.deepEqual(missing, [], `docs/troubleshooting.md needs a heading or <a id="…"> for: ${missing.map((code) => `#${code.toLowerCase()}`).join(', ')}`);
});

test('every link in the Markdown docs resolves', () => {
  const files = markdownFiles();
  assert.ok(files.length > 0, 'no Markdown files found');
  const broken: string[] = [];
  for (const file of files) {
    for (const { target, line } of linksOf(readFileSync(file, 'utf8'))) {
      const problem = brokenLink(file, target);
      if (problem) broken.push(`${relative(REPO, file).split(sep).join('/')}:${line} ${target}: ${problem}`);
    }
  }
  assert.deepEqual(broken, [], `broken links:\n${broken.join('\n')}`);
});

test('the checker itself: slugs, explicit ids, and broken targets', () => {
  const anchors = anchorsOf('# E201: Unknown field\n## `site.yaml` & you\n## Repeat\n## Repeat\n<a id="w601"></a>\n```\n# not a heading\n```\n');
  assert.deepEqual([...anchors].sort(), ['e201-unknown-field', 'repeat', 'repeat-1', 'siteyaml--you', 'w601']);
  assert.match(brokenLink(join(REPO, 'README.md'), 'docs/nope.md') ?? '', /^docs\/nope\.md does not exist$/);
  assert.match(brokenLink(join(REPO, 'README.md'), 'AGENTS.md#no-such-heading') ?? '', /^AGENTS\.md has no heading or id "no-such-heading"$/);
  assert.equal(brokenLink(join(REPO, 'README.md'), 'AGENTS.md#hard-rules'), undefined);
  assert.equal(brokenLink(join(REPO, 'README.md'), 'https://github.com/hangfolio/hangfolio/blob/v1/AGENTS.md#hard-rules'), undefined);
  assert.equal(brokenLink(join(REPO, 'README.md'), 'https://example.org/x'), undefined);
});
