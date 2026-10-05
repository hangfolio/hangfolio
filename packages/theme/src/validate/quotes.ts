// Quote marks that YAML keeps as part of the text (E206, W206). A value is in quotes only when it
// starts with a straight " or '. Curly quotes, as phones and word processors type them, are text,
// and so is a straight quote anywhere else, as when the opening one was deleted:
// role: Marine ecologist". Either way the marks would show on the site.
// - E206: a " with no partner at either end of the value. A " is never an apostrophe, so this is a
//   mistake and fails the build; one right after a digit (a 27" screen) is left alone.
// - W206: a value wrapped in a pair of curly quotes, which may be a quotation on purpose, and a
//   ' with no partner, which may be an apostrophe (movin'). Students' and 5' 11" are left alone.
// Quotes inside the text (“quoted” words) have partners and are fine. A quoted value is never
// checked, which is how to keep any of these on purpose: tagline: "“Measure twice.”"
import { visit, type Scalar } from 'yaml';
import type { Issue } from './issue.ts';
import type { Source } from './source.ts';
import { COMMENT, quote, uncurl } from './yaml-lines.ts';

type Family = { code: 'E206' | 'W206'; straight: string; opens: string; closes: string };
const DOUBLE: Family = { code: 'E206', straight: '"', opens: '“„', closes: '”' };
const SINGLE: Family = { code: 'W206', straight: "'", opens: '‘‚', closes: '’' };

export type QuoteProblem = { code: 'E206' | 'W206'; text: string; says: string };

/** What is wrong with the quotes of an unquoted value, and the text that belongs inside quotes. */
export function quoteProblem(value: string): QuoteProblem | undefined {
  const chars = [...value];
  const [first, last, beforeLast] = [chars[0], chars.at(-1)!, chars.at(-2) ?? ''];
  const inner = uncurl(value);
  if (inner !== undefined && nests(inner, '“”„'.includes(first) ? DOUBLE : SINGLE)) {
    const says = `This value is in curly quotes (${first} ${last}), which YAML doesn't read as quotes, so your site shows them. Use straight ones:`;
    return { code: 'W206', text: inner, says };
  }
  for (const family of [DOUBLE, SINGLE]) {
    const { code, straight, opens, closes } = family;
    const [shows, show] = code === 'E206' ? ['would show', 'would show'] : ['shows', 'show'];
    const put = family === SINGLE ? 'Unless it is an apostrophe, put' : 'Put';
    const ofFamily = (c: string) => (straight + opens + closes).includes(c);
    const opened = opens.includes(first);
    // 27" and 5' are inches and feet; Students' is a plural possessive.
    const closed = chars.length > 1 && (straight + closes).includes(last) && !/\d/.test(beforeLast) && !(family === SINGLE && /s/i.test(beforeLast));
    if (opened && last === straight && !chars.slice(1, -1).some(ofFamily)) {
      const says = `This value starts with a curly ${first} and ends with a straight ${last}, so both ${show} on your site. Use straight quotes at both ends:`;
      return { code, text: chars.slice(1, -1).join('').trim(), says };
    }
    if (opened && !chars.slice(1).some((c) => (straight + closes).includes(c))) {
      const says = `This value starts with ${first} but nothing closes it, so the ${first} ${shows} on your site. ${put} the value in straight quotes:`;
      return { code, text: chars.slice(1).join('').trim(), says };
    }
    if (closed && !chars.slice(0, -1).some((c, i) => ofFamily(c) && !isApostrophe(chars, i))) {
      const says = `This value ends with ${last} but doesn't start with one, so the ${last} ${shows} on your site. ${put} the value in straight quotes:`;
      return { code, text: chars.slice(0, -1).join('').trim(), says };
    }
  }
  return undefined;
}

/** Inside a curly pair, the other curly quotes open and close in order. ’ is also an apostrophe, so only ‘ counts. */
function nests(inner: string, family: Family): boolean {
  let depth = 0;
  for (const c of inner) {
    if (family.opens.includes(c)) depth++;
    else if (family === DOUBLE && family.closes.includes(c)) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** ' or ’ right after a letter or digit, as in I'm. */
const isApostrophe = (chars: string[], i: number) => "'’".includes(chars[i]) && /[\p{L}\p{N}]/u.test(chars[i - 1] ?? '');

/** E206 and W206 for every unquoted text value in a file that YAML could read. */
export function quoteIssues(source: Source): Issue[] {
  if (!source.doc) return [];
  const issues: Issue[] = [];
  visit(source.doc, {
    Scalar(key, node) {
      if (key === 'key' || node.type !== 'PLAIN' || typeof node.value !== 'string' || !node.range) return;
      const problem = quoteProblem(node.value);
      if (!problem) return;
      const from = source.at(node.range[0]);
      const to = source.at(node.range[1]);
      const message = `${problem.says} ${fixedLine(source, node, problem.text)}`;
      issues.push({ code: problem.code, file: source.file, line: from.line, col: from.col, endLine: to.line, endCol: to.col, message });
    },
  });
  return issues;
}

/** The value's line (or lines) with the value in straight quotes, without a trailing comment. */
function fixedLine(source: Source, node: Scalar, text: string): string {
  const from = source.at(node.range![0]);
  const to = source.at(node.range![1]);
  const head = [...source.lines[from.line - 1]].slice(0, from.col - 1).join('');
  const tail = [...source.lines[to.line - 1]].slice(to.col - 1).join('').replace(COMMENT, '').trimEnd();
  return `${head.trimStart()}${quote(text)}${tail}`;
}
