// The avatar (SPEC 5.3): site.yaml `avatar`, else public/images/avatar.jpg, .jpeg, .png or .webp
// when one exists, else none, and the pages draw an initials monogram instead.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const NAMES = ['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp'];

/** `/images/avatar.jpg` when the site has one of the default avatar files (exact names). */
export function findAvatar(root: string): string | undefined {
  const dir = join(root, 'public', 'images');
  if (!existsSync(dir)) return undefined;
  const names = new Set(readdirSync(dir));
  const name = NAMES.find((n) => names.has(n));
  return name && `/images/${name}`;
}

/** Up to two initials: the first and last word of the name (words without a letter, like an emoji, skipped), or advanced.nameParts. */
export function initials(name: string, parts?: { given: string; family: string }): string {
  const words = parts ? [parts.given, parts.family] : name.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  const first = (word = '') => [...word.replace(/^[^\p{L}\p{N}]+/u, '')][0] ?? '';
  const letters = words.length > 1 ? first(words[0]) + first(words.at(-1)) : first(words[0]);
  return letters.toLocaleUpperCase();
}
