// Page paths as written in site.yaml, and the files and URLs they become (S2). A path ending in
// `/` (or `/index.html`) is directory-shaped and is written as <path>/index.html; any other is
// file-shaped and is written as <path>.html, unless advanced.urlFormat is `directory`.

export type UrlFormat = 'preserve' | 'directory';

/** `/writing/`, `/writing`, `/writing.html` and `/writing/index.html` are the same page. */
export const samePage = (path: string) => path.replace(/(\/index)?\.html$/, '').replace(/\/+$/, '') || '/';

/** The route a page path is injected at, and whether it is directory-shaped. */
export function routeShape(path: string): { route: string; dir: boolean } {
  const dir = /\/$|\/index\.html$/.test(path);
  return { route: samePage(path), dir };
}

/** The address a page is linked and canonicalised at: `/projects`, or `/writing/` when directory-shaped. */
export function pageUrl(path: string, urlFormat: UrlFormat = 'preserve'): string {
  const { route, dir } = routeShape(path);
  return route !== '/' && (dir || urlFormat === 'directory') ? `${route}/` : route;
}

/**
 * The exact file a redirect writes, from its `from` path: `/about.html` → `/about.html`,
 * `/about/` → `/about/index.html`, and `/about` → `/about.html` (or `/about/index.html` under
 * urlFormat `directory`). A last segment with an extension is kept as it is.
 */
export function redirectFile(from: string, urlFormat: UrlFormat = 'preserve'): string {
  const path = `/${from.replace(/^\/+/, '')}`;
  if (path.endsWith('/')) return `${path}index.html`;
  if (/\.[A-Za-z0-9]+$/.test(path.slice(path.lastIndexOf('/')))) return path;
  return urlFormat === 'directory' ? `${path}/index.html` : `${path}.html`;
}

/** A page under a list page: childPath('/projects', 'tidepool') is /projects/tidepool/. */
export const childPath = (path: string, id: string) => `${routeShape(path).route.replace(/\/$/, '')}/${id}/`;
