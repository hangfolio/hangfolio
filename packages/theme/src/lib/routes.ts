// Every page the theme injects, with its entrypoint under src/routes/.
// `dir: true` marks a page that must be written as <path>/index.html under build.format
// 'preserve'. Astro writes every injected page as <path>.html, so the build hook moves these (S2).
//
// Pages that need content (projects, experience, writing) are injected at `<path>/[...page]`:
// their getStaticPaths gives the page itself (an undefined rest) only when there is something
// to show, so an empty collection writes no file, in builds and in dev alike.
import { redirectFile, routeShape } from './paths.ts';
import type { SiteYaml } from './site.ts';

export type Route = { pattern: string; entry: string; dir?: boolean };

export const ROUTES: Route[] = [{ pattern: '/', entry: 'index.astro' }];

/** A page that writes one file at `path`, or none when its getStaticPaths finds no content. */
function page(path: string, entry: string, needsContent: boolean): Route {
  const { route, dir } = routeShape(path);
  return { pattern: needsContent ? `${route}/[...page]` : route, entry, dir };
}

/** The `/<path>/<id>/` pages under a list page, e.g. /projects/<id>/ and /writing/<slug>/. */
const children = (path: string, param: string, entry: string): Route => ({
  pattern: `${routeShape(path).route}/[${param}]`,
  entry,
  dir: true,
});

/**
 * The routes for site.yaml's pages (SPEC 5.3 `pages`, `booking`, `redirects`), from the site as
 * the pages show it (example values hidden). A redirect whose file is in public/ is left out:
 * public files win (SPEC 7.2).
 */
export function pageRoutes(site: SiteYaml, inPublic: (file: string) => boolean = () => false): Route[] {
  const { pages } = site;
  const routes: Route[] = [];
  if (pages.projects) routes.push(page(pages.projects.path, 'projects.astro', true), children(pages.projects.path, 'id', 'project.astro'));
  if (pages.experience) routes.push(page(pages.experience.path, 'experience.astro', true));
  if (pages.writing) routes.push(page(pages.writing.path, 'writing.astro', true), children(site.advanced.writingPath, 'slug', 'post.astro'));
  if (pages.contact) routes.push(page(pages.contact.path, 'contact.astro', false));
  if (pages.meet && site.booking) routes.push(page(pages.meet.path, 'meet.astro', false));
  if (pages.notFound !== false) routes.push({ pattern: '/404', entry: '404.astro' });
  for (const { from } of site.redirects) {
    const file = redirectFile(from, site.advanced.urlFormat);
    if (!inPublic(file.slice(1))) routes.push({ pattern: file, entry: 'redirect.ts' });
  }
  return routes;
}
