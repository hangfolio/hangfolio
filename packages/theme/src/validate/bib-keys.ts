// A small scan of content/publications.bib for what M2's checks need: each entry's key, its line,
// its text, and its `example = {true}` line. It does not read fields; the BibTeX parser chosen
// in S9 replaces it in M5.

export type BibEntry = {
  key: string;
  type: string;
  line: number;
  /** The entry from @ to its closing brace */
  text: string;
  /** Where `example = {true}` is, if the entry has one */
  exampleLine?: number;
  exampleCol?: number;
  /** That line holds nothing else, so deleting it is safe */
  exampleAlone?: boolean;
};

const SKIP = new Set(['string', 'preamble', 'comment']);
const EXAMPLE = /\bexample\s*=\s*(?:\{\s*true\s*\}|"true"|true)/i;

export function scanBib(text: string): BibEntry[] {
  const lineAt = (offset: number) => text.slice(0, offset).split('\n').length;
  const entries: BibEntry[] = [];
  const start = /@(\w+)\s*([{(])/g;
  for (let match = start.exec(text); match; match = start.exec(text)) {
    const type = match[1].toLowerCase();
    const end = closing(text, match.index + match[0].length - 1);
    start.lastIndex = end;
    if (SKIP.has(type)) continue;
    const entryText = text.slice(match.index, end);
    const key = /^@\w+\s*[{(]\s*([^,\s})]+)/.exec(entryText)?.[1];
    if (!key) continue;
    const entry: BibEntry = { key, type, line: lineAt(match.index), text: entryText };
    const example = EXAMPLE.exec(entryText);
    if (example) {
      const at = match.index + example.index;
      entry.exampleLine = lineAt(at);
      const lineText = text.split('\n')[entry.exampleLine - 1];
      entry.exampleCol = lineText.search(/example/i) + 1;
      entry.exampleAlone = /^\s*example\s*=\s*\S+?\s*,?\s*$/i.test(lineText);
    }
    entries.push(entry);
  }
  return entries;
}

/** The offset just after the brace that closes the one at `open`, or the next entry's @. */
function closing(text: string, open: number): number {
  const close = text[open] === '(' ? ')' : '}';
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') i++;
    else if (c === '{' || c === text[open]) depth++;
    else if (c === '}' || c === close) {
      depth--;
      if (depth === 0) return i + 1;
    } else if (c === '@' && text[i - 1] === '\n') return i;
  }
  return text.length;
}

/** The entry without its example line, with runs of white space as one space (for hashes). */
export function bibWithoutExample(entry: BibEntry): string {
  return entry.text
    .replace(new RegExp(`${EXAMPLE.source}\\s*,?`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();
}
