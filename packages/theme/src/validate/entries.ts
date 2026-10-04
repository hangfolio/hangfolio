// Content entries marked as examples (SPEC 5.2 rule 3): `example: true` in front matter, in
// content/home.yaml or on a list entry, and `example = {true}` in BibTeX. Each gets a hash of
// everything but that marker, so the validator can tell an untouched example from an edited one.
import { createHash } from 'node:crypto';
import type { EntryKind } from '../lib/starter-values.ts';
import { bibWithoutExample, type BibEntry } from './bib-keys.ts';
import type { Kind, Loaded } from './content-files.ts';
import { locate } from './source.ts';

export type ExampleEntry = {
  kind: EntryKind;
  file: string;
  hash: string;
  line?: number;
  col?: number;
  /** The example line holds nothing else, so it can be deleted whole */
  alone: boolean;
  /** A BibTeX key, or a Markdown entry's id */
  key?: string;
  /** In-preparation publications read differently from extras */
  inPreparation?: boolean;
};

const LIST: Partial<Record<Kind, string>> = { experience: 'entries', news: 'items' };
const MARKDOWN = new Set<Kind>(['projects', 'publications', 'writing']);

/** Stable JSON: keys sorted, dates as ISO text. */
function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** The hash of an entry's data without `example`, plus a Markdown body. */
export function entryHash(data: Record<string, unknown>, body?: string): string {
  const { example: _, ...rest } = data;
  return sha(canonical(rest) + (body === undefined ? '' : `\n${body.trim()}`));
}

export const bibHash = (entry: BibEntry) => sha(bibWithoutExample(entry));

/** Every example entry in the loaded files and the BibTeX entries. */
export function exampleEntries(loaded: Loaded[], bib?: { file: string; entries: BibEntry[] }): ExampleEntry[] {
  const found: ExampleEntry[] = [];
  for (const file of loaded) {
    if (!file.raw || file.kind === 'site' || file.kind === 'projects-groups') continue;
    const at = (path: PropertyKey[]) => {
      const where = locate(file.source, path);
      const text = where ? file.source.lines[where.line - 1] : '';
      return { line: where?.line, col: where?.col, alone: /^\s*example:\s*true\s*(#.*)?$/.test(text) };
    };
    const list = LIST[file.kind];
    if (list) {
      const items = file.raw[list];
      if (!Array.isArray(items)) continue;
      items.forEach((item, i) => {
        if (item?.example !== true) return;
        found.push({ kind: file.kind as EntryKind, file: file.file, hash: entryHash(item), ...at([list, i, 'example']) });
      });
    } else if (file.raw.example === true) {
      const body = MARKDOWN.has(file.kind) ? file.source.body : undefined;
      const inPreparation = file.raw.status === 'in-preparation' || undefined;
      found.push({ kind: file.kind as EntryKind, file: file.file, hash: entryHash(file.raw, body), key: file.id, inPreparation, ...at(['example']) });
    }
  }
  for (const entry of bib?.entries ?? []) {
    if (entry.exampleLine === undefined) continue;
    found.push({ kind: 'bib', file: bib!.file, hash: bibHash(entry), key: entry.key, line: entry.exampleLine, col: entry.exampleCol, alone: Boolean(entry.exampleAlone) });
  }
  return found;
}
