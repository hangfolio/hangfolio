// site.yaml (SPEC 5.3), with pages.card and advanced.nameParts (SPEC-card-wallet.md 3.2).
//
// Only name and email are required, so a site with just those two builds (fixtures/empty).
// Defaults that depend on values example mode may hide (locationLong from location, ogImage
// from avatar) are left to the pages, so a hidden example value never leaks through them.
// A `card:` block is an unknown field (E201) until Google Wallet lands in v0.2.
import { z } from 'zod';
import { affiliation, filePath, md, navLink, oneOf, text } from './common.ts';
import { fail, show, type Issues } from './issues.ts';
import { advanced, availability, booking, pages, profiles, redirect, seo, siteUrl, theme } from './site-parts.ts';

export const NAV_KEYS = ['research', 'projects', 'publications', 'experience', 'writing', 'cv', 'booking', 'contact'] as const;

const email = text.check((ctx) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ctx.value)) {
    fail(ctx, ctx.value, 'E202', `doesn't look like an email address (you wrote ${show(ctx.value)})`);
  }
});

const fields = z.strictObject({
  name: text.max(80, 'must be 80 characters or fewer').describe('Your name: the page heading, titles and footer.'),
  tagline: md.optional().describe('The big sentence under your name.'),
  role: text.optional().describe('For example "PhD student in Computer Science".'),
  affiliation: affiliation.optional().describe('A name, or { name, url }.'),
  email: email.describe('Shown as a mailto link.'),
  nameVariants: z.array(text).default([]).describe('Other spellings of your name in author lists, to underline.'),
  location: text.optional(),
  locationLong: text.optional().describe('The contact page location. Default: location.'),
  pronouns: text.optional(),
  avatar: filePath.optional().describe('Your photo, e.g. /images/me.jpg. Default: public/images/avatar.jpg, .png or .webp if there is one, else your initials.'),
  avatarAlt: text.optional(),
  ogImage: filePath.optional().describe('The social preview image. Default: avatar.'),
  cv: filePath.optional().describe('Your CV, e.g. /files/cv.pdf. Adds the CV link and the Résumé button.'),
  links: profiles.describe('Profiles and other sites: a bare URL, or { url, label, id, hero, contact, footer }.'),
  availability: availability.optional().describe('A status callout on the home and contact pages.'),
  booking: booking.optional().describe('Adds a booking page (/meet): { calcom } or { link }.'),
  nav: z
    .array(z.union([oneOf(NAV_KEYS), navLink]))
    .optional()
    .describe('The header links. Default: every page with content.'),
  seo: seo.optional(),
  theme: theme.optional(),
  pages: pages.describe('Turn pages off (false) or change their path and text.'),
  redirects: z.array(redirect).default([]).describe('Old addresses that forward to new ones.'),
  url: siteUrl.optional().describe('Pins the site address; normally detected from GitHub Pages.'),
  advanced: advanced.describe('Rarely needed; see docs/site-yaml.md.'),
});

type Fields = z.output<typeof fields>;
type PageKey = Exclude<keyof Fields['pages'], 'notFound'>;
type PageOptions = { path: string; title?: string; description?: string; heading?: string; lede?: string; prepAside?: string };

// `/writing/`, `/writing`, `/writing.html` and `/writing/index.html` are the same page.
const route = (path: string) => path.replace(/(\/index)?\.html$/, '').replace(/\/+$/, '') || '/';
const dir = (path: string) => `${path.replace(/\/+$/, '')}/`;

type Owner = { what: string; at: PropertyKey[]; written: boolean };

/** Gives every page its path (defaults included) and reports two things at one path (E303). */
function resolvePages(site: Fields, ctx: Issues) {
  const defaults: Record<PageKey, string> = {
    projects: '/projects',
    publications: '/publications',
    experience: '/experience',
    writing: dir(site.advanced.writingPath),
    contact: '/contact',
    meet: site.booking?.path ?? '/meet',
    card: '/card',
  };
  // Where a default path comes from, for the message when only defaults collide.
  const source: Partial<Record<PageKey, PropertyKey[]>> = { writing: ['advanced', 'writingPath'], meet: ['booking', 'path'] };
  const owners = new Map<string, Owner>([['/', { what: 'the home page', at: [], written: false }]]);
  const claim = (path: string, owner: Owner) => {
    const other = owners.get(route(path));
    if (!other) return void owners.set(route(path), owner);
    // Point at a path the user wrote rather than at a default.
    const [here, there] = !owner.written && other.written ? [other, owner] : [owner, other];
    fail(ctx, path, 'E303', `is also the address of ${there.what} (${show(path)}); give each page its own path`, here.at);
  };

  const resolved = {} as Record<PageKey, false | PageOptions>;
  for (const key of Object.keys(defaults) as PageKey[]) {
    const value = site.pages[key];
    if (value === false) {
      resolved[key] = false;
      continue;
    }
    const options = typeof value === 'object' ? value : {};
    const written = options.path !== undefined;
    resolved[key] = { ...options, path: options.path ?? defaults[key] };
    // The booking page exists only with a booking block.
    if (key === 'meet' && !site.booking) continue;
    const at = written ? ['pages', key, 'path'] : (source[key] ?? ['pages', key]);
    claim(resolved[key].path, { what: `the ${key} page`, at, written });
  }
  site.redirects.forEach((entry, i) => claim(entry.from, { what: `redirect ${i + 1}`, at: ['redirects', i, 'from'], written: true }));

  const notFound = site.pages.notFound;
  return { ...resolved, notFound: notFound === false ? (false as const) : typeof notFound === 'object' ? notFound : {} };
}

export const site = fields.transform((value, ctx) => ({
  ...value,
  avatarAlt: value.avatarAlt ?? `Portrait of ${value.name}`,
  pages: resolvePages(value, ctx),
}));

export type Site = z.output<typeof site>;
export type SiteInput = z.input<typeof site>;
