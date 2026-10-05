// The header navigation (SPEC 5.3 `nav`). A key stands for a page and shows only when that page
// exists; {label, href} items always show. Without `nav`, every available page shows, in key order.
import { NAV_KEYS } from '../schema/site.ts';
import type { SiteYaml } from './site.ts';

export type NavItem = { key?: string; label: string; href: string };

/**
 * The keys whose page exists. `research` is the home page's research section (lib/home.ts
 * showsResearch); `publications` that the publications page has something on it
 * (lib/bib-content.ts). TODO(M4): add each page as it is built and has content.
 */
export function availablePages(site: SiteYaml, { research = false, publications = false }: { research?: boolean; publications?: boolean } = {}): Set<string> {
  return new Set([...(research ? ['research'] : []), ...(publications && site.pages.publications ? ['publications'] : []), ...(site.cv ? ['cv'] : [])]);
}

function itemFor(key: string, site: SiteYaml): NavItem | undefined {
  if (key === 'research') return { key, label: 'Research', href: `/#${site.advanced.anchors.research}` };
  if (key === 'publications' && site.pages.publications) return { key, label: 'Publications', href: site.pages.publications.path };
  if (key === 'cv' && site.cv) return { key, label: 'CV', href: site.cv };
  return undefined;
}

export function navItems(site: SiteYaml, available: Set<string>): NavItem[] {
  const wanted = Array.isArray(site.nav) ? site.nav : NAV_KEYS;
  return wanted.flatMap((entry) => {
    if (typeof entry !== 'string') return entry?.label && entry.href ? [{ label: entry.label, href: entry.href }] : [];
    const item = available.has(entry) ? itemFor(entry, site) : undefined;
    return item ? [item] : [];
  });
}
