// Reads site.yaml and the files in content/ with positions, and checks each against its schema.
// Every file is optional except site.yaml. Folders hold Markdown read by the content collections
// (src/content.ts); a file with syntax problems is not checked against its schema (S11).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { experience, home, news, post, project, projectsGroups, publication, site } from '../schema/index.ts';
import type { Issue } from './issue.ts';
import { knownKeys } from './schema-walk.ts';
import { loadSource, toData, type Source } from './source.ts';
import { syntaxIssues } from './yaml-hints.ts';
import { schemaIssues } from './zod-issues.ts';

export type Kind = 'site' | 'home' | 'projects-groups' | 'experience' | 'news' | 'projects' | 'publications' | 'writing';

export type Loaded = {
  file: string;
  kind: Kind;
  source: Source;
  /** The plain YAML data, when the file has no syntax problems */
  raw?: Record<string, unknown>;
  /** What the schema made of it, when it is valid */
  data?: any;
  /** Markdown: the entry id (the file name without its extension) */
  id?: string;
};

export const YAML_FILES: { file: string; kind: Kind; schema: z.ZodType }[] = [
  { file: 'content/home.yaml', kind: 'home', schema: home },
  { file: 'content/projects.yaml', kind: 'projects-groups', schema: projectsGroups },
  { file: 'content/experience.yaml', kind: 'experience', schema: experience },
  { file: 'content/news.yaml', kind: 'news', schema: news },
];

export const MARKDOWN_FOLDERS: { folder: string; kind: Kind; schema: z.ZodType }[] = [
  { folder: 'content/projects', kind: 'projects', schema: project },
  { folder: 'content/publications', kind: 'publications', schema: publication },
  { folder: 'content/writing', kind: 'writing', schema: post },
];

/** Loads one file and checks it: syntax first, then the schema. */
export function loadFile(root: string, file: string, kind: Kind, schema: z.ZodType): { loaded: Loaded; issues: Issue[] } {
  const source = loadSource(file, readFileSync(join(root, file), 'utf8'));
  const loaded: Loaded = { file, kind, source };
  const issues = syntaxIssues(source);
  if (issues.length > 0) return { loaded, issues };
  const raw = toData(source);
  if (raw === undefined) return { loaded, issues };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    const what = source.markdown ? 'The front matter' : 'This file';
    const key = source.markdown ? 'title' : (knownKeys(schema, [])[0] ?? 'name');
    const message = `${what} must be key: value lines, like ${key}: …, not a list or a single value.`;
    return { loaded, issues: [{ code: 'E202', file, line: 1, col: 1, message }] };
  }
  loaded.raw = raw as Record<string, unknown>;
  const result = schemaIssues(source, schema, raw);
  loaded.data = result.data;
  if (source.markdown && !source.doc && result.issues.length > 0) return { loaded, issues: [noFrontMatter(file, result.issues)] };
  return { loaded, issues: result.issues };
}

/** A Markdown file with no front matter but required fields: one message with the block to add. */
function noFrontMatter(file: string, issues: Issue[]): Issue {
  const keys = issues.map((issue) => /^'([^']+)' is required/.exec(issue.message)?.[1]).filter(Boolean);
  const names = keys.length > 1 ? `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}` : keys[0];
  const message = `This file has no front matter, so it is missing ${names}. Start the file with the block below.`;
  return { code: 'E203', file, line: 1, col: 1, message, fix: ['---', ...keys.map((key) => `${key}: "…"`), '---'].join('\n') };
}

export function loadSite(root: string): { loaded?: Loaded; issues: Issue[] } {
  if (!existsSync(join(root, 'site.yaml'))) {
    const message = 'There is no site.yaml next to package.json. Every site needs one, with at least name: and email: lines.';
    return { issues: [{ code: 'E203', file: 'site.yaml', message }] };
  }
  return loadFile(root, 'site.yaml', 'site', site);
}

/** Every content file that exists, loaded and checked. */
export function loadContent(root: string): { loaded: Loaded[]; issues: Issue[] } {
  const loaded: Loaded[] = [];
  const issues: Issue[] = [];
  const add = (result: { loaded: Loaded; issues: Issue[] }) => {
    loaded.push(result.loaded);
    issues.push(...result.issues);
  };
  for (const { file, kind, schema } of YAML_FILES) {
    if (existsSync(join(root, file))) add(loadFile(root, file, kind, schema));
  }
  for (const { folder, kind, schema } of MARKDOWN_FOLDERS) {
    for (const name of markdownFiles(join(root, folder))) {
      const result = loadFile(root, `${folder}/${name}`, kind, schema);
      result.loaded.id = name.replace(/\.mdx?$/, '');
      add(result);
    }
  }
  return { loaded, issues };
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** content/publications.bib, if there is one. */
export function readBib(root: string): { file: string; text: string } | undefined {
  const file = 'content/publications.bib';
  return existsSync(join(root, file)) ? { file, text: readFileSync(join(root, file), 'utf8') } : undefined;
}
