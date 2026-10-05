// What a paper shows as a citation (components/Citation.astro), from its BibTeX entry
// (lib/bib.ts) and its optional extras file, content/publications/<key>.md (SPEC 5.6):
// the authors with the site owner's name underlined and equal-contribution marks, the title,
// the venue and place, and the links.
import type { Project } from '../schema/project.ts';
import type { Publication } from '../schema/publication.ts';
import { bibHtml, displayName, plain, type BibEntry, type BibName } from './bib.ts';
import { escapeHtml } from './inline-md.ts';
import type { SiteYaml } from './site.ts';
import { resolveLinks } from './work.ts';

export type Extras = Exclude<Publication, { status: 'in-preparation' }>;

export type CitationAuthor = { name: string; me: boolean; equal: boolean };

export type CitationView = {
  year?: string;
  authors: CitationAuthor[];
  /** HTML, ending with a full stop unless it already ends with . ? or ! */
  title?: string;
  /** HTML: extras' venueDetail, else the journal, booktitle, school or institution */
  venue?: string;
  place?: string;
  /** The equal-contribution note, when an author is marked */
  note?: string;
  links: { label: string; href: string }[];
};

/** Lower case, accents and punctuation removed: "Núñez-Ruiz, A." is "nunez ruiz a". */
export function normalizeName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

type Person = { given: string[]; family: string };

/** "Rowan Vale" or "Vale, Rowan" as given names and a family name (the last word without a comma). */
export function personOf(text: string): Person {
  const [before, after] = text.split(/,(.*)/s);
  if (after !== undefined && after.trim()) return { given: normalizeName(after).split(' '), family: normalizeName(before) };
  const words = normalizeName(text).split(' ');
  return { given: words.slice(0, -1), family: words.at(-1) ?? '' };
}

/** "R" matches "Rowan", and so does "Rowan"; nothing else does. */
const sameGiven = (a: string, b: string) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/** The names that count as the site owner: `name` (split by advanced.nameParts if set) and nameVariants. */
export function ownerNames(site: Pick<SiteYaml, 'name' | 'nameVariants' | 'advanced'>): Person[] {
  const parts = site.advanced.nameParts;
  const main = parts ? { given: normalizeName(parts.given).split(' '), family: normalizeName(parts.family) } : personOf(site.name);
  return [main, ...site.nameVariants.map(personOf)];
}

/**
 * True when an author is one of `names`: the same family name after accents and case are set
 * aside, and given names that agree as far as both go, where an initial matches a whole name.
 */
export function isOwner(author: BibName, names: Person[]): boolean {
  if (author.others) return false;
  const person = author.literal !== undefined ? personOf(author.literal) : { given: normalizeName(author.given ?? '').split(' ').filter(Boolean), family: normalizeName([author.prefix, author.family].filter(Boolean).join(' ')) };
  return names.some((name) => {
    const family = name.family === person.family || name.family === normalizeName(author.family ?? '');
    if (!family) return false;
    const given = name.given.filter(Boolean);
    return person.given.length === 0 || given.length === 0 || sameGiven(person.given[0], given[0]);
  });
}

/** How `equal` may name an author: "Berg" or "van der Berg"; a literal name as written. */
function surnames(author: BibName): string[] {
  if (author.others) return [];
  if (author.literal !== undefined) return [normalizeName(author.literal)];
  const family = normalizeName(author.family ?? '');
  return author.prefix ? [family, normalizeName(`${author.prefix} ${author.family ?? ''}`)] : [family];
}

// The BibTeX fields that become links, in order, with their labels (al-folio's names).
const LINKS: [string, string][] = [
  ['pdf', 'PDF'],
  ['doi', 'DOI'],
  ['url', 'Link'],
  ['code', 'Code'],
  ['slides', 'Slides'],
  ['poster', 'Poster'],
  ['video', 'Video'],
  ['website', 'Website'],
];

/** A link field as an address: a DOI becomes https://doi.org/…, and a bare file name a file in /files/. */
export function linkHref(field: string, value: string): string {
  const text = value.trim();
  if (field === 'doi') return /^https?:/i.test(text) ? text : `https://doi.org/${text.replace(/^doi:\s*/i, '')}`;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) || text.includes('/')) return text;
  return `/files/${text}`;
}

const VENUE_FIELDS = ['journal', 'booktitle', 'school', 'institution'];

export function citationView(entry: BibEntry, extras: Extras | undefined, site: SiteYaml): CitationView {
  const { fields } = entry;
  const owner = ownerNames(site);
  const equal = new Set((extras?.equal ?? []).map(normalizeName));
  const authors = (entry.names.author ?? []).map((author) => ({
    name: displayName(author),
    me: isOwner(author, owner),
    equal: surnames(author).some((surname) => equal.has(surname)),
  }));

  const title = fields.title && bibHtml(fields.title) + (/[.?!]$/.test(plain(fields.title).trim()) ? '' : '.');
  const venueField = VENUE_FIELDS.find((field) => fields[field]);
  const venue = extras?.venueDetail ? escapeHtml(extras.venueDetail) : venueField && bibHtml(fields[venueField]);

  const links: CitationView['links'] = [];
  const add = (label: string, href: string) => links.some((link) => link.href === href) || links.push({ label, href });
  for (const [field, label] of LINKS) if (fields[field]?.trim()) add(label, linkHref(field, fields[field]));
  for (const link of resolveLinks((extras?.links ?? []) as Project['links'], site)) if ('href' in link) add(link.label, link.href);

  return {
    year: fields.year?.trim() || undefined,
    authors,
    title: title || undefined,
    venue: venue || undefined,
    place: extras?.place,
    note: authors.some((author) => author.equal) ? extras?.authorNote : undefined,
    links,
  };
}
