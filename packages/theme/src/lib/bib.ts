// content/publications.bib read with @retorquere/bibtex-parser (spike S9, docs/decisions/S9.md):
// LaTeX becomes Unicode, and @string macros and crossref are resolved. Around the parser:
// - titles keep their case (no sentence-casing; finding 1);
// - an entry the parser gave up on is left out and reported on its first line (findings 2, 4);
// - each entry keeps its raw text, cut at its closing brace, without the hidden fields (3, 10);
// - unknown @string names and LaTeX commands are reported on their lines (finding 5);
// - all text is folded to NFC, with \'\i and \"\i fixed (finding 6);
// - link fields stay byte for byte instead of being read as LaTeX (finding 7);
// - text is escaped when it becomes HTML, keeping only a few tags (bibHtml; finding 8);
// - Google Scholar's "and others" becomes "et al." (finding 9).
import { FieldMode, parse, type Creator } from '@retorquere/bibtex-parser';
import { escapeHtml } from './inline-md.ts';

/** al-folio's link fields, kept verbatim (the parser already keeps url, doi, eprint and file). */
export const LINK_FIELDS = ['pdf', 'code', 'slides', 'poster', 'video', 'website', 'html', 'supp', 'arxiv', 'blog'];

/** Fields left out of the BibTeX block the page shows (SPEC 5.6). */
export const HIDDEN_FIELDS = ['abstract', 'file', 'keywords', 'annote', 'example'];

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
  /** The entry as written, from @ to its closing brace, without the hidden fields */
  raw: string;
  /** The entry's first and last lines in the file */
  line: number;
  endLine: number;
};

/** Something wrong in the file (W301). `skipped` when an entry was left out because of it. */
export type BibProblem = { line: number; col?: number; key?: string; message: string; skipped: boolean };

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

/** Every readable entry in a .bib file, in file order (readBib also gives the problems). */
export function parseBib(source: string): BibEntry[] {
  return readBib(source).entries;
}

/**
 * Every readable entry, in file order, and the problems found. An entry that can't be read, or
 * has no key, is left out; the rest of the file still counts. A second entry with a key already
 * used is left out too (the checks report it as E303).
 */
export function readBib(source: string): { entries: BibEntry[]; problems: BibProblem[] } {
  const lineAt = lineFinder(source);
  const problems: BibProblem[] = [];
  const unknownCommands: { key: string; tex: string }[] = [];
  const library = parse(source, {
    sentenceCase: false,
    verbatimFields: [...FieldMode.verbatim, ...LINK_FIELDS],
    // Called for a LaTeX command the parser doesn't know; it stays in the text as written.
    // Those in @preamble have no entry and don't matter.
    unsupported: (_node, tex, entry) => {
      if (entry?.key) unknownCommands.push({ key: entry.key, tex });
      return tex;
    },
  });

  const entries: BibEntry[] = [];
  const starts = new Map<string, number>();
  let cursor = 0;
  for (const entry of library.entries) {
    if (entry.input === '') continue; // read halfway, then given up on: an error says where
    const start = source.indexOf(entry.input, cursor);
    if (start < 0) continue;
    const end = Math.min(scanEntry(source, start).close + 1, start + entry.input.length);
    cursor = end;
    const line = lineAt(start);
    if (!entry.key) {
      problems.push({ line, col: 1, skipped: true, message: 'This entry has no key, so it is skipped. Add one after the opening brace, like @article{vale2024,' });
      continue;
    }
    if (starts.has(entry.key)) continue;
    starts.set(entry.key, start);

    // A } too many inside a field ends the entry early, and the fields after it read as free text.
    const next = source.indexOf('@', end);
    const after = source.slice(end, next < 0 ? source.length : next).replace(/%[^\n]*/g, '');
    if (/[A-Za-z][\w:.+-]*\s*=\s*[{"\w]/.test(after)) {
      const message = `The entry ${entry.key} ends early: line ${lineAt(end - 1)} has one } too many, so the fields after it are left out. Remove the extra }.`;
      problems.push({ line, col: 1, key: entry.key, skipped: false, message });
    }

    const fields: Record<string, string> = {};
    const names: Record<string, BibName[]> = {};
    for (const [field, value] of Object.entries(entry.fields)) {
      if (typeof value === 'string') fields[field] = fold(value);
      else if (value.every((item) => typeof item === 'string')) fields[field] = fold((value as string[]).join(', '));
      else names[field] = (value as Creator[]).map(name);
    }
    const raw = withoutHiddenFields(source.slice(start, end));
    entries.push({ key: entry.key, type: entry.type.toLowerCase(), fields, names, raw, line, endLine: lineAt(end - 1) });
  }

  for (const { key, tex } of unknownCommands) {
    const start = starts.get(key);
    if (start === undefined) continue;
    const at = source.indexOf(tex, start);
    const message = `The entry ${key} uses ${tex}, a LaTeX command the site doesn't know, so it shows as written.`;
    problems.push({ line: lineAt(at < 0 ? start : at), col: 1, key, skipped: false, message });
  }

  problems.push(...errorProblems(source, library.errors, lineAt));
  problems.sort((a, b) => a.line - b.line);
  return { entries, problems };
}

/** The parser's errors as problems, each on the line where its entry starts. */
function errorProblems(source: string, errors: { error: string; input?: string }[], lineAt: (offset: number) => number): BibProblem[] {
  const problems: BibProblem[] = [];
  let cursor = 0;
  let brokenEnd = -1;
  for (const { error, input } of errors) {
    const macro = /Unresolved @string reference "([^"]+)"/.exec(error);
    if (macro) {
      problems.push(unknownString(source, macro[1], lineAt));
      continue;
    }
    if (!input?.startsWith('@')) continue;
    const at = source.indexOf(input, cursor);
    if (at < 0) continue;
    cursor = at + 1;
    // After an error the parser starts again at the next @, which may be an address inside the
    // entry it just gave up on. Skip that echo: an @ before the entry's closing brace that does
    // not begin a line.
    if (at < brokenEnd && source[at - 1] !== '\n') continue;
    brokenEnd = scanEntry(source, at).close;
    problems.push(errorProblem(input, error, lineAt(at)));
  }
  return problems;
}

function errorProblem(input: string, error: string, line: number): BibProblem {
  const where = /at line (\d+), column (\d+)/.exec(error);
  const found = where ? Number(where[1]) : line;
  const head = /^@\s*([A-Za-z]+)\s*([{(])\s*([^,\s})]*)/.exec(input);
  // An @ in free text (an email address, say): BibTeX starts an entry at every @.
  if (!head) {
    const message = `Line ${line} has an @ outside an entry, and BibTeX reads every @ as the start of one. Put % at the start of the line to make it a comment, or remove the @.`;
    return { line, col: 1, skipped: false, message };
  }
  const key = head[3] || undefined;
  let reason = `something on line ${found} isn't valid BibTeX`;
  if (/^Token mismatch, expected "[})]", found "@/.test(error)) reason = `its closing ${head[2] === '(' ? ')' : '}'} is missing`;
  else if (/^Token mismatch, expected "[})]", found "[\w:.+-]+\s*=/.test(error)) reason = `a comma is missing at the end of line ${filledLineBefore(input, line, found)}`;
  else if (/^Unterminated brace-value/.test(error)) reason = 'a { is never closed';
  else if (/^Unterminated quote-value/.test(error)) reason = 'a " is never closed';
  else if (/^Unclosed math section/.test(error)) reason = `a $ on line ${found} is never closed`;
  else if (/equals sign missing/.test(error)) reason = `a field on line ${found} has no = after its name`;
  const message = `Couldn't read ${key ? `the entry ${key}` : 'this entry'} (${reason}). It's skipped; the rest of the file is fine.`;
  return { line, col: 1, key, skipped: true, message };
}

/** The last line with text before line `before`, in `input`, which starts on line `line`. */
function filledLineBefore(input: string, line: number, before: number): number {
  const lines = input.split('\n');
  let i = before - line - 1;
  while (i > 0 && !lines[i]?.trim()) i--;
  return line + Math.max(i, 0);
}

function unknownString(source: string, macro: string, lineAt: (offset: number) => number): BibProblem {
  const escaped = macro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const use = new RegExp(`([A-Za-z][\\w:.+-]*)\\s*=\\s*(?:[^,\\n]*#\\s*)?${escaped}\\b`, 'i').exec(source);
  const field = use?.[1] ?? 'field';
  return {
    line: use ? lineAt(use.index) : 1,
    col: 1,
    skipped: false,
    message: `${field} = ${macro} uses a @string that isn't defined, so it shows as "${macro}". Put the text in braces, ${field} = {…}, or define it first: @string{${macro} = {…}}.`,
  };
}

/** A function from an offset in `text` to its line (1-based). */
function lineFinder(text: string): (offset: number) => number {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * Walks the entry whose @ is at `at` with the parser's rules: braces nest, \ escapes the next
 * character, "…" quotes a value, and % starts a comment only between fields. Returns the
 * offsets of its top-level commas and of its closing brace (or the end of the text).
 */
export function scanEntry(text: string, at: number): { commas: number[]; close: number } {
  const open = text.slice(at).search(/[{(]/);
  if (open < 0) return { commas: [], close: text.length };
  const opener = at + open;
  const closer = text[opener] === '(' ? ')' : '}';
  const commas: number[] = [];
  let depth = 0;
  let quoted = false;
  for (let i = opener + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') i++;
    else if (depth > 0) depth += c === '{' ? 1 : c === '}' ? -1 : 0;
    else if (c === '{') depth = 1;
    else if (quoted) quoted = c !== '"';
    else if (c === closer) return { commas, close: i };
    else if (c === '"') quoted = true;
    else if (c === ',') commas.push(i);
    else if (c === '%') {
      const end = text.indexOf('\n', i);
      if (end < 0) break;
      i = end;
    }
  }
  return { commas, close: text.length };
}

const FIELD = /^(?:\s+|%[^\n]*)*([A-Za-z_][\w:.+-]*)\s*=/d;
const blank = (text: string) => !text.replace(/%[^\n]*/g, '').trim();

/**
 * An entry's raw text without the hidden fields (HIDDEN_FIELDS). Everything else stays byte for
 * byte: a removed field takes its line with it, the comments above it stay, and when the last
 * field goes, so does the comma before it.
 */
export function withoutHiddenFields(raw: string): string {
  const { commas, close } = scanEntry(raw, 0);
  if (commas.length === 0) return raw;
  const trailingComma = blank(raw.slice(commas.at(-1)! + 1, close));
  const cuts: [number, number][] = [];
  commas.forEach((comma, i) => {
    const from = comma + 1;
    const last = i + 1 === commas.length;
    const to = last ? close : commas[i + 1] + 1;
    const match = FIELD.exec(raw.slice(from, to));
    if (!match || !HIDDEN_FIELDS.includes(match[1].toLowerCase())) return;
    const nameAt = from + match.indices![1][0];
    const lineBreak = raw.lastIndexOf('\n', nameAt);
    const start = lineBreak >= from ? lineBreak : from;
    // The last field keeps the line break before the closing brace.
    cuts.push([start, last ? from + raw.slice(from, to).trimEnd().length : to]);
  });
  if (cuts.length === 0) return raw;
  let out = raw;
  for (const [start, end] of cuts.reverse()) out = out.slice(0, start) + out.slice(end);
  if (!trailingComma) {
    const { commas: left, close: end } = scanEntry(out, 0);
    const lastComma = left.at(-1)!;
    if (left.length > 1 && blank(out.slice(lastComma + 1, end))) out = out.slice(0, lastComma) + out.slice(lastComma + 1);
  }
  return out;
}

/** True when the entry has `example = {true}` (SPEC 5.2 rule 3). */
export const isExampleEntry = (entry: Pick<BibEntry, 'fields'>) => entry.fields.example?.trim().toLowerCase() === 'true';

/** True when the entry has `selected = {true}`, al-folio's mark for the home page (SPEC 5.6). */
export const isSelectedEntry = (entry: Pick<BibEntry, 'fields'>) => entry.fields.selected?.trim().toLowerCase() === 'true';

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
