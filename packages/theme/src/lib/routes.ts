// Every page the theme injects, with its entrypoint under src/routes/.
// `dir: true` marks a page that must be written as <path>/index.html under build.format
// 'preserve'. Astro writes every injected page as <path>.html, so the build hook moves these (S2).
import type { SiteYaml } from './site.ts';

export type Route = { pattern: string; entry: string; dir?: boolean };

// TODO(M4): projects, publications, experience, writing (dir), contact, meet and redirects.
export const ROUTES: Route[] = [
  { pattern: '/', entry: 'index.astro' },
  { pattern: '/404', entry: '404.astro' },
];

/**
 * The publications page at pages.publications.path, while it is on and `show` (there is
 * something on it, or it is dev). A path ending in / is written as <path>/index.html.
 */
export function publicationsRoute(site: SiteYaml, show: boolean): Route[] {
  const page = site.pages.publications;
  if (!page || !show) return [];
  const pattern = page.path.replace(/(\/index)?\.html$/, '').replace(/\/+$/, '') || '/';
  return [{ pattern, entry: 'publications.astro', dir: page.path.endsWith('/') }];
}
