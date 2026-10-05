// What the home page's hero (components/Hero.astro) shows, worked out from site.yaml (SPEC 5.3)
// and content/home.yaml (SPEC 5.4): the whoami line, the intro, the availability callout, the
// calls to action and the profile links.
import type { Home } from '../schema/home.ts';
import { escapeHtml, inlineMd } from './inline-md.ts';
import type { SiteYaml } from './site.ts';

type Availability = NonNullable<SiteYaml['availability']>;

/** "she/her · Port Alder, WA": pronouns and location, as far as either is set; '' with neither. */
export function whoami(site: SiteYaml): string {
  return [site.pronouns, site.location].filter(Boolean).join(' · ');
}

/**
 * The paragraph under the tagline: home.yaml `intro`, or else role and affiliation (linked when
 * it has a url), so a site without home.yaml still says who you are. undefined with none of them.
 */
export function introHtml(site: SiteYaml, home: Pick<Home, 'intro'> | undefined, base?: string): string | undefined {
  if (home?.intro) return inlineMd(home.intro, base);
  const affiliation = site.affiliation && (site.affiliation.url
    ? `<a href="${escapeHtml(site.affiliation.url)}">${escapeHtml(site.affiliation.name)}</a>`
    : escapeHtml(site.affiliation.name));
  const parts = [site.role && escapeHtml(site.role), affiliation].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** The end of the day, month or year `until` names, in UTC milliseconds. */
function endOf(until: string): number {
  const [year, month, day] = until.split('-').map(Number);
  if (day) return Date.UTC(year, month - 1, day + 1);
  if (month) return Date.UTC(year, month, 1);
  return Date.UTC(year + 1, 0, 1);
}

/** The availability block while it applies: it is hidden once `until` (UTC, that whole day) has passed. */
export function currentAvailability(site: SiteYaml, now: Date = new Date()): Availability | undefined {
  const availability = site.availability;
  if (!availability?.until) return availability;
  return now.getTime() < endOf(availability.until) ? availability : undefined;
}

/** A mailto: address, with the subject encoded so spaces become %20. */
export function mailto(email: string, subject?: string): string {
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
}

/** True when the path names a PDF, which earns the Résumé button its PDF badge. */
export function isPdf(path: string): boolean {
  return /\.pdf$/i.test(path.replace(/[?#].*$/, ''));
}

/**
 * Where the booking call to action goes: the booking page when the site has one; else the
 * booking link itself; else straight to Cal.com, except in demo mode, where the name is fictional.
 */
export function bookingHref(site: SiteYaml, pageExists: boolean, demo: boolean): string | undefined {
  const booking = site.booking;
  if (!booking) return undefined;
  if (pageExists && site.pages.meet) return site.pages.meet.path;
  if (booking.link) return booking.link;
  if (booking.calcom && !demo) return `https://cal.com/${booking.calcom}`;
  return undefined;
}

export type HeroActions = {
  resume?: { href: string; pdf: boolean };
  email: string;
  booking?: { label: string; href: string };
  profiles: { label: string; href: string; external: boolean }[];
};

/**
 * The hero's links: Résumé (with a PDF badge when the CV is a PDF), Email (with the
 * availability's subject while it applies), the booking link, and the links marked hero.
 */
export function heroActions(site: SiteYaml, options: { bookingPage: boolean; demo: boolean; now?: Date }): HeroActions {
  const booking = bookingHref(site, options.bookingPage, options.demo);
  return {
    resume: site.cv ? { href: site.cv, pdf: isPdf(site.cv) } : undefined,
    email: mailto(site.email, currentAvailability(site, options.now)?.emailSubject),
    booking: booking && site.booking ? { label: site.booking.label, href: booking } : undefined,
    profiles: site.links
      .filter((link) => link.hero)
      .map((link) => ({ label: link.label, href: link.url, external: /^https?:/i.test(link.url) })),
  };
}
