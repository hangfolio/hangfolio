// What the publications page shows (SPEC 5.6): the papers in content/publications.bib with their
// extras (content/publications/<key>.md), grouped by kind and newest first; the in-preparation
// items; the ids other pages link to; the papers the home page features; and each paper's
// ScholarlyArticle JSON-LD. Markdown fields stay Markdown here; the components render them.
import type { Publication } from '../schema/publication.ts';
import { bibHtml, displayName, isSelectedEntry, plain, type BibEntry } from './bib.ts';
import { citationView, isOwner, linkHref, ownerNames, type CitationView, type Extras } from './citation.ts';
import type { SiteYaml } from './site.ts';

export type InPrep = Extract<Publication, { status: 'in-preparation' }>;

export type PaperView = Omit<CitationView, 'title'> & {
  key: string;
  /** The article's id, and the BibTeX block's */
  anchor: string;
  bibtexAnchor: string;
  /** HTML, as written (the citation adds a full stop; the page does not) */
  title?: string;
  /** The short venue label for the margin, e.g. "EXC ’24" */
  abbr?: string;
  doi?: { text: string; href: string };
  /** extras' data line; `text` is Markdown */
  data?: { tag: string; text: string };
  /** The raw entry without its hidden fields, and the block's accessible name */
  bibtex: string;
  bibtexLabel: string;
};

export type PaperGroup = { id: string; heading: string; papers: PaperView[] };

export type PrepView = { id: string; number: string; margin?: string; title: string; chip?: string; authors: { name: string; url?: string; me: boolean }[]; text: string };

/** The article's id: extras' `anchor`, else the BibTeX key. */
export const paperAnchor = (key: string, extras?: Pick<Extras, 'anchor'>) => extras?.anchor ?? key.replace(/\s+/g, '-');

/** The BibTeX block's id: extras' `bibtexAnchor`, else bibtex-<anchor>. */
export const bibtexAnchor = (key: string, extras?: Pick<Extras, 'anchor' | 'bibtexAnchor'>) => extras?.bibtexAnchor ?? `bibtex-${paperAnchor(key, extras)}`;

/** True when a paper is featured on the home page: `selected = {true}` in BibTeX, or `featured: true` in its extras. */
export const isFeatured = (entry: BibEntry, extras?: Pick<Extras, 'featured'>) => isSelectedEntry(entry) || extras?.featured === true;

/** The DOI as written without its prefix, and its address. */
function doiOf(entry: BibEntry): PaperView['doi'] {
  const value = entry.fields.doi?.trim();
  if (!value) return undefined;
  return { text: value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, ''), href: linkHref('doi', value) };
}

export function paperView(entry: BibEntry, extras: Extras | undefined, site: SiteYaml): PaperView {
  const view = citationView(entry, extras, site);
  const doi = doiOf(entry);
  const anchor = paperAnchor(entry.key, extras);
  const bibtex = bibtexAnchor(entry.key, extras);
  const title = entry.fields.title ? bibHtml(entry.fields.title) : undefined;
  const abbr = entry.fields.abbr?.trim() ? plain(entry.fields.abbr).trim() : undefined;
  const named = abbr ? `the ${abbr} paper` : entry.fields.title ? `“${plain(entry.fields.title).trim()}”` : entry.key;
  return {
    ...view,
    key: entry.key,
    anchor,
    bibtexAnchor: bibtex,
    title,
    abbr,
    doi,
    // The DOI has its own line; [BibTeX] jumps to the block below.
    links: [...view.links.filter((link) => link.href !== doi?.href), { label: 'BibTeX', href: `#${bibtex}` }],
    data: extras?.data,
    bibtex: entry.raw.replace(/\r\n?/g, '\n'),
    bibtexLabel: `BibTeX entry for ${named}`,
  };
}

// The page's sections, in order. Each paper goes in the first group that takes its entry type;
// an @article in an arXiv-style "journal" is a preprint.
const GROUPS: { id: string; heading: string; types: string[] }[] = [
  { id: 'conference', heading: 'Conference papers', types: ['inproceedings', 'conference'] },
  { id: 'journal', heading: 'Journal articles', types: ['article'] },
  { id: 'preprints', heading: 'Preprints and reports', types: ['misc', 'unpublished', 'techreport', 'report', 'online', 'electronic', 'www', 'manual'] },
  { id: 'theses', heading: 'Theses', types: ['phdthesis', 'mastersthesis', 'thesis'] },
  { id: 'books', heading: 'Books and chapters', types: ['book', 'incollection', 'inbook', 'collection', 'booklet'] },
  { id: 'other', heading: 'Other', types: [] },
];
const PREPRINT = /\b(arxiv|preprint|biorxiv|medrxiv|ssrn|corr|research square)\b/i;

/** The group (GROUPS id) an entry belongs to. */
export function groupOf(entry: BibEntry): string {
  if (entry.type === 'article' && (PREPRINT.test(entry.fields.journal ?? '') || (!entry.fields.journal && (entry.fields.eprint || entry.fields.arxiv)))) return 'preprints';
  return GROUPS.find((group) => group.types.includes(entry.type))?.id ?? 'other';
}

/** The section ids the page uses, so extras' anchors can be checked against them. */
export const GROUP_IDS = [...GROUPS.map((group) => group.id), 'papers', 'prep'];

const yearOf = (entry: BibEntry) => Number.parseInt(entry.fields.year ?? '', 10) || -Infinity;

/** Entries newest first; the same year keeps file order. */
export const byYear = (entries: BibEntry[]) => [...entries].sort((a, b) => yearOf(b) - yearOf(a));

/** The papers in their groups, each group newest first; empty groups are left out. */
export function paperGroups(entries: BibEntry[], extras: Map<string, Extras>, site: SiteYaml): PaperGroup[] {
  const sorted = byYear(entries);
  return GROUPS.map(({ id, heading }) => ({
    id,
    heading,
    papers: sorted.filter((entry) => groupOf(entry) === id).map((entry) => paperView(entry, extras.get(entry.key), site)),
  })).filter((group) => group.papers.length > 0);
}

/** In-preparation items by `order` (then file name), numbered 01, 02 … */
export function prepViews(items: { id: string; data: InPrep }[], site: SiteYaml): PrepView[] {
  const owner = ownerNames(site);
  return [...items]
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    .map(({ id, data }, i) => ({
      id,
      number: String(i + 1).padStart(2, '0'),
      margin: data.margin,
      title: data.title,
      chip: data.chip,
      authors: (data.authors ?? []).map((author) => ({ ...author, me: isOwner({ literal: author.name }, owner) })),
      text: data.text,
    }));
}

/**
 * The papers the home page shows, by key: home.yaml's research.featured first, then every paper
 * marked `selected = {true}` or `featured: true`, newest first.
 */
export function featuredKeys(entries: BibEntry[], extras: Map<string, Pick<Extras, 'featured'>>, featured?: string): string[] {
  const keys = featured && entries.some((entry) => entry.key === featured) ? [featured] : [];
  for (const entry of byYear(entries)) if (isFeatured(entry, extras.get(entry.key)) && !keys.includes(entry.key)) keys.push(entry.key);
  return keys;
}

/** The publications page's path while it is on and has something to show. */
export function publicationsPath(site: SiteYaml, content: { papers: number; prep: number }): string | undefined {
  const page = site.pages.publications;
  return page && content.papers + content.prep > 0 ? page.path : undefined;
}

// Drops undefined values and empty arrays, so a missing field leaves no empty key.
const compact = (node: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)));

/**
 * A paper as a schema.org ScholarlyArticle, from its BibTeX fields. The site owner among the
 * authors is the site's Person (<home>#person). Extras' `schema` replaces any of the fields.
 */
export function scholarlyArticle(entry: BibEntry, extras: Extras | undefined, site: SiteYaml, urls: { page: string; home: string }): Record<string, unknown> {
  const { fields } = entry;
  const owner = ownerNames(site);
  const title = fields.title ? plain(fields.title).trim() : undefined;
  const month = /^\d{1,2}/.exec(fields.month?.trim() ?? '')?.[0];
  const year = fields.year?.trim();
  const doi = doiOf(entry);
  const url = fields.url?.trim();
  const publisher = fields.publisher ?? fields.organization;
  const node = compact({
    '@type': 'ScholarlyArticle',
    '@id': `${urls.page}#${paperAnchor(entry.key, extras)}`,
    headline: title,
    name: title,
    author: (entry.names.author ?? [])
      .filter((author) => !author.others)
      .map((author) => (isOwner(author, owner) ? { '@id': `${urls.home}#person` } : { '@type': 'Person', name: displayName(author) })),
    datePublished: year && /^\d{4}$/.test(year) ? (month ? `${year}-${month.padStart(2, '0')}` : year) : undefined,
    publisher: publisher ? { '@type': 'Organization', name: plain(publisher) } : undefined,
    pagination: fields.pages?.replace(/[–—]/g, '-'),
    identifier: doi && { '@type': 'PropertyValue', propertyID: 'DOI', value: doi.text },
    sameAs: doi?.href ?? (url && /^https?:/i.test(url) ? url : undefined),
    url: urls.page,
  });
  return { ...node, ...(extras?.schema ?? {}) };
}
