// Every page the theme injects, with its entrypoint under src/routes/.
// `dir: true` marks a page that must be written as <path>/index.html under build.format
// 'preserve'. Astro writes every injected page as <path>.html, so the build hook moves these (S2).
export type Route = { pattern: string; entry: string; dir?: boolean };

// TODO(M4): projects, publications, experience, writing (dir), contact, meet and redirects.
export const ROUTES: Route[] = [
  { pattern: '/', entry: 'index.astro' },
  { pattern: '/404', entry: '404.astro' },
];
