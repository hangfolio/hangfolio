// The header navigation (SPEC 5.3 `nav`). A key stands for a page and shows only when that page
// exists; {label, href} items always show. Without `nav`, every available page shows, in key order.
import { NAV_KEYS } from '../schema/site.ts';
import { bookingMode } from './booking.ts';
import { pageUrl } from './paths.ts';
import type { SiteYaml } from './site.ts';

export type NavItem = { key?: string; label: string; href: string };

/**
 * What the content folder holds, as far as pages depend on it (lib/collections.ts pageContent):
 * `research` is the home page's research section (lib/home.ts showsResearch); the others are
 * listed projects, experience entries and published posts.
 */
export type PageContent = { research?: boolean; projects?: boolean; experience?: boolean; writing?: boolean };

type PageKey = 'projects' | 'experience' | 'writing' | 'contact' | 'meet';

/** The address of one of site.yaml's pages, as links and canonical URLs write it; undefined when it is off. */
export function pagePath(site: SiteYaml, key: PageKey): string | undefined {
  const page = site.pages[key];
  return page ? pageUrl(page.path, site.advanced.urlFormat) : undefined;
}

/**
 * The keys whose page exists: a content page while it is on and has content, the CV, the
 * booking page while booking is open (not paused), and the contact page while it is on.
 * TODO(M5): publications.
 */
export function availablePages(site: SiteYaml, content: PageContent = {}): Set<string> {
  const keys = new Set<string>();
  if (content.research) keys.add('research');
  for (const key of ['projects', 'experience', 'writing'] as const) if (content[key] && site.pages[key]) keys.add(key);
  if (site.cv) keys.add('cv');
  const booking = bookingMode(site);
  if (site.pages.meet && booking && booking !== 'off') keys.add('booking');
  if (site.pages.contact) keys.add('contact');
  return keys;
}

const LABELS = { projects: 'Projects', experience: 'Experience', writing: 'Writing', contact: 'Contact' };

function itemFor(key: string, site: SiteYaml): NavItem | undefined {
  if (key === 'research') return { key, label: 'Research', href: `/#${site.advanced.anchors.research}` };
  if (key === 'cv' && site.cv) return { key, label: 'CV', href: site.cv };
  if (key === 'booking' && site.booking && site.pages.meet) return { key, label: site.booking.label, href: pagePath(site, 'meet')! };
  if (key === 'projects' || key === 'experience' || key === 'writing' || key === 'contact') {
    const href = pagePath(site, key);
    return href ? { key, label: LABELS[key], href } : undefined;
  }
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
