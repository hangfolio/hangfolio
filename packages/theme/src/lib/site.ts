// The parsed site.yaml that pages read (src/schema/site.ts), and the values derived from it.
import type { Site } from '../schema/site.ts';

export type SiteYaml = Site;

/**
 * The page title: `title` plus advanced.titleSuffix (default " — {name}"). Without a title it is
 * the home page's (homeTitle).
 */
export function pageTitle(site: SiteYaml, title?: string): string {
  if (!title) return homeTitle(site);
  return title + site.advanced.titleSuffix.replaceAll('{name}', site.name);
}

/**
 * The home page title in the reference design's shape, "Name | role @ affiliation"
 * ("Rowan Vale | PhD student @ Example University"). Either part may be missing.
 */
export function homeTitle(site: SiteYaml): string {
  const headline = [site.role, site.affiliation?.name].filter(Boolean).join(' @ ');
  return headline ? `${site.name} | ${headline}` : site.name;
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

/** A post's page (SPEC 5.9): /{writingPath}/{file name}/, e.g. /writing/what-fsync-promises/. */
export function postPath(site: SiteYaml, id: string): string {
  return `${site.advanced.writingPath.replace(/\/+$/, '')}/${id}/`;
}
