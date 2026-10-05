// site.yaml `booking` (SPEC 5.3): how the booking page books, and the Cal.com embed's settings.
import type { SiteYaml } from './site.ts';

/**
 * - calcom: the page embeds the Cal.com calendar;
 * - link: the page links out to the booking page, with no third-party script;
 * - off: neither is set and keepPageWhenOff keeps the page, which points to email instead;
 * - undefined: no booking block, so no booking page.
 */
export type BookingMode = 'calcom' | 'link' | 'off';

export function bookingMode(site: SiteYaml): BookingMode | undefined {
  const booking = site.booking;
  if (!booking) return undefined;
  if (booking.calcom) return 'calcom';
  if (booking.link) return 'link';
  return 'off';
}

/** "cal.com" or "example.org": the host a booking link goes to, for the page's fallback line. */
export function bookingHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

/**
 * The options for the Cal.com embed: the visitor's theme on load and the brand colour of each
 * theme, which come from the accent tokens so a recolour never falls out of sync (SPEC 6.1).
 */
export function calConfig(calLink: string, accent: { light: string; dark: string }) {
  return {
    calLink,
    ui: {
      layout: 'month_view',
      hideEventTypeDetails: false,
      cssVarsPerTheme: { light: { 'cal-brand': accent.light }, dark: { 'cal-brand': accent.dark } },
    },
  };
}
