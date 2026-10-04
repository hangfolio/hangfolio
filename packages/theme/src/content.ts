// The content collections, read from the site's content/ folder with the schemas in src/schema/
// (SPEC 5). A site's src/content.config.ts re-exports them (SPEC 4.2). Every file and folder is
// optional; a missing one gives an empty collection. Outside demo mode, entries marked
// `example: true` never reach the pages (SPEC 5.2 rule 3); the checks list them as W403.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { hideExamples, isExample, optional, tolerant } from './lib/loaders.ts';
import { yamlFile } from './lib/yaml-file.ts';
import { experience, home, news, post, project, projectsGroups, publication } from './schema/index.ts';

const markdown = (folder: string, options: Partial<Parameters<typeof glob>[0]> = {}) =>
  hideExamples(tolerant(optional(glob({ pattern: '*.{md,mdx}', base: `./content/${folder}`, ...options }))));

/** A YAML file's list without its example entries. */
const withoutExamples = (list: string) => (data: Record<string, unknown>) => ({
  ...data,
  [list]: (data[list] as unknown[]).filter((item) => !isExample(item)),
});

export const collections = {
  writing: defineCollection({ loader: markdown('writing'), schema: post }),
  projects: defineCollection({ loader: markdown('projects'), schema: project }),
  // Ids are the file names exactly, because BibTeX keys are case-sensitive.
  publications: defineCollection({
    loader: markdown('publications', { generateId: ({ entry }) => entry.replace(/\.mdx?$/, '') }),
    schema: publication,
  }),
  // One entry each, named after the file: getEntry('home', 'home').
  home: defineCollection({ loader: yamlFile('content/home.yaml', (data) => (isExample(data) ? undefined : data)), schema: home }),
  projectGroups: defineCollection({ loader: yamlFile('content/projects.yaml'), schema: projectsGroups }),
  experience: defineCollection({ loader: yamlFile('content/experience.yaml', withoutExamples('entries')), schema: experience }),
  news: defineCollection({ loader: yamlFile('content/news.yaml', withoutExamples('items')), schema: news }),
};
