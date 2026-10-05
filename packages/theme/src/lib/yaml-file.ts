// A content loader for one optional YAML file, such as content/news.yaml. The whole file is a
// single entry named after the file ("news"), so the collection's schema is the file's schema.
// Without the file the collection is empty. It is parsed with `yaml`, like the validator, so
// dates stay as written (S11); an empty file counts as {} and gets every default. Outside demo
// mode, `hideExamples` takes the example entries out of the parsed data (SPEC 5.2 rule 3). In
// `hangfolio dev`, a file with mistakes is left out and the error overlay shows them.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { parse } from 'yaml';
import { devState } from './dev-checks.ts';
import { isDemoSite } from './starter-values.ts';

type Data = Record<string, unknown>;

/** `path` is relative to the site root, e.g. "content/news.yaml". */
export function yamlFile(path: string, hideExamples?: (data: Data) => Data | undefined): Loader {
  const id = basename(path, extname(path));
  return {
    name: 'hangfolio-yaml-file',
    load: async ({ config, store, parseData, generateDigest, watcher, logger }: LoaderContext) => {
      const file = fileURLToPath(new URL(path, config.root));
      const sync = async () => {
        store.clear();
        if (!existsSync(file)) return;
        const text = await readFile(file, 'utf8');
        let parsed: Data;
        try {
          const data = parse(text) ?? {};
          parsed = await parseData({ id, data, filePath: file });
        } catch (error) {
          if (devState()) return;
          throw new Error(`${path}: ${(error as Error).message}`);
        }
        const shown = hideExamples && !isDemoSite(config.root) ? hideExamples(parsed) : parsed;
        if (shown) store.set({ id, data: shown, filePath: path, digest: generateDigest(text) });
      };
      await sync();
      followFile(file, sync, { watcher, logger });
    },
  };
}

/** In dev, runs `sync` again whenever the file is created, edited or deleted. */
export function followFile(file: string, sync: () => Promise<void>, { watcher, logger }: Pick<LoaderContext, 'watcher' | 'logger'>) {
  watcher?.add(dirname(file));
  for (const event of ['add', 'change', 'unlink']) {
    watcher?.on(event, (changed: string) => {
      if (changed === file) sync().catch((error) => logger.error((error as Error).message));
    });
  }
}
