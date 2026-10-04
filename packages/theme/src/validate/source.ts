// A YAML file or a Markdown file's front matter, parsed with positions (S11). Front matter is
// sliced with Astro's own pattern, and every offset is mapped through one LineCounter over the
// whole file, so lines are the file's lines. Columns count code points, not UTF-16 units.
import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Document, type Node } from 'yaml';

// Astro's front-matter pattern (YAML only), plus the d flag for match indices.
const FRONT_MATTER = /(?:^﻿?|^\s*\n)---([\s\S]*?\n)---/d;
const OPENER = /(?:^﻿?|^\s*\n)---/d;

export type Pos = { line: number; col: number };
export type Span = Pos & { endLine?: number; endCol?: number };

/** A problem yaml reported, kept as one per line (S11 finding 3). */
export type YamlProblem = { yamlCode: string; message: string; offset: number; line: number; col: number };

export type Source = {
  file: string;
  text: string;
  lines: string[];
  /** Markdown with front matter */
  markdown: boolean;
  /** The parsed YAML; undefined when a Markdown file has no front matter, or it isn't closed */
  doc?: Document;
  /** The line of the opening --- (Markdown files) */
  opener?: number;
  /** The front matter has an opening --- but no closing one */
  unclosed: boolean;
  /** The Markdown body after the front matter */
  body: string;
  problems: YamlProblem[];
  /** Position of an offset in the file */
  pos(offset: number): Pos;
  /** Position of an offset in the parsed YAML */
  at(offset: number): Pos;
};

export function loadSource(file: string, text: string): Source {
  const counter = new LineCounter();
  counter.addNewLine(0);
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) counter.addNewLine(i + 1);
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const pos = (offset: number): Pos => {
    const { line } = counter.linePos(offset);
    const before = text.slice(counter.lineStarts[line - 1], offset).replace(/^﻿/, '');
    return { line, col: [...before].length + 1 };
  };

  const markdown = /\.mdx?$/.test(file);
  const source: Source = { file, text, lines, markdown, unclosed: false, body: '', problems: [], pos, at: pos };
  let base = 0;
  let yamlText = text;
  if (markdown) {
    const match = FRONT_MATTER.exec(text);
    const open = OPENER.exec(text);
    if (open) source.opener = pos(open.indices![0][1] - 3).line;
    if (!match) {
      source.unclosed = Boolean(open);
      source.body = text;
      return source;
    }
    base = match.indices![1][0];
    yamlText = match[1];
    source.body = text.slice(match.indices![0][1]);
  }

  const doc = parseDocument(yamlText, { prettyErrors: false });
  source.doc = doc;
  source.at = (offset: number) => pos(base + offset);
  for (const error of doc.errors) {
    let offset = base + error.pos[0];
    const { line } = counter.linePos(offset);
    const prev = source.problems.at(-1);
    if (source.problems.some((p) => p.line === line)) continue;
    if (error.code === 'BAD_INDENT' && prev?.yamlCode === 'TAB_AS_INDENT' && prev.line === line - 1) continue;
    if (error.code !== 'TAB_AS_INDENT') {
      // Move off the indentation to the first character of the line.
      const indent = lines[line - 1].match(/^ */)![0].length;
      offset = Math.max(offset, counter.lineStarts[line - 1] + indent);
    }
    source.problems.push({ yamlCode: error.code, message: error.message, offset, ...pos(offset) });
  }
  return source;
}

/** The plain data in the file, or undefined when it can't be read (yaml problems, a bad alias). */
export function toData(source: Source): unknown {
  if (!source.doc) return source.markdown && !source.unclosed ? {} : undefined;
  if (source.problems.length > 0) return undefined;
  try {
    return source.doc.toJS() ?? {};
  } catch {
    return undefined; // an alias with no anchor; yaml-hints.ts reports it
  }
}

export type Located = Span & { node?: Node; found: boolean };

/**
 * The position of a path like ['entries', 1, 'section'] in the file: the key of the last pair it
 * reaches, or a list item. A path that goes past the file stops at the deepest node that exists;
 * `found` says whether it got to the end. Null for an empty document.
 */
export function locate(source: Source, path: readonly PropertyKey[]): Located | null {
  let node = source.doc?.contents as Node | null | undefined;
  let start = node?.range?.[0];
  let matched = 0;
  for (const seg of path) {
    let next: { node: Node | undefined; start: number } | null = null;
    if (isMap(node)) {
      const pair = node.items.find((p) => String(isScalar(p.key) ? p.key.value : p.key) === String(seg));
      if (pair && isScalar(pair.key)) next = { node: (pair.value ?? undefined) as Node | undefined, start: pair.key.range![0] };
    } else if (isSeq(node) && typeof seg === 'number' && node.items[seg]) {
      const item = node.items[seg] as Node;
      next = { node: item, start: item.range![0] };
    }
    if (!next) break;
    ({ node, start } = next);
    matched++;
  }
  if (start === undefined || !source.doc) return null;
  const from = source.at(start);
  let end = node?.range ? source.at(node.range[1]) : from;
  // A multi-line value can end at column 1 of the next line; end it on the line before (S11).
  if (end.col === 1 && end.line > from.line) end = { line: end.line - 1, col: [...source.lines[end.line - 2]].length + 1 };
  return { ...from, endLine: end.line, endCol: end.col, node: node ?? undefined, found: matched === path.length };
}
