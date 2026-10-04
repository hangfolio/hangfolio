// Fixes built from the text of one YAML line: the value part, the value in quotes, curly quotes
// made straight, where an unclosed quote opens, and a value inside { } that is missing a comma or
// its quotes. yaml-hints.ts turns them into messages.

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
const COMMENT = /\s+#(?:\s.*)?$/;

/**
 * The quote that starts a value on this line and is still open at its end, if any. A quote
 * starts a value only after `key:`, `- `, `{`, `[` or `,`, so the apostrophe in I'm is text.
 */
export function openQuote(line: string): { index: number; char: string } | undefined {
  let open: { index: number; char: string } | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (open) {
      if (open.char === '"' && c === '\\') i++;
      else if (c === open.char && open.char === "'" && line[i + 1] === "'") i++;
      else if (c === open.char) open = undefined;
      continue;
    }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return undefined;
    if ((c === '"' || c === "'") && /(?:^|[:[{,]|(?:^|\s)-)$/.test(line.slice(0, i).trimEnd())) open = { index: i, char: c };
  }
  return open;
}

/** The line with its unclosed quote closed: before a trailing comment, and before a closing } or ]. */
export function closeQuote(line: string, open: { index: number; char: string }): string {
  const before = line.slice(0, open.index);
  let value = line.slice(open.index).replace(COMMENT, '').trimEnd();
  let tail = '';
  if (/[{[]/.test(before)) {
    tail = /\s*[}\]][\s}\],]*$/.exec(value)?.[0] ?? '';
    value = value.slice(0, value.length - tail.length);
  }
  return `${before.trim()} ${value}${open.char}${tail}`;
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
