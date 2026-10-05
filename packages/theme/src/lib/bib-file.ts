// A content loader for content/publications.bib: one entry per BibTeX entry, with its key as
// the id (lib/bib.ts reads the file). Without the file the collection is empty. Outside demo
// mode, entries with `example = {true}` are left out (SPEC 5.2 rule 3); the checks list them,
// and the entries that can't be read (W301).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { parse } from 'yaml';
import { isExampleEntry, parseBib } from './bib.ts';
import { isDemoSite } from './starter-values.ts';
import { followFile } from './yaml-file.ts';

/** `path` is relative to the site root, e.g. "content/publications.bib". */
export function bibFile(path: string): Loader {
  return {
    name: 'hangfolio-bib-file',
    load: async ({ config, store, generateDigest, watcher, logger }: LoaderContext) => {
      const file = fileURLToPath(new URL(path, config.root));
      const sync = async () => {
        store.clear();
        if (!existsSync(file)) return;
        const demo = isDemoSite(config.root);
        for (const entry of parseBib(await readFile(file, 'utf8'))) {
          if (demo || !isExampleEntry(entry)) store.set({ id: entry.key, data: entry, filePath: path, digest: generateDigest(JSON.stringify(entry)) });
        }
      };
      await sync();
      followFile(file, sync, { watcher, logger });
    },
  };
}

/**
 * Whether the site has something for the publications page, read straight from the files (the
 * integration decides with it whether to add the page, before any loader runs): a readable
 * BibTeX entry, or an in-preparation item, that example mode does not hide.
 */
export function hasPublicationContent(root: string, demo: boolean): boolean {
  const bib = join(root, 'content/publications.bib');
  if (existsSync(bib) && parseBib(readFileSync(bib, 'utf8')).some((entry) => demo || !isExampleEntry(entry))) return true;
  const dir = join(root, 'content/publications');
  if (!existsSync(dir)) return false;
  return readdirSync(dir)
    .filter((name) => /\.mdx?$/.test(name))
    .some((name) => {
      const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(dir, name), 'utf8'))?.[1];
      try {
        const data = front && parse(front);
        return data?.status === 'in-preparation' && (demo || data.example !== true);
      } catch {
        return false; // the checks report the file
      }
    });
}
