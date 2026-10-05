// The structured parts of site.yaml (SPEC 5.3): links, availability, booking, pages, redirects
// and advanced. site.ts puts them together and resolves the page paths.
import { z } from 'zod';
import { inferLabel, slug } from '../lib/links.ts';
import { accent, bool, externalUrl, href, htmlId, md, navLink, pagePath, profileId, text, webUrl } from './common.ts';
import { partialDate } from './dates.ts';
import { exactlyOne, fail, show, type Issues } from './issues.ts';

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
    keepPageWhenOff: bool(false).describe('true: with neither calcom nor link (booking paused), the page stays and points to email.'),
  })
  .check((ctx) => {
    // Neither calcom nor link means booking is paused; that is allowed only to keep the page.
    if (ctx.value.calcom === undefined && ctx.value.link === undefined) {
      if (ctx.value.keepPageWhenOff) return;
      const message =
        'needs one of calcom or link. To pause booking but keep the page (it then points to email), ' +
        'add keepPageWhenOff: true; to turn booking off, delete the whole booking block';
      return void fail(ctx, ctx.value, 'E202', message);
    }
    exactlyOne(['calcom', 'link'])(ctx);
  });

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
    card: page().describe('Reserved for a later version; leave it out.'),
    notFound: z.union([z.boolean(), z.strictObject(pageFields)]).optional(),
  })
  .prefault({});

// A redirect is an HTML page with a refresh, so it can only stand where a page is read:
// /about, /about/ or /about.html. Written into old-cv.pdf or feed.xml it would break that file.
const redirectFrom = pagePath.check((ctx) => {
  if (typeof ctx.value !== 'string') return; // pagePath has reported it
  const last = ctx.value.slice(ctx.value.lastIndexOf('/') + 1);
  const extension = /\.([A-Za-z0-9]+)$/.exec(last)?.[1];
  if (extension === undefined || /^html?$/i.test(extension)) return;
  const message =
    `must be a page address like /about, /about/ or /about.html, because a redirect can't stand in for a .${extension} file. ` +
    `To keep an old file's address working, put the file itself at that path in public/ (you wrote ${show(ctx.value)})`;
  fail(ctx, ctx.value, 'E202', message);
});

export const redirect = z.strictObject({ from: redirectFrom, to: href });

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

// The path of a generated XML file (the feed, a sitemap copy). GitHub Pages picks a file's type
// from its extension, and without .xml the file could land on a page's address.
const xmlPath = (example: string) =>
  pagePath
    .check((ctx) => {
      if (!/\.xml$/i.test(ctx.value)) fail(ctx, ctx.value, 'E202', `must be a file path ending in .xml, like ${example} (you wrote ${show(ctx.value)})`);
    })
    .meta({ pattern: '\\.xml$' });

const SITEMAP_PATH = '/sitemap.xml';

/** The feed, the sitemap and each sitemap copy need their own file (E303). */
function ownFiles(ctx: Issues & { value: { feed: { path: string }; sitemapAliases: string[] } }) {
  const { feed, sitemapAliases } = ctx.value;
  if (feed.path === SITEMAP_PATH) {
    fail(ctx, feed.path, 'E303', `is also the sitemap's path (${show(SITEMAP_PATH)}); give the feed its own, like /feed.xml`, ['feed', 'path']);
  }
  sitemapAliases.forEach((path, i) => {
    if (path === feed.path) fail(ctx, path, 'E303', `is also the feed's path (${show(path)}); give the sitemap copy its own, like /sitemap-static.xml`, ['sitemapAliases', i]);
  });
}

// Google Search Console's two methods. The HTML file is always named google<hex>.html; the meta
// tag's token is a longer run of letters, digits, - and _. People paste the whole tag, the file's
// address or its contents, or put one method's token under the other's key.
const GOOGLE_FILE = /^google[0-9a-z]+(\.html)?$/;
const TOKEN = /^[\w.-]+$/;

const googleFile = text
  .check((ctx) => {
    if (GOOGLE_FILE.test(ctx.value)) return;
    const name = /\b(google[0-9a-z]{6,})(?:\.html)?\b/.exec(ctx.value)?.[1];
    const message = name
      ? `must be just the file's name, '${name}.html' (you wrote ${show(ctx.value)})`
      : TOKEN.test(ctx.value) && ctx.value.length >= 20
        ? `must be the name of the file Google gives you, like google1234567890abcdef.html; ${show(ctx.value)} looks like the meta tag's token, so put it under googleVerification.meta instead`
        : `must be the name of the file Google gives you, like google1234567890abcdef.html (you wrote ${show(ctx.value)})`;
    fail(ctx, ctx.value, 'E202', message);
  })
  .meta({ pattern: '^google[0-9a-z]+(\\.html)?$' });

const googleMeta = text
  .check((ctx) => {
    const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(ctx.value)?.[1];
    if (content) fail(ctx, ctx.value, 'E202', `must be only the token inside content="…", '${content}'`);
    else if (GOOGLE_FILE.test(ctx.value)) fail(ctx, ctx.value, 'E202', `is the HTML file's name (${show(ctx.value)}), so put it under googleVerification.file instead`);
    else if (!TOKEN.test(ctx.value)) fail(ctx, ctx.value, 'E202', `must be the token from Google's meta tag: letters, digits, ., - and _ (you wrote ${show(ctx.value)})`);
  })
  .meta({ pattern: '^[\\w.-]+$' });

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
      .strictObject({ path: xmlPath('/feed.xml').default('/feed.xml'), title: text.default('{name} — Writing'), description: text.optional() })
      .prefault({}),
    sitemapAliases: z.array(xmlPath('/sitemap-static.xml')).default([]),
    googleVerification: z.strictObject({ file: googleFile.optional(), meta: googleMeta.optional() }).optional(),
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
      .describe('Your name split into given and family names, for your initials, author matching and the profile tags. Default: the last word is the family name.'),
  })
  .check(ownFiles)
  .prefault({});
