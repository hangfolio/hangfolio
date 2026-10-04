// Shared test helpers.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every file under dir, as sorted paths relative to it. */
export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}
