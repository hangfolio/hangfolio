// Checks on the papers in content/publications.bib that need the rest of the site: link fields
// that name a file in public/ that isn't there (E501), and ids on the publications page used
// twice (E303), whether two papers share an anchor or a paper takes a section's id. With the
// publications page off, only the papers the home page features are checked, and for files only.
import { isExampleEntry, LINK_FIELDS, type BibEntry } from '../lib/bib.ts';
import { bibtexAnchor, GROUP_IDS, isFeatured, paperAnchor } from '../lib/bib-page.ts';
import { linkHref } from '../lib/citation.ts';
import type { Loaded } from './content-files.ts';
import { findPublicFile } from './files.ts';
import type { Issue } from './issue.ts';
import { locate } from './source.ts';

type Input = {
  root: string;
  bib: { file: string; text: string };
  entries: BibEntry[];
  /** Every content file; the publications extras are picked out */
  loaded: Loaded[];
  /** Files example mode hides */
  hiddenFiles: Set<string>;
  demo: boolean;
  /** pages.publications is not false */
  pageOn: boolean;
  /** home.yaml's research.featured */
  featured?: string;
};

const FILE_FIELDS = ['url', ...LINK_FIELDS];
// A bare name that is really a web address, like example.org
const DOMAIN = /^(?:[a-z\d-]+\.)+(?:com|org|net|edu|gov|io|dev|ai|co|app|info|me|uk|de|fr|ca|au|in|cn|jp)$/i;

export function bibIssues(input: Input): Issue[] {
  return [...missingBibFiles(input), ...(input.pageOn ? anchorIssues(input) : [])];
}

/** The publications extras files that apply, by key. */
function extrasByKey({ loaded, hiddenFiles }: Input): Map<string, Loaded> {
  const extras = new Map<string, Loaded>();
  for (const file of loaded) {
    if (file.kind === 'publications' && file.data && file.data.status !== 'in-preparation' && !hiddenFiles.has(file.file)) extras.set(file.id!, file);
  }
  return extras;
}

/** The line in an entry where `field = …` starts (the entry's first line if not found). */
function fieldLine(text: string, entry: BibEntry, field: string): number {
  const lines = text.split('\n').slice(entry.line - 1, entry.endLine);
  const i = lines.findIndex((line) => new RegExp(`(?:^|[\\s,{(])${field}\\s*=`, 'i').test(line));
  return entry.line + Math.max(i, 0);
}

/** E501 for a link field that names a file in public/ that doesn't exist. Example entries are skipped. */
function missingBibFiles(input: Input): Issue[] {
  const { root, bib, entries, pageOn, featured } = input;
  const extras = extrasByKey(input);
  const issues: Issue[] = [];
  for (const entry of entries) {
    if (isExampleEntry(entry)) continue;
    if (!pageOn && entry.key !== featured && !isFeatured(entry, extras.get(entry.key)?.data)) continue;
    for (const field of FILE_FIELDS) {
      const value = entry.fields[field]?.trim();
      if (!value) continue;
      const href = linkHref(field, value);
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) continue;
      const path = href.replace(/[?#].*$/, '');
      const bare = !value.includes('/');
      // Pages (no extension, or .html) aren't files; a bare name always is.
      if (!bare && (!/\.[a-z\d]{1,5}$/i.test(path) || /\.html?$/i.test(path))) continue;
      const found = findPublicFile(root, path);
      if (found.exists) continue;
      const where = `public${path.startsWith('/') ? '' : '/'}${path}`;
      let hint = found.hint.replace(/([^.?!])$/, '$1.');
      if (bare) hint = hint.replace(/^Did you mean \/files\/(.+)\?/, 'Did you mean $1?');
      if (bare && DOMAIN.test(value)) hint = `If it's a web address, write ${field} = {https://${value}}.`;
      else if (bare && hint.startsWith('There is no public/files folder')) hint = `A file name on its own means a file in public/files/, and there is no such folder yet: create it and put ${value} in it.`;
      else if (bare) hint += ' A file name on its own means a file in public/files/.';
      issues.push({ code: 'E501', file: bib.file, line: fieldLine(bib.text, entry, field), col: 1, message: `${field} = {${value}} links to ${where}, which doesn't exist. ${hint}` });
    }
  }
  return issues;
}

const SECTIONS: Record<string, string> = {
  conference: 'the Conference papers heading',
  journal: 'the Journal articles heading',
  preprints: 'the Preprints and reports heading',
  theses: 'the Theses heading',
  books: 'the Books and chapters heading',
  other: 'the Other heading',
  papers: 'the list of papers',
  prep: 'the In preparation heading',
  main: "the page's main content",
};

/** E303 for an id on the publications page that two things would share. */
function anchorIssues(input: Input): Issue[] {
  const { bib, entries, demo } = input;
  const extras = extrasByKey(input);
  const owners = new Map<string, string>([...GROUP_IDS, 'main'].map((id) => [id, SECTIONS[id] ?? 'a section']));
  const issues: Issue[] = [];
  for (const entry of entries) {
    if (!demo && isExampleEntry(entry)) continue;
    const file = extras.get(entry.key);
    const anchor = paperAnchor(entry.key, file?.data);
    const ids: [string, 'anchor' | 'bibtexAnchor' | undefined][] = [
      [anchor, file?.data.anchor ? 'anchor' : undefined],
      [`${anchor}-title`, undefined],
      [bibtexAnchor(entry.key, file?.data), file?.data.bibtexAnchor ? 'bibtexAnchor' : undefined],
    ];
    for (const [id, setBy] of ids) {
      const owner = owners.get(id);
      if (!owner) {
        owners.set(id, `the paper ${entry.key}`);
        continue;
      }
      if (setBy && file) {
        const where = locate(file.source, [setBy]);
        const message = `${setBy}: ${id} is already the id of ${owner} on the publications page, so links to it would go to the wrong place. Pick another ${setBy}.`;
        issues.push({ code: 'E303', file: file.file, ...(where && { line: where.line, col: where.col, endLine: where.endLine, endCol: where.endCol }), message });
      } else {
        const fix = `Rename the key, or give the paper its own anchor in content/publications/${entry.key}.md (anchor: …).`;
        const message = `The paper ${entry.key} gets the id ${id}, which is already the id of ${owner} on the publications page. ${fix}`;
        issues.push({ code: 'E303', file: bib.file, line: entry.line, col: 1, message });
      }
      break;
    }
  }
  return issues;
}
