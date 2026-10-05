// content/publications.bib read with @retorquere/bibtex-parser (spike S9, docs/decisions/S9.md):
// LaTeX becomes Unicode, and @string macros and crossref are resolved. Around the parser:
// - titles keep their case (no sentence-casing; finding 1);
// - an entry the parser gave up on is left out (finding 2);
// - all text is folded to NFC, with \'\i and \"\i fixed (finding 6);
// - link fields stay byte for byte instead of being read as LaTeX (finding 7);
// - text is escaped when it becomes HTML, keeping only a few tags (bibHtml; finding 8);
// - Google Scholar's "and others" becomes "et al." (finding 9).
// Raw entry slices, W301 positions and hidden fields come with the publications page (M5).
import { FieldMode, parse, type Creator } from '@retorquere/bibtex-parser';
import { escapeHtml } from './inline-md.ts';

/** al-folio's link fields, kept verbatim (the parser already keeps url, doi, eprint and file). */
export const LINK_FIELDS = ['pdf', 'code', 'slides', 'poster', 'video', 'website', 'html', 'supp', 'arxiv', 'blog'];

/** A person in an author or editor list; `others` is "et al." */
export type BibName = { given?: string; family?: string; prefix?: string; suffix?: string; literal?: string; others?: true };

export type BibEntry = {
  key: string;
  /** Lower case: article, inproceedings … */
  type: string;
  /** Text as the parser gives it (a few HTML tags; see bibHtml), link fields verbatim */
  fields: Record<string, string>;
  /** author, editor and the other name lists */
  names: Record<string, BibName[]>;
};

/** NFC, with a dotless ı before a combining mark (what \'\i gives) turned back into i. */
export const fold = (text: string) => text.replace(/ı(?=[̀-ͯ])/g, 'i').normalize('NFC');

function name(creator: Creator): BibName {
  if (creator.lastName === 'others' && !creator.firstName && !creator.name) return { others: true };
  if (creator.name !== undefined) return { literal: fold(plain(creator.name)) };
  const out: BibName = {};
  if (creator.firstName) out.given = fold(plain(creator.firstName));
  if (creator.lastName) out.family = fold(plain(creator.lastName));
  if (creator.prefix) out.prefix = fold(plain(creator.prefix));
  if (creator.suffix) out.suffix = fold(plain(creator.suffix));
  return out;
}

/** Every readable entry in a .bib file, in file order. */
export function parseBib(source: string): BibEntry[] {
  const library = parse(source, { sentenceCase: false, verbatimFields: [...FieldMode.verbatim, ...LINK_FIELDS] });
  return library.entries
    .filter((entry) => entry.input !== '')
    .map((entry) => {
      const fields: Record<string, string> = {};
      const names: Record<string, BibName[]> = {};
      for (const [field, value] of Object.entries(entry.fields)) {
        if (typeof value === 'string') fields[field] = fold(value);
        else if (value.every((item) => typeof item === 'string')) fields[field] = fold((value as string[]).join(', '));
        else names[field] = (value as Creator[]).map(name);
      }
      return { key: entry.key, type: entry.type.toLowerCase(), fields, names };
    });
}

/** True when the entry has `example = {true}` (SPEC 5.2 rule 3). */
export const isExampleEntry = (entry: BibEntry) => entry.fields.example?.trim().toLowerCase() === 'true';

/** "Ana Lucía Núñez", "Lotte van der Berg", "Anders Berg Jr.", or "et al." */
export function displayName(person: BibName): string {
  if (person.others) return 'et al.';
  if (person.literal !== undefined) return person.literal;
  return [person.given, person.prefix, person.family, person.suffix].filter(Boolean).join(' ');
}

// The tags the parser writes into text: <i>, <b>, <sup>, <sub>, spans for nocase and small caps,
// and <a href> for \url and \href.
const TAG = /<(\/?)(i|b|em|strong|sup|sub|span|a)\b([^>]*)>/gi;
const SMALL_CAPS = /font-variant:\s*small-caps/i;

/** Text without the parser's tags. */
export const plain = (text: string) => text.replace(TAG, '');

/**
 * A field as HTML: everything escaped, then only the parser's formatting tags put back (<i>,
 * <b>, <em>, <strong>, <sup>, <sub>, and small caps as <span class="smallcaps">). Links are
 * dropped and keep their text, because a paper's links come from its link fields. Tags that
 * don't pair up are left out, and any still open at the end are closed.
 */
export function bibHtml(text: string): string {
  const open: { tag: string; kept: boolean }[] = [];
  let out = '';
  let last = 0;
  for (const match of text.matchAll(TAG)) {
    out += escapeHtml(text.slice(last, match.index));
    last = match.index + match[0].length;
    const [, closing, rawTag, attributes] = match;
    const tag = rawTag.toLowerCase();
    if (closing) {
      if (open.at(-1)?.tag !== tag) continue;
      if (open.pop()!.kept) out += `</${tag}>`;
      continue;
    }
    const smallCaps = tag === 'span' && SMALL_CAPS.test(attributes);
    const kept = smallCaps || (tag !== 'span' && tag !== 'a');
    open.push({ tag, kept });
    if (kept) out += smallCaps ? '<span class="smallcaps">' : `<${tag}>`;
  }
  out += escapeHtml(text.slice(last));
  while (open.length > 0) {
    const { tag, kept } = open.pop()!;
    if (kept) out += `</${tag}>`;
  }
  return out;
}
