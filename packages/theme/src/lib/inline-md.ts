// Inline Markdown for the short text fields marked (md) in SPEC 5.1: [text](url), **bold**, *em*
// and `code`, with a backslash to keep a mark as text (\*). Everything else is text: & < > and "
// are escaped, so raw HTML shows as written. The words are never changed (verbatim prose).
// Links written site-relative (/projects, files/cv.pdf) get the base path; see contentUrl().
import { contentUrl } from './url.ts';

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Text made safe for HTML element content and attribute values. */
export const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ENTITIES[c]);

// ASCII punctuation: what a backslash turns back into plain text.
const PUNCT = /[!-/:-@[-`{-~]/;
// Schemes that run code; such a link keeps its text and loses the link.
const UNSAFE = /^(?:javascript|vbscript|data):/i;
const space = (c: string | undefined) => c === undefined || /\s/.test(c);

/** The HTML for one inline Markdown field. `base` is the site's base path (Astro's BASE_URL). */
export function inlineMd(text: string, base: string = import.meta.env.BASE_URL): string {
  return render(text, 0, text.length, base, false);
}

/** How many times `char` repeats from `i` (stopping at `end`). */
function runLength(src: string, i: number, char: string, end: number): number {
  let n = 0;
  while (i + n < end && src[i + n] === char) n++;
  return n;
}

/** Where the backtick run closing a code span of `n` backticks starts, or -1. */
function codeClose(src: string, from: number, n: number, end: number): number {
  for (let i = from; i < end; ) {
    if (src[i] !== '`') {
      i++;
      continue;
    }
    const run = runLength(src, i, '`', end);
    if (run === n) return i;
    i += run;
  }
  return -1;
}

/**
 * Scans src[from, end) for the first position where `match` returns a length, skipping
 * backslash escapes and code spans, which can't hold a closing mark. Returns -1 when none.
 */
function scan(src: string, from: number, end: number, match: (i: number) => boolean): number {
  for (let i = from; i < end; ) {
    const c = src[i];
    if (c === '\\' && i + 1 < end && PUNCT.test(src[i + 1])) {
      i += 2;
    } else if (c === '`') {
      const n = runLength(src, i, '`', end);
      const close = codeClose(src, i + n, n, end);
      i = close === -1 ? i + n : close + n;
    } else if (match(i)) {
      return i;
    } else {
      i++;
    }
  }
  return -1;
}

/** The ] that closes the [ at `open`, counting nested brackets. */
function bracketClose(src: string, open: number, end: number): number {
  let depth = 0;
  return scan(src, open, end, (i) => {
    if (src[i] === '[') depth++;
    if (src[i] === ']') depth--;
    return depth === 0;
  });
}

/** The ) that closes a link destination starting at `open` (the "("), allowing balanced parentheses. */
function parenClose(src: string, open: number, end: number): number {
  let depth = 0;
  for (let i = open; i < end; i++) {
    if (src[i] === '\\') i++;
    else if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function render(src: string, start: number, end: number, base: string, inLink: boolean): string {
  let out = '';
  let text = '';
  const flush = () => {
    out += escapeHtml(text);
    text = '';
  };

  for (let i = start; i < end; ) {
    const c = src[i];

    if (c === '\\' && i + 1 < end && PUNCT.test(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }

    if (c === '`') {
      const n = runLength(src, i, '`', end);
      const close = codeClose(src, i + n, n, end);
      if (close === -1) {
        text += src.slice(i, i + n);
        i += n;
        continue;
      }
      let code = src.slice(i + n, close);
      if (/^ .*[^ ].* $/s.test(code)) code = code.slice(1, -1);
      flush();
      out += `<code>${escapeHtml(code)}</code>`;
      i = close + n;
      continue;
    }

    if (c === '[' && !inLink) {
      const close = bracketClose(src, i, end);
      const paren = close !== -1 && src[close + 1] === '(' ? parenClose(src, close + 1, end) : -1;
      const target = paren === -1 ? '' : src.slice(close + 2, paren).trim();
      if (target && !/\s/.test(target)) {
        const label = render(src, i + 1, close, base, true);
        flush();
        out += UNSAFE.test(target) ? label : `<a href="${escapeHtml(contentUrl(target, base))}">${label}</a>`;
        i = paren + 1;
        continue;
      }
    }

    if (c === '*') {
      const n = runLength(src, i, '*', end);
      // **bold**: opens before a non-space, closes at ** after a non-space.
      if (n >= 2 && !space(src[i + 2])) {
        const close = scan(src, i + 2, end, (j) => src[j] === '*' && src[j + 1] === '*' && !space(src[j - 1]) && j > i + 2);
        if (close !== -1) {
          flush();
          out += `<strong>${render(src, i + 2, close, base, inLink)}</strong>`;
          i = close + 2;
          continue;
        }
      }
      // *em*: the closer is a single * after a non-space; a ** inside is a nested bold.
      if (n === 1 && !space(src[i + 1])) {
        let skip = 0;
        const close = scan(src, i + 1, end, (j) => {
          if (j < skip || src[j] !== '*') return false;
          const run = runLength(src, j, '*', end);
          if (run > 1) {
            skip = j + run;
            return false;
          }
          return !space(src[j - 1]);
        });
        if (close !== -1) {
          flush();
          out += `<em>${render(src, i + 1, close, base, inLink)}</em>`;
          i = close + 1;
          continue;
        }
      }
      text += src.slice(i, i + n);
      i += n;
      continue;
    }

    text += c;
    i++;
  }
  flush();
  return out;
}
