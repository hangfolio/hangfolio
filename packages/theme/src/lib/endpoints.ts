// Which generated files a build gets (SPEC 7.2), and what every page's head links to:
// - the feed at advanced.feed.path, while the writing page is on and there is a post to list;
// - robots.txt, only at base / (crawlers read it at the host root only);
// - manifest.webmanifest, unless public/ has a manifest of its own;
// - the Google verification file from advanced.googleVerification.file;
// - sitemap.xml and each advanced.sitemapAliases path, written after the build from the pages
//   that were built (src/lib/sitemap.ts).
// A file in public/ at the same path always wins: its endpoint is not injected (SPEC 7.2).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { findIcons, findPublicManifest, publicFileCheck, verificationFile, type HeadIcon } from './head.ts';
import type { SiteYaml } from './site.ts';

export type ManifestIcon = { src: string; sizes: string; type: string };

export type SeoPlan = {
  /** Endpoints to inject: the URL pattern and the file under src/routes/ */
  routes: { pattern: string; entry: string }[];
  /** Sitemap paths the build writes (those not already in public/) */
  sitemaps: string[];
  head: {
    icons: HeadIcon[];
    /** The manifest the head links to: the generated one or the one in public/ */
    manifest: string;
    manifestIcons: ManifestIcon[];
    /** The feed the head and footer link to, when there is one */
    feed?: { path: string; title: string };
    sitemap: string;
  };
};

type Args = { root: string; site: SiteYaml; demo: boolean; base: string; publicDir: URL };

export const SITEMAP = '/sitemap.xml';
export const MANIFEST = '/manifest.webmanifest';

const file = (path: string) => path.replace(/^\/+/, '');

export function planSeo({ root, site, demo, base, publicDir }: Args): SeoPlan {
  const has = publicFileCheck(publicDir);
  const routes: SeoPlan['routes'] = [];
  const add = (pattern: string, entry: string) => {
    if (!has(file(pattern))) routes.push({ pattern, entry });
  };

  // The feed: only with something in it, and only while the writing page is on.
  const feedPath = site.advanced.feed.path;
  const posts = site.pages.writing === false ? 0 : publishedPosts(root, demo);
  if (posts > 0) add(feedPath, 'feed.xml.ts');
  const feed = site.pages.writing !== false && (posts > 0 || has(file(feedPath))) ? { path: feedPath, title: feedTitle(site) } : undefined;

  if (base.replace(/\/+$/, '') === '') add('/robots.txt', 'robots.txt.ts');

  const publicManifest = findPublicManifest(has);
  if (!publicManifest) add(MANIFEST, 'manifest.webmanifest.ts');

  const token = site.advanced.googleVerification?.file;
  if (token) add(verificationFile(token), 'google-verification.ts');

  const icons = findIcons(has);
  return {
    routes,
    sitemaps: [SITEMAP, ...site.advanced.sitemapAliases].filter((path, i, all) => all.indexOf(path) === i && !has(file(path))),
    head: { icons, manifest: publicManifest ?? MANIFEST, manifestIcons: manifestIcons(icons, (href) => fileURLToPath(new URL(file(href), publicDir))), feed, sitemap: SITEMAP },
  };
}

/** advanced.feed.title with {name} filled in ("{name} — Writing" by default). */
export const feedTitle = (site: SiteYaml) => site.advanced.feed.title.replaceAll('{name}', site.name);

/**
 * The posts the writing pages will show: content/writing/*.md(x) that are not drafts and, outside
 * demo mode, not examples. Counted before Astro reads them, to decide whether there is a feed.
 */
export function publishedPosts(root: string, demo: boolean): number {
  const dir = join(root, 'content', 'writing');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((name) => /\.mdx?$/.test(name))
    .filter((name) => {
      const data = frontMatter(readFileSync(join(dir, name), 'utf8'));
      return data?.draft !== true && (demo || data?.example !== true);
    }).length;
}

function frontMatter(text: string): Record<string, unknown> | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text.replace(/^﻿/, ''));
  try {
    const data = match ? parse(match[1]) : undefined;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
  } catch {
    return undefined; // the checks report it; the build stops there
  }
}

/** The head icons a web manifest can list: PNGs with their real size, and an SVG at any size. */
function manifestIcons(icons: HeadIcon[], pathOf: (href: string) => string): ManifestIcon[] {
  return icons.flatMap((icon): ManifestIcon[] => {
    if (icon.mask) return [];
    if (icon.href.endsWith('.svg')) return [{ src: icon.href, sizes: 'any', type: 'image/svg+xml' }];
    if (!icon.href.endsWith('.png')) return [];
    const size = pngSize(pathOf(icon.href));
    return size ? [{ src: icon.href, sizes: `${size.width}x${size.height}`, type: 'image/png' }] : [];
  });
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(path: string): { width: number; height: number } | undefined {
  try {
    const bytes = readFileSync(path);
    if (bytes.length < 24 || bytes.toString('latin1', 12, 16) !== 'IHDR') return undefined;
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } catch {
    return undefined;
  }
}
