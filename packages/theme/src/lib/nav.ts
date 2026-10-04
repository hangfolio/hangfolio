// The header navigation (SPEC 5.3 `nav`). A key stands for a page and shows only when that page
// exists; {label, href} items always show. Without `nav`, every available page shows, in key order.
import { NAV_KEYS } from '../schema/site.ts';
import type { SiteYaml } from './site.ts';

export type NavItem = { key?: string; label: string; href: string };

/** The keys whose page exists. TODO(M3, M4): add each page as it is built and has content. */
export function availablePages(site: SiteYaml): Set<string> {
  return new Set(site.cv ? ['cv'] : []);
}

function itemFor(key: string, site: SiteYaml): NavItem | undefined {
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
