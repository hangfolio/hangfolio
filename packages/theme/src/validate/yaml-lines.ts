// Fixes built from the text of one YAML line: the value part, the value in quotes, curly quotes
// made straight, where an unclosed quote opens, and a value inside { } that is missing a comma or
// its quotes or has run on into the next one. yaml-hints.ts turns them into messages.

/** The value part of a `key: value` or `- value` line, without a trailing comment. */
export function valueOf(line: string): { prefix: string; text: string; col: number } | undefined {
  const match = /^(\s*(?:-\s+)*(?:[^\s:#'"][^:#]*?:\s+)?(?:-\s+)?)(\S.*?)\s*(?:\s#.*)?$/.exec(line);
  if (!match || !match[2]) return undefined;
  return { prefix: match[1], text: match[2], col: [...match[1]].length + 1 };
}

/** A value in double quotes, or single quotes when it has a double quote in it. */
export function quote(text: string): string {
  return text.includes('"') ? `'${text.replaceAll("'", "''")}'` : `"${text.replaceAll('\\', '\\\\')}"`;
}

/** A value wrapped in curly quotes (“…” or ‘…’, as phones and word processors type them), without them. */
export function uncurl(text: string): string | undefined {
  return /^[“”„]([\s\S]*)[”“]$/.exec(text)?.[1] ?? /^[‘’]([\s\S]*)[’‘]$/.exec(text)?.[1];
}

/** A comment at the end of a line (` # …`); `#` inside a word or before a digit is text. */
export const COMMENT = /\s+#(?:\s.*)?$/;

/**
 * The quoted values on a line, in order: where each opens, and where it closes (-1 when it
 * doesn't). A quote starts a value only after `key:`, `- `, `{`, `[` or `,`, so the apostrophe
 * in I'm is text.
 */
function quotedValues(line: string): { index: number; char: string; end: number }[] {
  const found: { index: number; char: string; end: number }[] = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) break;
    if ((c !== '"' && c !== "'") || !/(?:^|[:[{,]|(?:^|\s)-)$/.test(line.slice(0, i).trimEnd())) continue;
    let end = i + 1;
    while (end < line.length) {
      // \" is a quote inside "…", and '' one inside '…'
      if ((c === '"' && line[end] === '\\') || (c === "'" && line.startsWith("''", end))) end += 2;
      else if (line[end] === c) break;
      else end++;
    }
    found.push({ index: i, char: c, end: end < line.length ? end : -1 });
    if (end >= line.length) break;
    i = end;
  }
  return found;
}

/** The quote that starts a value on this line and is still open at its end, if any. */
export function openQuote(line: string): { index: number; char: string } | undefined {
  const last = quotedValues(line).at(-1);
  return last?.end === -1 ? { index: last.index, char: last.char } : undefined;
}

/**
 * The line with its unclosed quote closed: before a trailing comment, and before a closing } or ].
 * A closing quote typed curly ("Marine ecologist”) is made straight; `curly` says which it was.
 */
export function closeQuote(line: string, open: { index: number; char: string }): { fixed: string; curly?: string } {
  const before = line.slice(0, open.index);
  let value = line.slice(open.index).replace(COMMENT, '').trimEnd();
  let tail = '';
  if (/[{[]/.test(before)) {
    tail = /\s*[}\]][\s}\],]*$/.exec(value)?.[0] ?? '';
    value = value.slice(0, value.length - tail.length);
  }
  const curly = curlyCloser(value, open.char);
  if (curly) value = value.slice(0, -1);
  return { fixed: `${before.trim()} ${value}${open.char}${tail}`, curly };
}

/** The last character of a value that opens with `char`, if it is a curly closing quote that nothing inside opened. */
function curlyCloser(value: string, char: string): string | undefined {
  const [closers, openers] = char === '"' ? ['”“', '“„'] : ['’‘', '‘‚'];
  const last = value.at(-1) ?? '';
  return value.length > 1 && closers.includes(last) && ![...value.slice(1, -1)].some((c) => openers.includes(c)) ? last : undefined;
}

/**
 * Inside { } or [ ], a value whose closing quote is missing runs on to the next value's opening
 * quote and swallows the comma between them: { role: "Engineer, org: "Example" }. The quote that
 * opens it, and the line with the quote closed before that comma.
 */
export function runOnQuote(line: string): { index: number; char: string; fixed: string } | undefined {
  for (const { index, char, end } of quotedValues(line)) {
    const before = line.slice(0, index);
    if (end === -1 || before.split(/[{[]/).length <= before.split(/[}\]]/).length) continue;
    const run = /,\s*(?:[A-Za-z][\w-]*:\s*)?$/.exec(line.slice(index + 1, end));
    if (!run) continue;
    const at = index + 1 + run.index;
    return { index, char, fixed: `${before.trimStart()}${line.slice(index, at)}${char}${line.slice(at).replace(COMMENT, '').trimEnd()}` };
  }
  return undefined;
}

/**
 * A value inside { } that yaml can't read because of ': ', starting at column `col`. Either a
 * comma is missing before the next field (`{ date: 2026-09 text: "…" }`), or the value is text
 * that needs quotes (`{ text: Talk: harbors }`). A date, number, true/false or quoted value
 * followed by `word:` is the first; anything else is the second.
 */
export function flowValueFix(line: string, col: number): { comma?: string; fixed: string } | undefined {
  const chars = [...line];
  const before = chars.slice(0, col - 1).join('');
  if (before.split('{').length <= before.split('}').length) return undefined;
  const rest = chars.slice(col - 1).join('').replace(COMMENT, '');
  const next = /,\s*[A-Za-z][\w-]*:\s/.exec(rest);
  const close = rest.lastIndexOf('}');
  const value = rest.slice(0, next ? next.index : close === -1 ? rest.length : close).trimEnd();
  const after = rest.slice(value.length);
  const comma = /^("[^"]*"|'[^']*'|\d[\d.-]*|true|false)\s+([A-Za-z][\w-]*):\s/.exec(value);
  if (comma) return { comma: comma[2], fixed: `${before.trim()} ${comma[1]}, ${value.slice(comma[1].length).trimStart()}${after}` };
  return { fixed: `${before.trim()} ${quote(uncurl(value) ?? value)}${after}` };
}
