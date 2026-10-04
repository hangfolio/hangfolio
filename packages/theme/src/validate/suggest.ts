// "Did you mean …?" (SPEC 5.10): the closest known word within a small edit distance.

/** Edits between two words: insertions, deletions, substitutions and swaps of neighbours. */
export function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * The known word closest to `word`, ignoring case: at most 2 edits away, or 1 for words of up
 * to 3 letters (so "id" never suggests "cv"). Undefined when nothing is that close.
 */
export function didYouMean(word: string, known: Iterable<string>): string | undefined {
  const limit = word.length <= 3 ? 1 : 2;
  let best: { word: string; d: number } | undefined;
  for (const candidate of known) {
    if (candidate === word) continue;
    const d = distance(word.toLowerCase(), candidate.toLowerCase());
    if (d <= limit && (!best || d < best.d)) best = { word: candidate, d };
  }
  return best?.word;
}

/** "a, b, c", with at most `max` items and then "and N more". */
export function listOf(items: readonly string[], max = 8): string {
  const more = items.length - max;
  return items.slice(0, max).join(', ') + (more > 0 ? ` and ${more} more` : '');
}
