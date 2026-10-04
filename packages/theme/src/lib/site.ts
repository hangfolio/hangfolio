// The parsed site.yaml that pages read (src/schema/site.ts), and the values derived from it.
import type { Site } from '../schema/site.ts';

export type SiteYaml = Site;

/** The page title: `title` plus advanced.titleSuffix (default " — {name}"), or the name alone. */
export function pageTitle(site: SiteYaml, title?: string): string {
  if (!title) return site.name;
  return title + site.advanced.titleSuffix.replaceAll('{name}', site.name);
}

/** The default meta description: seo.description, else "role, affiliation", else the name. */
export function siteDescription(site: SiteYaml): string {
  const parts = [site.role, site.affiliation?.name].filter(Boolean);
  return site.seo?.description ?? (parts.length > 0 ? parts.join(', ') : site.name);
}

/** advanced.locale as a BCP 47 tag: en_US becomes en-US. */
export function localeTag(site: SiteYaml): string {
  return site.advanced.locale.replace('_', '-');
}
