// References between files (E302) and names used twice (E303): home.yaml's featured paper,
// publication extras matched to BibTeX keys by file name, `profile:` links to site.yaml's links,
// two Markdown files with the same id, and two BibTeX entries with the same key.
import type { BibEntry } from './bib-keys.ts';
import type { Loaded } from './content-files.ts';
import type { Issue } from './issue.ts';
import { locate } from './source.ts';
import { didYouMean, listOf } from './suggest.ts';

export type Refs = {
  loaded: Loaded[];
  bib?: { file: string; entries: BibEntry[] };
  /** Ids of site.yaml's links: those shown, and those example mode hides */
  linkIds: string[];
  hiddenLinkIds: string[];
  /** Files and BibTeX keys that example mode hides */
  hiddenFiles: Set<string>;
  hiddenKeys: Set<string>;
};

const at = (loaded: Loaded, path: PropertyKey[]) => {
  const where = locate(loaded.source, path);
  return { file: loaded.file, ...(where && { line: where.line, col: where.col, endLine: where.endLine, endCol: where.endCol }) };
};

/** "Did you mean 'x'?", or the list of what exists. */
function choices(word: string, known: string[], what: string, none: string): string {
  const close = didYouMean(word, known);
  if (close) return `Did you mean '${close}'?`;
  return known.length > 0 ? `${what}: ${listOf(known, 10)}` : none;
}

export function referenceIssues(refs: Refs): Issue[] {
  const issues: Issue[] = [];
  const visible = refs.loaded.filter((file) => file.data && !refs.hiddenFiles.has(file.file));
  const bibKeys = refs.bib?.entries.map((entry) => entry.key) ?? [];
  const extras = refs.loaded.filter((file) => file.kind === 'publications');
  const pubKeys = [...new Set([...bibKeys, ...extras.map((file) => file.id!)])];

  const home = visible.find((file) => file.kind === 'home');
  const featured = home?.data.research?.featured as string | undefined;
  if (home && featured) {
    let message: string | undefined;
    if (!pubKeys.includes(featured)) {
      message = `research.featured is '${featured}' but no publication has that key. ${choices(featured, pubKeys, 'Keys', 'There are no publications yet.')}`;
    } else if (refs.hiddenKeys.has(featured) || extras.some((f) => f.id === featured && refs.hiddenFiles.has(f.file))) {
      message = `research.featured is '${featured}', an example paper that is hidden on your site. Feature one of your own papers, or delete the line.`;
    }
    if (message) issues.push({ code: 'E302', ...at(home, ['research', 'featured']), message });
  }

  for (const file of visible.filter((f) => f.kind === 'publications' && f.data.status !== 'in-preparation')) {
    if (bibKeys.includes(file.id!)) continue;
    const where = refs.bib ? choices(file.id!, bibKeys, 'Keys', `${refs.bib.file} has no entries yet.`) : 'There is no content/publications.bib yet.';
    const message = `This file adds extras to the BibTeX entry '${file.id}', but no entry has that key. ${where}`;
    issues.push({ code: 'E302', file: file.file, line: file.source.opener, col: file.source.opener && 1, message });
  }

  for (const file of visible) {
    for (const { path, id } of profileRefs(file.data)) {
      let message: string | undefined;
      if (refs.hiddenLinkIds.includes(id) && !refs.linkIds.includes(id)) {
        message = `profile '${id}' is an example link in site.yaml, which is hidden. Replace that link with yours, or use another profile.`;
      } else if (!refs.linkIds.includes(id)) {
        message = `profile '${id}' isn't the id of any link in site.yaml. ${choices(id, refs.linkIds, 'Link ids', 'site.yaml has no links yet.')}`;
      }
      if (message) issues.push({ code: 'E302', ...at(file, [...path, 'profile']), message });
    }
  }

  issues.push(...duplicateIds(refs.loaded), ...duplicateKeys(refs.bib));
  return issues;
}

/** Every { profile } object in parsed data, with its path. */
function profileRefs(data: unknown, path: PropertyKey[] = []): { path: PropertyKey[]; id: string }[] {
  if (Array.isArray(data)) return data.flatMap((item, i) => profileRefs(item, [...path, i]));
  if (!data || typeof data !== 'object') return [];
  const found = typeof (data as { profile?: unknown }).profile === 'string' ? [{ path, id: (data as { profile: string }).profile }] : [];
  return [...found, ...Object.entries(data).flatMap(([key, value]) => (key === 'profile' ? [] : profileRefs(value, [...path, key])))];
}

/** tidepool.md and tidepool.mdx in one folder are both the entry 'tidepool'. */
function duplicateIds(loaded: Loaded[]): Issue[] {
  const seen = new Map<string, Loaded>();
  const issues: Issue[] = [];
  for (const file of loaded.filter((f) => f.id !== undefined)) {
    const key = `${file.kind}/${file.id}`;
    const first = seen.get(key);
    if (!first) seen.set(key, file);
    else issues.push({ code: 'E303', file: file.file, message: `${first.file} has the same name, so both would be the entry '${file.id}'. Rename or delete one of them.` });
  }
  return issues;
}

function duplicateKeys(bib: Refs['bib']): Issue[] {
  const first = new Map<string, number>();
  const issues: Issue[] = [];
  for (const entry of bib?.entries ?? []) {
    const line = first.get(entry.key);
    if (line === undefined) first.set(entry.key, entry.line);
    else issues.push({ code: 'E303', file: bib!.file, line: entry.line, col: 1, message: `The key '${entry.key}' is already used on line ${line}. Give each entry its own key.` });
  }
  return issues;
}
