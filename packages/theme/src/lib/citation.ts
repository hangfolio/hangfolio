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

// Letters that keep their look without an accent to drop: Søren is Soren, Straßer is Strasser.
const LETTERS: Record<string, string> = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

/** Lower case, accents and punctuation removed: "Núñez-Ruiz, A." is "nunez ruiz a". */
export function normalizeName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßłđðþı]/g, (letter) => LETTERS[letter])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** `words` is the whole name, for a name written without a comma, whose family name may be several words. */
type Person = { given: string[]; family: string; words?: string[] };

/** "Rowan Vale" or "Vale, Rowan" as given names and a family name (the last word without a comma). */
export function personOf(text: string): Person {
  const [before, after] = text.split(/,(.*)/s);
  if (after !== undefined && after.trim()) return { given: normalizeName(after).split(' '), family: normalizeName(before) };
  const words = normalizeName(text).split(' ');
  return { given: words.slice(0, -1), family: words.at(-1) ?? '' };
}

/** "R" matches "Rowan", and so does "Rowan"; nothing else does. */
const sameGiven = (a: string, b: string) => a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

/** A name as the owner wrote it: "Vale, R." is exact; "Gabriel García Márquez" keeps all its words. */
function ownerPerson(text: string): Person {
  const person = personOf(text);
  if (text.includes(',')) return person;
  const words = normalizeName(text).split(' ').filter((word, i, all) => word && !(i > 0 && i === all.length - 1 && SUFFIXES.has(word)));
  return { ...person, words };
}

/** The names that count as the site owner: `name` (split by advanced.nameParts if set) and nameVariants. */
export function ownerNames(site: Pick<SiteYaml, 'name' | 'nameVariants' | 'advanced'>): Person[] {
  const parts = site.advanced.nameParts;
  const main = parts ? { given: normalizeName(parts.given).split(' '), family: normalizeName(parts.family) } : ownerPerson(site.name);
  return [main, ...site.nameVariants.map(ownerPerson)];
}

/** The owner's given names when `family` is their family name; undefined when it is not. */
function givenWith(name: Person, family: string): string[] | undefined {
  if (!family) return undefined;
  if (!name.words) return name.family === family ? name.given : undefined;
  const parts = family.split(' ');
  if (parts.length > name.words.length) return undefined;
  const rest = name.words.length - parts.length;
  return name.words.slice(rest).join(' ') === family ? name.words.slice(0, rest) : undefined;
}

/**
 * True when an author is one of `names`: the same family name (with or without a prefix such as
 * "van der") after accents, case and punctuation are set aside, and first names that agree,
 * where an initial matches a whole name. "Vale, Rowan", "R. Vale" and "Rowan Vale" all match
 * the name Rowan Vale; a family name of several words matches the end of the name.
 */
export function isOwner(author: BibName, names: Person[]): boolean {
  if (author.others) return false;
  const person = author.literal !== undefined ? personOf(author.literal) : { given: normalizeName(author.given ?? '').split(' ').filter(Boolean), family: normalizeName([author.prefix, author.family].filter(Boolean).join(' ')) };
  const families = [person.family, normalizeName(author.family ?? '')];
  return names.some((name) =>
    families.some((family) => {
      const given = givenWith(name, family)?.filter(Boolean);
      if (!given) return false;
      return person.given.length === 0 || given.length === 0 || sameGiven(person.given[0], given[0]);
    }),
  );
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
  ['arxiv', 'arXiv'],
  ['url', 'Link'],
  ['code', 'Code'],
  ['slides', 'Slides'],
  ['poster', 'Poster'],
  ['video', 'Video'],
  ['website', 'Website'],
  ['html', 'HTML'],
  ['supp', 'Supplement'],
  ['blog', 'Blog'],
];

/**
 * A link field as an address: a DOI becomes https://doi.org/…, an arXiv id https://arxiv.org/abs/…,
 * and a bare file name a file in /files/.
 */
export function linkHref(field: string, value: string): string {
  const text = value.trim();
  if (field === 'doi') return /^https?:/i.test(text) ? text : `https://doi.org/${text.replace(/^doi:\s*/i, '')}`;
  if (field === 'arxiv' && !/^https?:/i.test(text)) return `https://arxiv.org/abs/${text.replace(/^arxiv:\s*/i, '')}`;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) || text.includes('/')) return text;
  return `/files/${text}`;
}

const VENUE_FIELDS = ['journal', 'booktitle', 'school', 'institution', 'howpublished', 'publisher'];

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
  // howpublished often holds just \url{…}, which is a link, not a venue
  const venueField = VENUE_FIELDS.find((field) => fields[field] && !(field === 'howpublished' && /:\/\/|<a\b/.test(fields[field])));
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
