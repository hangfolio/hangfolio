// The structured parts of site.yaml (SPEC 5.3): links, availability, booking, pages, redirects
// and advanced. site.ts puts them together and resolves the page paths.
import { z } from 'zod';
import { inferLabel, slug } from '../lib/links.ts';
import { accent, bool, externalUrl, href, htmlId, md, navLink, pagePath, profileId, text, webUrl } from './common.ts';
import { partialDate } from './dates.ts';
import { exactlyOne, fail, show } from './issues.ts';

const profile = z
  .union([
    externalUrl,
    z.strictObject({
      url: externalUrl,
      label: text.optional(),
      id: profileId.optional(),
      hero: bool(true),
      contact: bool(true),
      footer: bool(true),
    }),
  ])
  .transform((value) => {
    const entry: { url: string; label?: string; id?: string; hero?: boolean; contact?: boolean; footer?: boolean } =
      typeof value === 'string' ? { url: value } : value;
    const { url, label = inferLabel(url), id, hero = true, contact = true, footer = true } = entry;
    return { url, label, id, hero, contact, footer };
  });

/**
 * site.yaml `links`, in render order. Each gets an id: its own (two equal ids are E303), else
 * the slug of its label, numbered when taken (github, github-2).
 */
export const profiles = z
  .array(profile)
  .default([])
  .transform((links, ctx) => {
    const owner = new Map<string, number>();
    links.forEach((entry, i) => {
      if (entry.id === undefined) return;
      const first = owner.get(entry.id);
      if (first === undefined) owner.set(entry.id, i);
      else fail(ctx, entry.id, 'E303', `'${entry.id}' is already used by link ${first + 1}; give each link its own id`, [i, 'id']);
    });
    return links.map((entry) => {
      if (entry.id !== undefined) return { ...entry, id: entry.id };
      const base = slug(entry.label) || 'link';
      let id = base;
      for (let n = 2; owner.has(id); n++) id = `${base}-${n}`;
      owner.set(id, -1);
      return { ...entry, id };
    });
  });

export const availability = z.strictObject({
  headline: text,
  detail: text.optional(),
  contact: md.optional(),
  emailSubject: text.optional(),
  until: partialDate().optional().describe('Hidden after this date (UTC).'),
});

// "your-name/30min", or the whole Cal.com address
const calcom = text.transform((value, ctx) => {
  const match = /^(?:https?:\/\/(?:app\.)?cal\.com\/)?([\w.-]+\/[\w.-]+)\/?$/i.exec(value.trim());
  if (match) return match[1];
  return fail(ctx, value, 'E202', `must be your Cal.com name and event, like your-name/30min (you wrote ${show(value)})`);
});

export const booking = z
  .strictObject({
    calcom: calcom.optional().describe('Your Cal.com name and event, like your-name/30min.'),
    link: webUrl.optional().describe('Any booking page; the site only links to it.'),
    label: text.default('Book a 1:1'),
    path: pagePath.default('/meet'),
    lede: md.optional(),
    emailSubject: text.default('Meeting request'),
    keepPageWhenOff: bool(false),
  })
  .check(exactlyOne(['calcom', 'link']));

const pageFields = { title: text.optional(), description: text.optional(), heading: text.optional(), lede: md.optional() };
const page = (extra: Record<string, z.ZodType> = {}) =>
  z.union([z.boolean(), z.strictObject({ path: pagePath.optional(), ...pageFields, ...extra })]).optional();

/** Each page: false turns it off; an object changes its path or text. */
export const pages = z
  .strictObject({
    projects: page(),
    publications: page({ prepAside: md.optional() }),
    experience: page(),
    writing: page(),
    contact: page(),
    meet: page(),
    card: page().describe('The phone-friendly card with a QR code to your site; on at /card.'),
    notFound: z.union([z.boolean(), z.strictObject(pageFields)]).optional(),
  })
  .prefault({});

export const redirect = z.strictObject({ from: pagePath, to: href });

export const seo = z.strictObject({
  description: text.optional(),
  keywords: z.array(text).optional(),
  jobTitle: text.optional(),
  alumniOf: z.array(text).optional(),
  knowsAbout: z.array(text).optional(),
});

export const theme = z.strictObject({
  accent: accent.optional().describe('One colour, or { light, dark }. Checked for contrast.'),
});

export const siteUrl = webUrl.check((ctx) => {
  try {
    const parsed = new URL(ctx.value);
    if (parsed.search || parsed.hash) {
      fail(ctx, ctx.value, 'E202', `must be the plain address of your home page, without ? or # (you wrote ${show(ctx.value)})`);
    }
  } catch {} // webUrl has reported it
});

/** The home sections and their default ids (advanced.anchors). */
export const SECTION_ANCHORS = {
  highlights: 'results',
  work: 'work',
  research: 'research',
  experience: 'exp',
  education: 'education',
  news: 'news',
  writing: 'writing',
  contact: 'contact',
};

const anchors = z
  .strictObject(Object.fromEntries(Object.entries(SECTION_ANCHORS).map(([section, id]) => [section, htmlId.default(id)])))
  .prefault({})
  .check((ctx) => {
    const owner = new Map<string, string>();
    for (const [section, id] of Object.entries(ctx.value)) {
      const first = owner.get(id);
      if (first === undefined) owner.set(id, section);
      else fail(ctx, id, 'E303', `'${id}' is already the anchor of the ${first} section; give each section its own`, [section]);
    }
  });

const locale = text.check((ctx) => {
  try {
    Intl.getCanonicalLocales(ctx.value.replace('_', '-'));
  } catch {
    fail(ctx, ctx.value, 'E202', `must be a language code like en or en_US (you wrote ${show(ctx.value)})`);
  }
});

const timezone = text.check((ctx) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: ctx.value });
  } catch {
    fail(ctx, ctx.value, 'E202', `must be a time zone like UTC or America/New_York (you wrote ${show(ctx.value)})`);
  }
});

// The token from Google Search Console's HTML file or meta tag method
const token = text.regex(/^[\w.-]+$/, 'must be the token Google gives you: letters, digits, ., - and _');

export const advanced = z
  .strictObject({
    urlFormat: z.enum(['preserve', 'directory']).default('preserve'),
    trailingSlash: z.enum(['ignore', 'always', 'never']).default('ignore'),
    lang: locale.default('en'),
    locale: locale.default('en_US'),
    timezone: timezone.default('UTC').describe('For the footer\'s "Last updated".'),
    brand: text.optional().describe('The header home link. Default: the site\'s host.'),
    titleSuffix: z.string().default(' — {name}'),
    writingPath: pagePath.default('/writing'),
    feed: z
      .strictObject({ path: pagePath.default('/feed.xml'), title: text.default('{name} — Writing'), description: text.optional() })
      .prefault({}),
    sitemapAliases: z.array(pagePath).default([]),
    googleVerification: z.strictObject({ file: token.optional(), meta: token.optional() }).optional(),
    anchors,
    labels: z
      .strictObject({
        minRead: text.default('min read'),
        allWriting: text.default('← All writing'),
        now: text.default('Now:'),
        src: text.default('src ·'),
      })
      .prefault({}),
    footer: z.strictObject({ links: z.array(navLink).default([]), showUpdated: bool(true) }).prefault({}),
    nameParts: z
      .strictObject({ given: text, family: text })
      .optional()
      .describe('Your name split for the contact card. Default: the last word is the family name.'),
  })
  .prefault({});
