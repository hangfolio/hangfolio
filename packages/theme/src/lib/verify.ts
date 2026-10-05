// `hangfolio verify dist` (SPEC 7.2, 10.1): reads every HTML, XML and CSS file in the built site
// and reports what would break on GitHub Pages. Nothing is fetched; external links are skipped.
//
// - E602: an internal link or asset that GitHub Pages can't serve. Pages serves /x from x.html or
//   (after a redirect) x/index.html, and /x/ only from x/index.html, which is how urlFormat
//   matters: under 'preserve', /projects/ is a 404 when the page is projects.html.
// - E606: a link written without the site's address that leaves the base (/projects at /hangfolio).
// - E607: // in a link's path (//projects is a server named "projects").
// - E608: a canonical, og:url, sitemap or other own address on another origin or outside the base.
// - E609: an id used twice on one page.
// - W610: a #fragment that names no id on its page.
// - W603: a file over 50 MB, or a site over 900 MB (GitHub Pages allows 1 GB).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Issue } from '../validate/issue.ts';
import { didYouMean } from '../validate/suggest.ts';
import { cssRefs, scanHtml, scanXml, type Ref, type Scan } from './verify-html.ts';

export type VerifyOptions = {
  /** The built site folder */
  dist: string;
  /** The site's origin, e.g. https://u.github.io */
  origin: string;
  /** The base path, e.g. / or /hangfolio */
  base: string;
  urlFormat: 'preserve' | 'directory';
  /** How file names start in messages; `dist` by default */
  label?: string;
};

/** An issue, plus for E602 the missing path under the base (/writing/x/), for tests and tools. */
export type VerifyIssue = Issue & { target?: string };

export type VerifyResult = {
  issues: VerifyIssue[];
  pages: number;
  xml: number;
  css: number;
  /** Internal links and assets checked */
  links: number;
  bytes: number;
};

const MB = 1024 * 1024;
const FILE_LIMIT = 50 * MB;
const SITE_LIMIT = 900 * MB;
const LOCAL_HOSTS = /^(?:localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/i;

type Page = { file: string; scan: Scan; at: (offset: number) => { line: number; col: number } };
// Where a reference sits: its file and the address the browser resolves it against (none for
// 404.html, which GitHub serves at any missing address).
type From = { file: string; url?: URL; at: (offset: number) => { line: number; col: number } };
// How strict to be with an absolute address on the site's own origin.
type Kind = 'link' | 'self' | 'asset';

export function verifyDist(options: VerifyOptions): VerifyResult {
  const { dist, urlFormat } = options;
  const label = (options.label ?? 'dist').replace(/\/+$/, '');
  const prefix = options.base.replace(/\/+$/, '');
  const home = new URL(`${prefix}/`, options.origin);
  const origin = home.origin;
  const issues: VerifyIssue[] = [];
  let links = 0;

  const files = listFiles(dist);
  const fileSet = new Set(files);
  const dirs = new Set(files.flatMap((file) => file.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))));
  const read = (file: string) => readFileSync(join(dist, file), 'utf8');
  const shown = (file: string) => `${label}/${file}`;
  const add = (code: Issue['code'], from: { file: string; at?: From['at'] }, offset: number | undefined, message: string, target?: string) =>
    issues.push({ code, file: shown(from.file), ...(from.at && offset !== undefined ? from.at(offset) : {}), message, ...(target ? { target } : {}) });

  // Sizes (W603).
  let bytes = 0;
  for (const file of files) {
    const size = statSync(join(dist, file)).size;
    bytes += size;
    if (size > FILE_LIMIT) add('W603', { file }, undefined, `This file is ${Math.round(size / MB)} MB. GitHub Pages works best with files under 50 MB; put it somewhere else and link to it.`);
  }
  if (bytes > SITE_LIMIT) issues.push({ code: 'W603', file: label, message: `The built site is ${Math.round(bytes / MB)} MB. A GitHub Pages site can be at most 1 GB, so move large files elsewhere.` });

  /** The address GitHub Pages serves a file at. */
  const servedAt = (file: string) => {
    if (file === 'index.html' || file.endsWith('/index.html')) return `${prefix}/${file.slice(0, -'index.html'.length)}`;
    if (file.endsWith('.html')) return `${prefix}/${file.slice(0, -'.html'.length)}`;
    return `${prefix}/${file}`;
  };
  const pageFiles = files.filter((file) => file.endsWith('.html'));
  const pages = new Map<string, Page>(
    pageFiles.map((file) => {
      const text = read(file);
      return [file, { file, scan: scanHtml(text), at: locator(text) }];
    }),
  );
  const known = files.map(servedAt);

  /** The file GitHub Pages serves for a path under the base ('' or starting with /), if any. */
  function lookup(rest: string): string | undefined {
    const path = rest.replace(/^\/+/, '');
    if (path === '' || path.endsWith('/')) return fileSet.has(`${path}index.html`) ? `${path}index.html` : undefined;
    for (const candidate of [path, `${path}.html`, `${path}/index.html`]) if (fileSet.has(candidate)) return candidate;
    return undefined;
  }

  const under = (pathname: string) => prefix === '' || pathname === prefix || pathname.startsWith(`${prefix}/`);

  /** Why a path under the base doesn't resolve, and what probably works. */
  function hint(pathname: string, rest: string): string {
    if (rest.endsWith('/') && rest.length > 1 && fileSet.has(`${rest.slice(1, -1)}.html`)) {
      const page = `${pathname.slice(0, -1)}`;
      return `GitHub Pages serves ${rest.slice(1, -1)}.html at ${page}, without the final slash${urlFormat === 'preserve' ? " (advanced.urlFormat is 'preserve')" : ''}; link to ${page}.`;
    }
    if (prefix && rest.startsWith(`${prefix}/`) && lookup(rest.slice(prefix.length))) return `It has the base path twice; link to ${rest}.`;
    const lower = known.find((path) => path.toLowerCase() === pathname.toLowerCase());
    if (lower) return `Did you mean ${lower}? Addresses are case-sensitive on GitHub Pages.`;
    const close = didYouMean(pathname, known);
    if (close) return `Did you mean ${close}?`;
    const first = rest.split('/').filter(Boolean)[0];
    if (prefix === '' && first && !dirs.has(first) && !fileSet.has(first) && !lookup(`/${first}`)) {
      return `Nothing in the site starts with /${first}. If it's another site at this address, link to it with its full address (${new URL(rest, origin).href}).`;
    }
    return 'Check the spelling, or whether that page is turned off.';
  }

  /** Checks a fragment against the ids of the page it points to (W610). */
  function checkFragment(ref: Ref, from: From, target: string, hash: string) {
    const fragment = safeDecode(hash.slice(1));
    if (fragment === '' || fragment.toLowerCase() === 'top' || fragment.startsWith(':~:')) return;
    const page = pages.get(target);
    if (!page || page.scan.anchors.has(fragment)) return;
    const close = didYouMean(fragment, page.scan.anchors);
    const where = target === from.file ? 'this page' : servedAt(target);
    add('W610', from, ref.offset, `${describe(ref)} ${ref.url}${quoted(ref)}, but ${where} has no element with id "${fragment}".${close ? ` Did you mean #${close}?` : ''}`);
  }

  /** Checks one reference found in `from`. */
  function check(ref: Ref, from: From, kind: Kind = ref.tag === 'a' || ref.tag === 'area' ? 'link' : 'asset', fragments = true) {
    const raw = ref.url;
    if (raw === '') return;
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) return; // mailto:, tel:, data: …
    const written = /^(?:https?:)?\/\//i.test(raw) ? 'absolute' : 'relative';

    if (raw.startsWith('//')) {
      const host = raw.slice(2).split(/[/?#]/)[0];
      if (!/[.:]/.test(host) && !LOCAL_HOSTS.test(host)) {
        add('E607', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, which starts with //, so browsers read "${host}" as the name of another server. Use ${url(`/${raw.replace(/^\/+/, '')}`)}.`);
        return;
      }
    }
    if (raw.startsWith('#')) {
      if (fragments && from.file.endsWith('.html')) checkFragment(ref, from, from.file, raw);
      return;
    }
    if (!from.url && written === 'relative' && !raw.startsWith('/') && !raw.startsWith('?')) {
      add('E606', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, a relative address. GitHub Pages shows 404.html for every missing address, so it must start with the base path: ${url(`/${raw}`)}.`);
      return;
    }

    let target: URL;
    try {
      target = new URL(raw, from.url ?? home);
    } catch {
      add('E602', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, which is not a valid address.`);
      return;
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return;
    if (target.origin !== origin) {
      if (LOCAL_HOSTS.test(target.hostname) && !LOCAL_HOSTS.test(home.hostname)) {
        add('E608', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, an address on this computer, but the site is built for ${home.href}. Build it again with the same settings as the published site.`);
      } else if (kind === 'self') {
        add('E608', from, ref.offset, `${describe(ref)} ${raw}, but this site is built for ${home.href}, so search engines would list the wrong address. Build again with the address the site is published at (site.yaml url, or the GitHub Pages address).`);
      }
      return; // another site; links are not fetched
    }
    links++;
    const pathname = target.pathname;
    if (pathname.includes('//')) {
      add('E607', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, which has // in its path. Use ${pathname.replace(/\/{2,}/g, '/')}${target.search}${target.hash}.`);
      return;
    }
    if (!under(pathname)) {
      if (written === 'absolute') {
        if (kind === 'self') add('E608', from, ref.offset, `${describe(ref)} ${raw}, which is outside this site (${home.href}), so search engines would list the wrong address.`);
        return; // another site on the same domain, such as a user site linked from a project site
      }
      const fixed = `${prefix}${pathname}`;
      const exists = lookup(pathname) ? ` (${fixed} exists)` : '';
      add('E606', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, which leaves this site: it is served under ${prefix}/, so on GitHub Pages this opens another site or a 404. Use ${fixed}${exists}; in site.yaml and Markdown, write ${pathname} and the base is added for you.`);
      return;
    }
    const rest = safeDecode(pathname.slice(prefix.length)) || '/';
    const file = lookup(rest);
    if (!file) {
      // An absolute link at a user site's root may go to one of the owner's project sites.
      const first = rest.split('/').filter(Boolean)[0];
      if (written === 'absolute' && kind === 'link' && prefix === '' && first && !dirs.has(first) && !fileSet.has(first)) return;
      const what = kind === 'asset' ? `is not a file in this site` : `is not a page or file in this site`;
      add('E602', from, ref.offset, `${describe(ref)} ${raw}${quoted(ref)}, which ${what}. ${hint(pathname, rest)}`, rest);
      return;
    }
    if (fragments && target.hash && file.endsWith('.html')) checkFragment(ref, from, file, target.hash);
  }

  /** url() for messages: a site path with the base in front. */
  const url = (path: string) => `${prefix}${path}`;

  // Pages: links, assets, ids, canonical and own addresses.
  for (const page of pages.values()) {
    const { file, scan } = page;
    const is404 = file === '404.html';
    let pageUrl = is404 ? undefined : new URL(servedAt(file), origin);
    if (scan.base) {
      try {
        pageUrl = new URL(scan.base, pageUrl ?? home);
      } catch {
        // an unusable <base> is ignored by browsers too
      }
    }
    const from: From = { file, url: pageUrl, at: page.at };
    const self = new Set<Ref>([...(scan.canonical ? [scan.canonical] : []), ...scan.selfUrls]);
    for (const ref of self) {
      if (!/^https?:\/\//i.test(ref.url)) {
        add('E608', from, ref.offset, `${describe(ref)} ${ref.url}, which is not a full address. It must start with ${home.href}.`);
      }
    }
    for (const ref of scan.refs) {
      if (self.has(ref) && !/^https?:\/\//i.test(ref.url)) continue;
      check(ref, from, self.has(ref) ? 'self' : undefined, !self.has(ref));
    }
    // JSON-LD ids such as …/#person name things, not places on the page, so fragments are not checked.
    for (const ref of scan.jsonLd) check(ref, from, ref.attr === '@id' || ref.attr === 'url' ? 'link' : 'asset', false);

    const seen = new Map<string, number[]>();
    for (const { id, offset } of scan.ids) seen.set(id, [...(seen.get(id) ?? []), offset]);
    for (const [id, offsets] of seen) {
      if (offsets.length < 2) continue;
      const first = page.at(offsets[0]);
      add('E609', from, offsets[1], `The id "${id}" is used ${offsets.length} times on this page (first at line ${first.line}, column ${first.col}). Each id must be unique, so that links to #${id} and screen readers find the right element.`);
    }
  }

  // Manifests linked from pages.
  const manifests = new Set<string>();
  for (const page of pages.values()) {
    const ref = page.scan.manifest;
    if (!ref || page.file === '404.html') continue;
    let target: URL;
    try {
      target = new URL(ref.url, new URL(servedAt(page.file), origin));
    } catch {
      continue;
    }
    const file = target.origin === origin && under(target.pathname) ? lookup(safeDecode(target.pathname.slice(prefix.length))) : undefined;
    if (!file || manifests.has(file)) continue;
    manifests.add(file);
    const text = read(file);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const from: From = { file, url: new URL(servedAt(file), origin), at: locator(text) };
    const values: string[] = [];
    for (const key of ['start_url', 'scope']) if (typeof data[key] === 'string') values.push(data[key] as string);
    for (const list of ['icons', 'screenshots', 'shortcuts']) {
      for (const item of Array.isArray(data[list]) ? data[list] : []) {
        if (typeof item?.src === 'string') values.push(item.src);
        if (typeof item?.url === 'string') values.push(item.url);
      }
    }
    for (const value of values) check({ url: value, attr: 'manifest', tag: 'manifest', offset: Math.max(0, text.indexOf(JSON.stringify(value))) }, from, 'asset');
  }

  // Stylesheets: fonts and images they load.
  const cssFiles = files.filter((file) => file.endsWith('.css'));
  for (const file of cssFiles) {
    const text = read(file);
    const from: From = { file, url: new URL(servedAt(file), origin), at: locator(text) };
    for (const ref of cssRefs(text)) check(ref, from, 'asset');
  }

  // XML: sitemaps list only this site's pages; feeds are checked where they point at this site.
  const xmlFiles = files.filter((file) => /\.(?:xml|rss|atom)$/i.test(file));
  for (const file of xmlFiles) {
    const text = read(file);
    const from: From = { file, url: new URL(servedAt(file), origin), at: locator(text) };
    const { root, refs } = scanXml(text);
    const sitemap = root === 'urlset' || root === 'sitemapindex';
    for (const ref of refs) {
      // <loc> lists the site's own pages; <image:loc> and the like may point anywhere.
      const isLoc = sitemap && ref.tag === 'loc';
      if (!/^https?:\/\//i.test(ref.url)) {
        if (isLoc) add('E608', from, ref.offset, `The sitemap lists ${ref.url}, which is not a full address. It must start with ${home.href}.`);
        continue;
      }
      check(ref, from, isLoc ? 'self' : 'link', false);
    }
  }

  // robots.txt: the sitemap it names must be this site's.
  if (fileSet.has('robots.txt')) {
    const text = read('robots.txt');
    const from: From = { file: 'robots.txt', url: home, at: locator(text) };
    for (const m of text.matchAll(/^[ \t]*sitemap[ \t]*:[ \t]*(\S+)/gim)) {
      check({ url: m[1], attr: 'Sitemap', tag: 'robots', offset: m.index + m[0].indexOf(m[1]) }, from, 'self');
    }
  }

  return { issues: sortByPlace(issues), pages: pageFiles.length, xml: xmlFiles.length, css: cssFiles.length, links, bytes };
}

/** What a reference does, to start a message: "Links to", "Loads" … */
function describe(ref: Ref): string {
  if ('element' in ref) return ref.element === 'loc' ? 'The sitemap lists' : `<${ref.tag}> points to`;
  switch (ref.attr) {
    case 'canonical':
      return 'The canonical address is';
    case 'og:url':
    case 'twitter:url':
      return `${ref.attr} is`;
    case 'Sitemap':
      return 'robots.txt names the sitemap';
    case 'http-equiv="refresh"':
      return 'Redirects to';
    case 'manifest':
      return 'The manifest points to';
    case 'url()':
    case '@import':
    case 'src':
    case 'srcset':
    case 'imagesrcset':
    case 'poster':
    case 'data':
      return 'Loads';
  }
  if (ref.tag === 'link') return 'Loads';
  if (ref.tag === 'script') return `The JSON-LD ${ref.attr} is`;
  if (ref.tag === 'meta') return `${ref.attr} is`;
  return 'Links to';
}

const quoted = (ref: Ref) => (ref.text ? ` ("${ref.text}")` : '');

function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Every file under dir, as sorted paths with forward slashes. */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

/** Line and column of an offset, by binary search over the line starts. */
function locator(text: string): (offset: number) => { line: number; col: number } {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - starts[lo] + 1 };
  };
}

function sortByPlace<T extends Issue>(issues: T[]): T[] {
  return [...issues].sort(
    (a, b) => (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0) || (a.col ?? 0) - (b.col ?? 0) || a.code.localeCompare(b.code),
  );
}
