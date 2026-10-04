// The content schemas (SPEC 5). Each is a zod schema that parses what a person wrote into the
// normalised shape the pages read: shorthands expanded and defaults filled in. The same schemas
// back the content collections (src/content.ts), site.yaml (src/config.ts), the validator and
// the JSON Schemas for editors (schema/*.json, written by scripts/schema.mjs).
import type { z } from 'zod';
import { experience } from './experience.ts';
import { home } from './home.ts';
import { news } from './news.ts';
import { post } from './post.ts';
import { project, projectsGroups } from './project.ts';
import { publication } from './publication.ts';
import { site } from './site.ts';

export { experience, home, news, post, project, projectsGroups, publication, site };
export type { Experience } from './experience.ts';
export type { Home } from './home.ts';
export type { News } from './news.ts';
export type { Post } from './post.ts';
export type { Project, ProjectsGroups } from './project.ts';
export type { Publication } from './publication.ts';
export type { Site, SiteInput } from './site.ts';

/** Every schema by its JSON Schema name (schema/<name>.json), with the file it describes. */
export const SCHEMAS: Record<string, { schema: z.ZodType; file: string }> = {
  site: { schema: site, file: 'site.yaml' },
  home: { schema: home, file: 'content/home.yaml' },
  project: { schema: project, file: 'content/projects/<id>.md (front matter)' },
  'projects-groups': { schema: projectsGroups, file: 'content/projects.yaml' },
  'publication-extra': { schema: publication, file: 'content/publications/<key>.md (front matter)' },
  experience: { schema: experience, file: 'content/experience.yaml' },
  news: { schema: news, file: 'content/news.yaml' },
  post: { schema: post, file: 'content/writing/<slug>.md (front matter)' },
};
