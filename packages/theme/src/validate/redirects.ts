// A redirect at the address of a post or a project's page (E303). site.yaml's own check catches a
// redirect on one of the site's pages; the posts and project pages come from content/, so they are
// checked here. Left alone, the page would silently replace the redirect in the build.
import { childPath, samePage } from '../lib/paths.ts';
import { postPath } from '../lib/site.ts';
import type { Site } from '../schema/site.ts';
import type { Loaded } from './content-files.ts';
import type { Issue } from './issue.ts';
import { locate } from './source.ts';

/** The id Astro gives a content file (its glob loader's github-slugger slug of the file name). */
export const entryId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/ /g, '-');

export function redirectIssues(siteFile: Loaded, site: Site, shown: Loaded[]): Issue[] {
  if (site.redirects.length === 0) return [];
  const pages = new Map<string, string>();
  for (const file of shown) {
    if (!file.data || !file.id) continue;
    const id = entryId(file.id);
    if (file.kind === 'writing' && site.pages.writing && !file.data.draft) pages.set(samePage(postPath(site, id)), `the post ${file.file}`);
    if (file.kind === 'projects' && site.pages.projects && file.source.body.trim()) {
      pages.set(samePage(childPath(site.pages.projects.path, id)), `the page of ${file.file}`);
    }
  }
  return site.redirects.flatMap(({ from }, i) => {
    const page = pages.get(samePage(from));
    if (!page) return [];
    const where = locate(siteFile.source, ['redirects', i, 'from']);
    const message = `from '${from}' is the address of ${page}, so the page would replace this redirect. Delete one of the two.`;
    return [{ code: 'E303' as const, file: siteFile.file, ...(where && { line: where.line, col: where.col, endLine: where.endLine, endCol: where.endCol }), message }];
  });
}
