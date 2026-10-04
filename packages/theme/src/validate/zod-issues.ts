// Turns what a zod schema reports into catalogue issues with file:line (S11): unknown fields
// (E201, with did-you-mean over the field names there), wrong values and enums (E202), missing
// fields (E203), dates (E204) and duplicates (E303). Messages name the field and say what to write.
import type { z } from 'zod';
import type { Code, Issue } from './issue.ts';
import { knownKeys } from './schema-walk.ts';
import { locate, type Source } from './source.ts';
import { didYouMean } from './suggest.ts';
import { isColonText, quote } from './yaml-hints.ts';

type Raw = z.core.$ZodIssue & { input?: unknown; params?: { code?: Code }; errors?: Raw[][]; note?: string; options?: unknown[] };
type Draft = Issue & { path: PropertyKey[]; suggests?: string };

export type SchemaResult = { issues: Issue[]; data?: unknown };

/** Parses `data` (the plain contents of `source`) with `schema` and reports every problem. */
export function schemaIssues(source: Source, schema: z.ZodType, data: unknown): SchemaResult {
  const result = schema.safeParse(data, { reportInput: true });
  if (result.success) return { issues: [], data: result.data };
  const drafts = flatten(result.error.issues as Raw[]).flatMap((issue) => toDrafts(source, schema, issue));
  // A misspelt field that "did you mean" explains is not also reported as missing.
  const explained = new Set(drafts.filter((d) => d.suggests).map((d) => `${d.path.slice(0, -1).join('.')}>${d.suggests}`));
  const issues = drafts
    .filter((d) => !(d.code === 'E203' && explained.has(`${d.path.slice(0, -1).join('.')}>${String(d.path.at(-1))}`)))
    .map(({ path, suggests, ...issue }) => issue);
  return { issues };
}

/** Resolves failed unions to the branch the person meant: the one whose problems go deepest (S11). */
function flatten(issues: Raw[], prefix: PropertyKey[] = []): Raw[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    if (issue.code !== 'invalid_union' || !issue.errors?.length) return [{ ...issue, path }];
    const depth = (branch: Raw[]) => Math.max(...branch.map((i) => i.path.length + (i.code === 'unrecognized_keys' ? 1 : 0)));
    const deepest = issue.errors.reduce((best, branch) => (depth(branch) > depth(best) ? branch : best));
    if (depth(deepest) === 0 && issue.errors.every((b) => b.every((i) => i.code === 'invalid_type'))) {
      const expected = issue.errors.flatMap((b) => b.map((i) => (i as { expected: string }).expected));
      return [{ ...issue, path, code: 'invalid_type', expected: expected.join('|') } as unknown as Raw];
    }
    return flatten(deepest, path);
  });
}

function toDrafts(source: Source, schema: z.ZodType, issue: Raw): Draft[] {
  const path = issue.path as PropertyKey[];
  const field = fieldName(path);
  const draft = (code: Code, message: string, at: PropertyKey[] | null = path): Draft => ({ code, path, ...where(source, at), message });

  if (issue.code === 'unrecognized_keys') {
    const parent = locate(source, path)?.node as { items?: { key?: { value?: unknown } }[] } | undefined;
    const present = new Set((parent?.items ?? []).map((pair) => String(pair.key?.value)));
    const known = knownKeys(schema, path).filter((key) => !present.has(key));
    const inside = typeof path.at(-1) === 'string' ? ` in ${field}` : '';
    return issue.keys.map((key) => {
      const suggests = didYouMean(key, known);
      const hint = suggests ? ` Did you mean '${suggests}'?` : ' Check the spelling, or delete it.';
      return { ...draft('E201', `Unknown field '${key}'${inside}.${hint}`, [...path, key]), path: [...path, key], suggests };
    });
  }
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    const key = String(path.at(-1));
    const parent = path.slice(0, -1);
    const add = parent.length === 0 ? `Add a line: ${key}: ${example(key)}` : `Add ${key}: ${example(key)}`;
    const inside = parent.length > 0 ? ` in ${fieldName(parent)}` : '';
    return [draft('E203', `'${key}' is required${inside}. ${add}`, parent.length > 0 ? parent : null)];
  }
  if (issue.params?.code) return [draft(issue.params.code, sentence(`${field} ${tidy(issue.message)}`))];
  if (issue.code === 'invalid_value' || (issue.code === 'invalid_union' && issue.note)) {
    const values = ((issue as { values?: unknown[] }).values ?? issue.options ?? []).filter((v) => v !== null && v !== undefined).map(String);
    const input = issue.code === 'invalid_value' ? issue.input : (issue.input as Record<string, unknown>)?.[String(path.at(-1))];
    const suggests = typeof input === 'string' ? didYouMean(input, values) : undefined;
    const hint = suggests ? ` Did you mean '${suggests}'?` : '';
    return [draft('E202', `${field} must be one of ${values.join(', ')}. You wrote ${show(input)}.${hint}`)];
  }
  if (issue.code === 'invalid_type') return [typeDraft(source, issue, path, field, draft)];
  if (issue.code === 'too_small' || issue.code === 'too_big') return [draft('E202', sentence(`${field} ${sizeMessage(issue)}`))];
  return [draft('E202', sentence(`${field} ${tidy(issue.message)}`))];
}

function typeDraft(source: Source, issue: Raw, path: PropertyKey[], field: string, draft: (code: Code, message: string) => Draft): Draft {
  const expected = String((issue as { expected?: string }).expected);
  const input = issue.input;
  const key = path.at(-1);
  const lead = typeof key === 'number' ? '- ' : `${String(key)}: `;
  if (input === null) return draft('E202', `${field} is empty. Write a value after the colon, or delete the line.`);
  if (expected === 'string' && typeof input === 'object' && !Array.isArray(input)) {
    const found = locate(source, path);
    if (found?.found && isColonText(source, found.node)) {
      const line = source.lines[found.line - 1];
      return { ...draft('E101', `This value contains ': ' and needs quotes: ${lead}${quote([...line].slice(found.col - 1).join('').replace(/\s+#.*$/, '').trimEnd())}`), col: found.col };
    }
  }
  if (expected === 'string' && (typeof input === 'number' || typeof input === 'boolean')) {
    return draft('E202', `${field} must be text, so put it in quotes: ${lead}"${input}"`);
  }
  if (expected === 'array' && typeof input === 'string') return draft('E202', `${field} must be a list: ${lead}[${quote(input)}]`);
  if (expected === 'boolean' && typeof input === 'string') return draft('E202', `${field} must be true or false, without quotes. You wrote ${show(input)}.`);
  const kinds = [...new Set(expected.split('|').map((e) => TYPES[e] ?? e))].join(' or ');
  const wrote = typeof input === 'object' ? '' : ` You wrote ${show(input)}.`;
  return draft('E202', `${field} must be ${kinds}.${wrote}`);
}

const TYPES: Record<string, string> = {
  string: 'text',
  number: 'a number',
  int: 'a whole number',
  boolean: 'true or false',
  array: 'a list',
  object: 'a group of fields (key: value lines)',
};

function sizeMessage(issue: Raw): string {
  const { origin, minimum, maximum } = issue as { origin?: string; minimum?: number; maximum?: number };
  if (!/^Too (small|big)/.test(issue.message)) return tidy(issue.message);
  const n = Number(minimum ?? maximum);
  if (origin === 'array') return issue.code === 'too_small' ? `needs at least ${n} item${n === 1 ? '' : 's'}` : `can have at most ${n} items`;
  if (origin === 'string') return issue.code === 'too_small' ? `must be at least ${n} characters` : `must be ${n} characters or fewer`;
  return issue.code === 'too_small' ? `must be at least ${n}` : `must be ${n} or less`;
}

/** Where an issue is: the node at `at`, or just the file (missing top-level fields, empty files). */
function where(source: Source, at: PropertyKey[] | null): Pick<Issue, 'file' | 'line' | 'col' | 'endLine' | 'endCol'> {
  const found = at && at.length > 0 ? locate(source, at) : null;
  if (!found) return { file: source.file };
  return { file: source.file, line: found.line, col: found.col, endLine: found.endLine, endCol: found.endCol };
}

/**
 * The field as a message names it: the keys after the last list index (`entries.1.section` is
 * "section"), the whole path when there is no index (`availability.until`), and "links item 2"
 * for a list item itself.
 */
export function fieldName(path: readonly PropertyKey[]): string {
  const last = path.findLastIndex((seg) => typeof seg === 'number');
  if (last === -1) return path.join('.');
  if (last === path.length - 1) return `${String(path[last - 1] ?? 'list')} item ${(path[last] as number) + 1}`;
  return path.slice(last + 1).join('.');
}

/** A value as a message quotes it. */
export function show(value: unknown): string {
  if (typeof value === 'string') return `'${value.length > 60 ? `${value.slice(0, 57)}…` : value}'`;
  if (value === null || value === undefined) return 'nothing';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return 'a list';
  return typeof value === 'object' ? 'a group of fields' : String(value);
}

/** A schema's own message, with "(you wrote 'x'; did you mean y?)" turned into "You wrote 'x'. Did you mean y?" */
const tidy = (message: string) =>
  message.replace(/\s*\(you wrote (.*?)(?:; did you mean (.*)\?)?\)$/, (_, wrote: string, guess?: string) => `. You wrote ${wrote}.${guess ? ` Did you mean ${guess}?` : ''}`);

/**
 * Ends a message with a full stop unless it ends with a fix, an address or punctuation. A message
 * about the whole file has no field name in front, so it gets a capital letter instead.
 */
function sentence(text: string): string {
  const message = text.startsWith(' ') ? text.trim().replace(/^./, (c) => c.toUpperCase()) : text.trim();
  const lastWord = message.split(/\s/).at(-1) ?? '';
  // A fix or an address ends the message as it is; a quoted value ('x') ends a sentence.
  return /[.?!]$/.test(message) || (/[/:"]/.test(lastWord) && !lastWord.endsWith("'")) ? message : `${message}.`;
}

const EXAMPLES: Record<string, string> = {
  name: '"Your Name"',
  email: '"you@university.edu"',
  date: '2026-08-14',
  start: '2025-01',
  section: 'research',
  order: '1',
  url: '"https://…"',
  status: 'in-preparation',
};

const example = (key: string) => EXAMPLES[key] ?? '"…"';
