// The site-wide JSON-LD graph (WebSite and Person) that every page carries; pages add their own
// nodes. @ids are stable: <home>#website and <home>#person. TODO(M6): the remaining node types.
import { absUrl } from './url.ts';
import { localeTag, siteDescription, type SiteYaml } from './site.ts';

// Drops undefined values and empty arrays, so optional settings leave no empty keys.
const compact = (node: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));

export function siteGraph(site: SiteYaml, image: string | undefined, extra: Record<string, unknown>[] = []) {
  const home = absUrl('/');
  const affiliation = site.affiliation;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      compact({
        '@type': 'WebSite',
        '@id': `${home}#website`,
        url: home,
        name: site.name,
        description: siteDescription(site),
        publisher: { '@id': `${home}#person` },
        inLanguage: localeTag(site),
      }),
      compact({
        '@type': 'Person',
        '@id': `${home}#person`,
        name: site.name,
        url: home,
        image,
        jobTitle: site.seo?.jobTitle ?? site.role,
        email: `mailto:${site.email}`,
        worksFor: affiliation && compact({ '@type': 'Organization', name: affiliation.name, url: affiliation.url }),
        alumniOf: site.seo?.alumniOf?.map((name) => ({ '@type': 'Organization', name })),
        sameAs: site.links.map((link) => link.url).filter((href) => /^https?:/.test(href)),
        knowsAbout: site.seo?.knowsAbout,
      }),
      ...extra,
    ],
  };
}
