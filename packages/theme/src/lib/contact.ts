// The contact page's rows (SPEC 5.3): the location, each link marked `contact`, and booking.
import type { SiteYaml } from './site.ts';

export type ContactRow = { label: string; text: string; href?: string; external?: boolean };

/** A link as the contact page shows it: github.com/someone, or the address of a mailto: link. */
export function displayUrl(href: string): string {
  if (/^(mailto|tel):/i.test(href)) return href.replace(/^(mailto|tel):/i, '').replace(/\?.*$/, '');
  return href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

/** `booking` is where the booking row links (lib/hero.ts bookingHref), when there is one. */
export function contactRows(site: SiteYaml, booking?: string): ContactRow[] {
  const rows: ContactRow[] = [];
  const location = site.locationLong ?? site.location;
  if (location) rows.push({ label: 'Location', text: location });
  for (const link of site.links.filter((entry) => entry.contact)) {
    rows.push({ label: link.label, text: displayUrl(link.url), href: link.url, external: /^https?:/i.test(link.url) });
  }
  if (booking && site.booking) rows.push({ label: 'Book a call', text: 'Pick a time', href: booking });
  return rows;
}
