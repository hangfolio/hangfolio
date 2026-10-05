// sitemap.xml and its aliases (SPEC 7.2), written after the build from the pages that were
// built: every HTML page with a canonical link on the site and no noindex. So a page that is
// turned off, has no content, is a redirect or is the example site never gets an entry, and every
// entry is a page that exists. Posts (pages with article:published_time) get a lastmod.
import { readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type SitemapEntry = { loc: string; lastmod?: string };

type Page = SitemapEntry & { published?: string };

const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const decode = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e as string]!);

/** The <link> or <meta> tag whose `key` attribute is `value`, e.g. tag(html, 'link', 'rel', 'canonical'). */
function tag(html: string, name: string, key: string, value: string): string | undefined {
  return html.match(new RegExp(`<${name}\\s[^>]*\\b${key}="${value}"[^>]*>`))?.[0];
}

/** What one built page adds to the sitemap, if anything. */
export function pageEntry(html: string, home: string): Page | undefined {
  const head = html.slice(0, html.search(/<\/head>/i) >>> 0);
  const robots = tag(head, 'meta', 'name', 'robots');
  if (robots && /noindex/i.test(attr(robots, 'content') ?? '')) return undefined;
  const canonical = tag(head, 'link', 'rel', 'canonical');
  const loc = canonical && attr(canonical, 'href');
  if (!loc || !decode(loc).startsWith(home)) return undefined;
  const time = (property: string) => {
    const meta = tag(head, 'meta', 'property', property);
    return meta && attr(meta, 'content');
  };
  const published = time('article:published_time');
  return { loc: decode(loc), lastmod: (time('article:modified_time') ?? published)?.slice(0, 10), published };
}

/**
 * Every indexable page under dist: the home page first, then the URLs in `order` (the theme's
 * pages in their usual order), then the other pages alphabetically, then posts newest first.
 */
export function sitemapEntries(dist: string, home: string, order: string[] = []): SitemapEntry[] {
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.slice(dist.length).split(/[\\/]/).includes('_astro'));
  const pages = new Map<string, Page>();
  for (const path of files) {
    const page = pageEntry(readFileSync(path, 'utf8'), home);
    if (page && !pages.has(page.loc)) pages.set(page.loc, page);
  }
  const group = (page: Page) => (page.loc === home ? 0 : page.published ? 3 : order.includes(page.loc) ? 1 : 2);
  const position = (page: Page) => order.indexOf(page.loc);
  const newest = (a: Page, b: Page) => (b.published ?? '').localeCompare(a.published ?? '');
  return [...pages.values()]
    .sort((a, b) => group(a) - group(b) || position(a) - position(b) || newest(a, b) || a.loc.localeCompare(b.loc))
    .map(({ loc, lastmod }) => (lastmod ? { loc, lastmod } : { loc }));
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The sitemap file, one <url> per line, in the shape of the reference design's. */
export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries.map(({ loc, lastmod }) => `  <url><loc>${escape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>\n`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('')}</urlset>\n`;
}

/** Writes the same sitemap at each path (sitemap.xml and its aliases); returns how many URLs it lists. */
export async function writeSitemaps(dist: string, paths: string[], home: string, order: string[] = []): Promise<number> {
  if (paths.length === 0) return 0;
  const entries = sitemapEntries(dist, home, order);
  const xml = sitemapXml(entries);
  for (const path of paths) {
    const file = join(dist, path.replace(/^\/+/, ''));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, xml);
  }
  return entries.length;
}
