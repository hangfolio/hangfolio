// YAML mistakes in plain words (E101, E102, E103), with the fix for the common ones: a value with
// ': ' or a reserved first character that needs quotes, curly quotes, an unclosed quote or
// bracket, a missing space or comma, tabs, and front matter with no closing ---. Quote marks YAML
// can read but keeps as text are quotes.ts's (E206, W206).
import { isAlias, isMap, isScalar, visit } from 'yaml';
import type { Issue } from './issue.ts';
import type { Source, YamlProblem } from './source.ts';
import { closeQuote, flowValueFix, openQuote, quote, runOnQuote, uncurl, valueOf } from './yaml-lines.ts';

export { quote, valueOf };

type Described = Pick<Issue, 'code' | 'message'> & { line?: number; col?: number; stop?: boolean };

/**
 * Every syntax problem in a source, at most one per line. After an unclosed quote or bracket, or
 * a line yaml can't place, yaml misreads the rest of the file, so what it reports after that is an
 * echo of the same mistake and is left out.
 */
export function syntaxIssues(source: Source): Issue[] {
  const { file } = source;
  if (source.unclosed) {
    const message = 'The block starting with --- needs a closing --- line.';
    return [{ code: 'E103', file, line: source.opener, col: 1, message }];
  }
  const issues: Issue[] = [];
  for (const problem of source.problems) {
    const { code, message, line, col, stop } = describe(source, problem);
    issues.push({ code, file, line: line ?? problem.line, col: col ?? problem.col, message });
    if (stop) break;
  }
  if (issues.length === 0 && source.doc) issues.push(...aliasIssues(source));
  return issues;
}

const RESERVED = '*&!|>%@`[{';

function describe(source: Source, problem: YamlProblem): Described {
  const text = source.lines[problem.line - 1] ?? '';
  const value = valueOf(text);
  const fix = value ? `${value.prefix.trim()} ${quote(uncurl(value.text) ?? value.text)}` : undefined;
  if (problem.yamlCode === 'TAB_AS_INDENT') return { code: 'E102', message: 'Use spaces, not tabs, to indent.' };
  // `location:Harbor Point` reads as one long key; yaml names it in several ways.
  if (/^\s*(?:-\s+)?[\w-]+:(?!\/\/)\S/.test(text) && !/^\s*(?:-\s+)?[\w-]+:\s/.test(text)) {
    return { code: 'E101', message: `Put a space after the colon: ${text.trim().replace(':', ': ')}` };
  }
  // `-"https://…"` is not a list item without the space.
  if (/^\s*-[^\s-]/.test(text)) {
    return { code: 'E101', stop: true, message: `Put a space after the -: ${text.trim().replace(/^-/, '- ')}` };
  }
  // `{ role: "Engineer, org: "Example" }`: the unclosed quote ends at the next value's opening one.
  const runOn = runOnQuote(text);
  if (runOn) {
    const col = [...text.slice(0, runOn.index)].length + 1;
    return { code: 'E101', col, stop: true, message: `This value's ${runOn.char} quote is never closed. Add the closing ${runOn.char}: ${runOn.fixed}` };
  }
  switch (problem.yamlCode) {
    case 'BLOCK_AS_IMPLICIT_KEY':
    case 'BLOCK_IN_FLOW': {
      const flow = flowValueFix(text, problem.col);
      if (flow?.comma) return { code: 'E101', message: `A comma is missing before ${flow.comma}. Inside { }, put a comma between fields: ${flow.fixed}` };
      if (flow) return { code: 'E101', message: `This value contains ': ' and needs quotes: ${flow.fixed}` };
      if (fix && uncurl(value!.text) !== undefined) {
        return { code: 'E101', col: value!.col, message: `This value is in curly quotes (“ ”), which YAML doesn't read as quotes. Use straight ones: ${fix}` };
      }
      if (fix) return { code: 'E101', col: value!.col, message: `This value contains ': ' and needs quotes: ${fix}` };
      break;
    }
    case 'BAD_SCALAR_START':
    case 'UNEXPECTED_TOKEN':
      if (fix && RESERVED.includes(value!.text[0])) {
        return { code: 'E101', col: value!.col, message: `This value starts with ${value!.text[0]}, so it needs quotes: ${fix}` };
      }
      break;
    case 'MISSING_CHAR':
      if (/quote/.test(problem.message)) return unclosedQuote(source, problem.line);
      break;
    case 'DUPLICATE_KEY': {
      const dup = duplicate(source, problem);
      if (dup?.first === problem.line) return { code: 'E101', message: `'${dup.key}' is set twice on this line. Keep one of them.` };
      if (dup) return { code: 'E101', message: `'${dup.key}' is already set on line ${dup.first}. Keep one of them.` };
      break;
    }
    case 'BAD_INDENT':
      if (/end with a [}\]]/.test(problem.message)) return unclosedBracket(source, problem.line);
      return { code: 'E101', stop: true, message: 'This line is indented differently from the lines around it. Items in the same list or block must start in the same column.' };
  }
  if (source.markdown && !/^\s*(?:-\s|#|[\w"' -]+:)/.test(text)) {
    return { code: 'E101', stop: true, message: "This line isn't YAML. Does the front matter above need its closing --- line?" };
  }
  return { code: 'E101', stop: true, message: `YAML can't read this line (${problem.message.replace(/\.$/, '')}). Check its quotes, colons and indentation.` };
}

/** yaml notices an unclosed quote where it gives up, which can be lines later; report where it opens. */
function unclosedQuote(source: Source, errorLine: number): Described {
  const first = source.markdown ? (source.opener ?? 0) + 1 : 1;
  for (let line = Math.min(errorLine, source.lines.length); line >= first; line--) {
    const text = source.lines[line - 1];
    const open = openQuote(text);
    if (!open) continue;
    const col = [...text.slice(0, open.index)].length + 1;
    const { fixed, curly } = closeQuote(text, open);
    const message = curly
      ? `This value's ${open.char} quote is closed with a curly ${curly}, which YAML doesn't read as a quote. Use a straight one: ${fixed}`
      : `This value's ${open.char} quote is never closed. Add the closing ${open.char}: ${fixed}`;
    return { code: 'E101', line, col, stop: true, message };
  }
  return { code: 'E101', stop: true, message: 'A quote on this line or above is never closed. Add the closing quote at the end of its value.' };
}

/** yaml notices an unclosed { or [ on a later line; report the line that opened it. */
function unclosedBracket(source: Source, errorLine: number) {
  for (let line = errorLine - 1; line >= 1; line--) {
    const text = source.lines[line - 1];
    for (const [open, close] of [['{', '}'], ['[', ']']]) {
      if (text.split(open).length > text.split(close).length) {
        const col = [...text.slice(0, text.lastIndexOf(open))].length + 1;
        return { code: 'E101' as const, line, col, stop: true, message: `This ${open} is never closed. Add ${close} at the end of the line.` };
      }
    }
  }
  return { code: 'E101' as const, stop: true, message: 'A { or [ above this line is never closed.' };
}

/** The key a DUPLICATE_KEY problem repeats, and the line where it was first set. */
function duplicate(source: Source, problem: YamlProblem): { key: string; first: number } | undefined {
  let found: { key: string; first: number } | undefined;
  const keyAt = (pair: { key: unknown }) => (isScalar(pair.key) ? source.at(pair.key.range![0]) : undefined);
  visit(source.doc!, {
    Map(_, map) {
      const onLine = map.items.filter((p) => keyAt(p)?.line === problem.line);
      // In { a: 1, a: 2 } both keys are on the line; the repeat is the one yaml points at.
      const dup = onLine.find((p) => keyAt(p)?.col === problem.col) ?? onLine.at(-1);
      if (!dup || !isScalar(dup.key)) return;
      const key = dup.key.value;
      const first = map.items.find((p) => isScalar(p.key) && p.key.value === key);
      if (first && first !== dup) found = { key: String(key), first: keyAt(first)!.line };
      return visit.BREAK;
    },
  });
  return found;
}

/** `role: *Senior* engineer` parses as an alias with no anchor; toJS() would throw. */
function aliasIssues(source: Source): Issue[] {
  const issues: Issue[] = [];
  visit(source.doc!, {
    Alias(_, alias) {
      if (isAlias(alias) && alias.resolve(source.doc!) === undefined) {
        const { line } = source.at(alias.range![0]);
        const value = valueOf(source.lines[line - 1]);
        const fix = value ? `: ${value.prefix.trim()} ${quote(value.text)}` : '.';
        issues.push({ code: 'E101', file: source.file, line, col: value?.col ?? 1, message: `This value starts with *, so it needs quotes${fix}` });
      }
    },
  });
  return issues;
}

/** True when a value YAML read as a one-pair map was written on one line, like `- Built it: fast`. */
export function isColonText(source: Source, node: unknown): boolean {
  if (!isMap(node) || node.items.length !== 1 || node.flow || !node.range) return false;
  return source.at(node.range[0]).line === source.at(Math.max(node.range[0], node.range[1] - 1)).line;
}
