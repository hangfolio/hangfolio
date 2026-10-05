// The absolute-URL checker (PLAN M6 verify): reads every page and generated file in a built site
// and reports each URL on the site's own origin that does not start with the site's home URL
// (so it escaped the base), contains //, or is missing where it must be:
// - HTML: canonical (indexable pages), og:url equal to it, og:image and twitter:image, every
//   JSON-LD @id, and root-relative href/src under the base;
// - sitemaps: every <loc>; the feed: the channel link and every item link and guid;
// - robots.txt Sitemap lines; the web manifest's start_url, scope and icons.
// Run it alone with: node packages/theme/test/e2e/abs-urls.ts <dist> <home URL>
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const attrOf = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const tagsOf = (html: string, name: string, key: string, value: string) =>
  [...html.matchAll(new RegExp(`<${name}\\s[^>]*\\b${key}="${value}"[^>]*>`, 'g'))].map((m) => m[0]);

export function absUrlProblems(dist: string, home: string): string[] {
  const { origin, pathname: basePath } = new URL(home);
  const problems: string[] = [];
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && TEXT.has(extname(entry.name)))
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)))
    .filter((file) => !file.startsWith('_astro'));

  const underHome = (file: string, what: string, value: string | undefined) => {
    if (!value) return problems.push(`${file}: ${what} is missing`);
    const path = value.startsWith(origin) ? value.slice(origin.length) : undefined;
    if (!value.startsWith(home)) problems.push(`${file}: ${what} ${value} is not under ${home}`);
    else if (path?.includes('//')) problems.push(`${file}: ${what} ${value} contains //`);
  };

  for (const file of files) {
    const text = readFileSync(join(dist, file), 'utf8');
    // Any URL on the site's origin, anywhere in the file, must be under home.
    for (const [match] of text.matchAll(new RegExp(`${escapeRe(origin)}(?:/[^"'<>\\s\\\\)]*)?`, 'g'))) underHome(file, 'URL', decode(match));

    if (file.endsWith('.html')) checkHtml(file, text);
    else if (file.endsWith('.xml')) checkXml(file, text);
    else if (file === 'robots.txt') for (const [, value] of text.matchAll(/^Sitemap:\s*(\S+)/gim)) underHome(file, 'Sitemap', value);
    else if (/manifest/.test(file)) checkManifest(file, text);
  }
  return problems;

  function checkHtml(file: string, html: string) {
    if (!/<head[\s>]/i.test(html)) return; // not a page, e.g. a search engine's verification file
    const head = html.slice(0, html.indexOf('</head>') >>> 0);
    const robots = tagsOf(head, 'meta', 'name', 'robots')[0];
    const indexable = !/noindex/.test((robots && attrOf(robots, 'content')) ?? '');
    const canonicalTag = tagsOf(head, 'link', 'rel', 'canonical')[0];
    const canonical = canonicalTag && decode(attrOf(canonicalTag, 'href') ?? '');
    const ogUrlTag = tagsOf(head, 'meta', 'property', 'og:url')[0];
    const ogUrl = ogUrlTag && decode(attrOf(ogUrlTag, 'content') ?? '');
    // A refresh page (a redirect) is about its target, which may be anywhere.
    const redirect = /<meta http-equiv="refresh"/i.test(head);
    if (indexable && !redirect) {
      underHome(file, 'canonical', canonical);
      if (ogUrl !== canonical) problems.push(`${file}: og:url ${ogUrl} differs from the canonical ${canonical}`);
    }
    for (const property of ['og:image', 'twitter:image']) {
      for (const tag of [...tagsOf(head, 'meta', 'property', property), ...tagsOf(head, 'meta', 'name', property)]) {
        const value = decode(attrOf(tag, 'content') ?? '');
        if (!/^https?:\/\//.test(value)) problems.push(`${file}: ${property} ${value} is not absolute`);
      }
    }
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
      let graph: unknown;
      try {
        graph = JSON.parse(json);
      } catch {
        problems.push(`${file}: the JSON-LD is not valid JSON`);
        continue;
      }
      for (const id of idsIn(graph)) underHome(file, 'JSON-LD @id', id);
    }
    for (const [, ref] of html.matchAll(/\b(?:href|src)="(\/[^"]*)"/g)) {
      if (ref.startsWith('//') || ref.includes('//')) problems.push(`${file}: ${ref} contains //`);
      else if (basePath !== '/' && !(ref + '/').startsWith(basePath)) problems.push(`${file}: ${ref} escapes the base ${basePath}`);
    }
  }

  function checkXml(file: string, xml: string) {
    if (/<urlset\b/.test(xml)) for (const [, loc] of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) underHome(file, '<loc>', decode(loc));
    if (/<rss\b/.test(xml)) {
      const channel = xml.replace(/<item>.*?<\/item>/gs, '');
      underHome(file, 'channel <link>', /<link>([^<]*)<\/link>/.exec(channel)?.[1]);
      for (const [, item] of xml.matchAll(/<item>(.*?)<\/item>/gs)) {
        underHome(file, 'item <link>', /<link>([^<]*)<\/link>/.exec(item)?.[1]);
        underHome(file, 'item <guid>', /<guid[^>]*>([^<]*)<\/guid>/.exec(item)?.[1]);
      }
    }
  }

  function checkManifest(file: string, text: string) {
    let manifest: { start_url?: string; scope?: string; icons?: { src?: string }[] };
    try {
      manifest = JSON.parse(text);
    } catch {
      return void problems.push(`${file}: not valid JSON`);
    }
    for (const key of ['start_url', 'scope'] as const) {
      const value = manifest[key];
      if (value && /^https?:/.test(value)) underHome(file, key, value);
    }
    for (const icon of manifest.icons ?? []) {
      const src = icon.src ?? '';
      if (src.startsWith('/') && basePath !== '/' && !src.startsWith(basePath)) problems.push(`${file}: icon ${src} escapes the base ${basePath}`);
    }
  }
}

/** Every "@id" value in a JSON-LD document. */
function idsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(idsIn);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => (key === '@id' && typeof v === 'string' ? [v] : idsIn(v)));
}

if (import.meta.main ?? process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dist, home] = process.argv.slice(2);
  if (!dist || !home) {
    console.error('usage: node abs-urls.ts <dist> <home URL, e.g. https://u.github.io/hangfolio/>');
    process.exit(2);
  }
  const problems = absUrlProblems(dist, home);
  for (const problem of problems) console.log(problem);
  console.log(problems.length === 0 ? `abs-urls: every URL in ${dist} is under ${home}` : `abs-urls: ${problems.length} problems`);
  process.exit(problems.length === 0 ? 0 : 1);
}
