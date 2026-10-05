// Wrappers for the content loaders (src/content.ts):
// - optional(): a missing or empty folder is fine, without Astro's warnings;
// - hideExamples(): outside demo mode, entries marked `example: true` never reach the pages
//   (SPEC 5.2 rule 3);
// - tolerant(): in `hangfolio dev`, an entry the checks found wrong is left out instead of
//   stopping the dev server, so the error overlay can show the mistake (lib/dev-checks.ts).
import type { Loader, LoaderContext } from 'astro/loaders';
import { devState } from './dev-checks.ts';
import { isDemoSite } from './starter-values.ts';

type Store = LoaderContext['store'];
type Entry = Parameters<Store['set']>[0];
// Astro also hands loaders the Markdown and MDX readers, which aren't in its public type.
type EntryType = { getEntryInfo(params: { fileUrl: URL; contents: string }): unknown };
type Context = LoaderContext & { entryTypes?: Map<string, EntryType> };

/** A store that sends every set() through `keep`; an entry it refuses is removed instead. */
function filteredStore(store: Store, keep: (entry: Entry) => boolean): Store {
  return new Proxy(store, {
    get(target, key) {
      if (key === 'set') {
        return (entry: Entry) => {
          if (keep(entry)) return target.set(entry);
          target.delete(entry.id);
          return false;
        };
      }
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export const isExample = (data: unknown) => (data as { example?: unknown } | undefined)?.example === true;

// Stored and removed again in a collection that has no entries; see optional().
const NO_ENTRIES = '\0hangfolio-no-entries';

export function optional(loader: Loader): Loader {
  const quiet = /does not exist|No files found/;
  return {
    ...loader,
    load: async (context) => {
      await loader.load({
        ...context,
        logger: new Proxy(context.logger, {
          get(target, key) {
            if (key === 'warn') return (message: string) => quiet.test(message) || target.warn(message);
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }),
      });
      // getCollection() warns "does not exist or is empty" about a collection that never stored
      // an entry. Storing one and removing it leaves the collection existing and empty.
      if (context.store.keys().length === 0) {
        context.store.set({ id: NO_ENTRIES, data: {} });
        context.store.delete(NO_ENTRIES);
      }
    },
  };
}

/** Example entries stay out of the store, including any left from an earlier demo-mode build. */
export function hideExamples(loader: Loader): Loader {
  return {
    ...loader,
    load: async (context) => {
      if (isDemoSite(context.config.root)) return loader.load(context);
      await loader.load({ ...context, store: filteredStore(context.store, (entry) => !isExample(entry.data)) });
      for (const [id, entry] of context.store.entries()) if (isExample(entry.data)) context.store.delete(id);
    },
  };
}

const SKIPPED = Object.freeze({ hangfolioSkipped: true });

/** Wraps a Markdown reader so a file whose front matter can't be read comes back as SKIPPED. */
function skipUnreadable(type: EntryType): EntryType {
  return new Proxy(type, {
    get(target, key) {
      if (key !== 'getEntryInfo') return Reflect.get(target, key);
      return async (params: { fileUrl: URL; contents: string }) => {
        try {
          return await target.getEntryInfo(params);
        } catch {
          return { body: '', data: SKIPPED, rawData: '', slug: '' };
        }
      };
    },
  });
}

/** In dev, a file with a YAML or schema problem is left out rather than failing the whole sync. */
export function tolerant(loader: Loader): Loader {
  return {
    ...loader,
    load: (context: Context) => {
      if (!devState()) return loader.load(context);
      const entryTypes = context.entryTypes && new Map([...context.entryTypes].map(([ext, type]) => [ext, skipUnreadable(type)]));
      const parseData = (async (props: { data: unknown }) =>
        props.data === SKIPPED ? SKIPPED : context.parseData(props as never).catch(() => SKIPPED)) as LoaderContext['parseData'];
      const store = filteredStore(context.store, (entry) => (entry.data as unknown) !== SKIPPED);
      return loader.load({ ...context, entryTypes, parseData, store } as Context);
    },
  };
}
