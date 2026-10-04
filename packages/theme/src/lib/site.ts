// The settings in site.yaml that the page shell reads (SPEC 5.3), and the values it derives from them.
// Everything except name and email is optional here.
export type SiteYaml = {
  name: string;
  email: string;
  tagline?: string;
  role?: string;
  affiliation?: string | { name: string; url?: string };
  location?: string;
  avatar?: string;
  ogImage?: string;
  cv?: string;
  links?: unknown[];
  nav?: (string | { label: string; href: string })[];
  seo?: { description?: string; keywords?: string[]; jobTitle?: string; alumniOf?: string[]; knowsAbout?: string[] };
  url?: string;
  advanced?: {
    urlFormat?: 'preserve' | 'directory';
    trailingSlash?: 'ignore' | 'always' | 'never';
    lang?: string;
    locale?: string;
    timezone?: string;
    brand?: string;
    titleSuffix?: string;
    footer?: { links?: { label: string; href: string }[]; showUpdated?: boolean };
  };
  [key: string]: unknown;
};

export function affiliationOf(site: SiteYaml): { name: string; url?: string } | undefined {
  return typeof site.affiliation === 'string' ? { name: site.affiliation } : site.affiliation;
}

/** The page title: `title` plus advanced.titleSuffix (default " — {name}"), or the name alone. */
export function pageTitle(site: SiteYaml, title?: string): string {
  if (!title) return site.name;
  return title + (site.advanced?.titleSuffix ?? ' — {name}').replaceAll('{name}', site.name);
}

/** The default meta description: seo.description, else "role, affiliation", else the name. */
export function siteDescription(site: SiteYaml): string {
  const parts = [site.role, affiliationOf(site)?.name].filter(Boolean);
  return site.seo?.description ?? (parts.length > 0 ? parts.join(', ') : site.name);
}

/** advanced.locale as a BCP 47 tag: en_US becomes en-US. */
export function localeTag(site: SiteYaml): string {
  return (site.advanced?.locale ?? 'en_US').replace('_', '-');
}
