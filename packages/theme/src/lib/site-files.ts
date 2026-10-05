// The small generated files at the site root (SPEC 7.2): robots.txt, the web manifest and the
// Google verification file. Their routes are in src/routes/; lib/endpoints.ts decides which exist.
import type { ManifestIcon } from './endpoints.ts';
import { SITEMAP } from './endpoints.ts';
import { siteDescription, type SiteYaml } from './site.ts';

/** robots.txt: everything allowed, and where the sitemaps are, as absolute URLs. */
export function robotsTxt(site: SiteYaml, abs: (path: string) => string): string {
  const sitemaps = [SITEMAP, ...site.advanced.sitemapAliases].filter((path, i, all) => all.indexOf(path) === i);
  return ['User-agent: *', 'Allow: /', '', ...sitemaps.map((path) => `Sitemap: ${abs(path)}`), ''].join('\n');
}

type ManifestArgs = {
  abs: (path: string) => string;
  url: (path: string) => string;
  icons: ManifestIcon[];
  /** The light design tokens: background and accent */
  colors: { bg: string; accent: string };
};

/** manifest.webmanifest: the name, the home page as start_url, and colours from the design tokens. */
export function webManifest(site: SiteYaml, { abs, url, icons, colors }: ManifestArgs): string {
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: siteDescription(site),
    lang: site.advanced.lang,
    start_url: abs('/'),
    scope: abs('/'),
    display: 'standalone',
    background_color: colors.bg,
    theme_color: colors.accent,
    icons: icons.map((icon) => ({ ...icon, src: url(icon.src), purpose: 'any' })),
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

/** The body Google Search Console looks for in its HTML-file verification. */
export const verificationBody = (fileName: string) => `google-site-verification: ${fileName}`;
