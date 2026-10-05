// A content loader for content/publications.bib: one entry per BibTeX entry, with its key as
// the id (lib/bib.ts reads the file). Without the file the collection is empty. Outside demo
// mode, entries with `example = {true}` are left out (SPEC 5.2 rule 3); the checks list them.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
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
