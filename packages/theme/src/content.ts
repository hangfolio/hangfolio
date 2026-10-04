// The content collections, read from the site's content/ folder. A site's src/content.config.ts
// re-exports them (SPEC 4.2). TODO(M2): the schemas move to src/schema/ with the lenient
// shorthands; M4 renders writing and adds the other collections.
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';

// Every content folder is optional (SPEC 5.1), so Astro's warnings about a missing or empty
// folder are dropped. The glob loader still watches the folder, so creating it in dev works.
function optional(loader: Loader): Loader {
  const quiet = /does not exist|No files found/;
  return {
    ...loader,
    load: (context) =>
      loader.load({
        ...context,
        logger: new Proxy(context.logger, {
          get(target, key) {
            if (key === 'warn') return (message: string) => quiet.test(message) || target.warn(message);
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        }),
      }),
  };
}

// SPEC 5.9
const writing = defineCollection({
  loader: optional(glob({ pattern: '*.{md,mdx}', base: './content/writing' })),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    description: z.string(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    example: z.boolean().default(false),
    minutes: z.number().int().positive().optional(),
  }),
});

export const collections = { writing };
