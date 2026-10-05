// A small scanner for the HTML, XML and CSS that `hangfolio verify` reads (SPEC 7.2). It finds
// every URL a page loads or links to, every id, and the canonical and JSON-LD addresses, each with
// its offset in the file. Built pages are machine-written, so a tokenizer is enough: comments,
// <script>, <style> and the other raw-text elements are skipped as a browser would skip them.

export type Ref = {
  /** The value as written, entities decoded */
  url: string;
  /** href, src, srcset, content, url() … */
  attr: string;
  tag: string;
  offset: number;
  /** For <a>: the start of its text, to help find the link in the content */
  text?: string;
};

export type Scan = {
  refs: Ref[];
  /** id attributes outside <template> */
  ids: { id: string; offset: number }[];
  /** Fragment targets: ids plus <a name> */
  anchors: Set<string>;
  canonical?: Ref;
  /** og:url and other meta tags whose content is this page's own address */
  selfUrls: Ref[];
  /** URLs found in JSON-LD blocks */
  jsonLd: Ref[];
  /** <base href> */
  base?: string;
  /** The <link rel="manifest"> target */
  manifest?: Ref;
};

// Attributes whose value is one URL: on any element, or only on the elements listed.
const URL_ATTRS = new Map<string, Set<string> | undefined>([
  ['href', undefined],
  ['xlink:href', undefined],
  ['src', undefined],
  ['poster', undefined],
  ['data', new Set(['object'])],
  ['action', new Set(['form'])],
  ['formaction', new Set(['button', 'input'])],
  // Astro islands load their component and renderer from these.
  ['component-url', new Set(['astro-island'])],
  ['renderer-url', new Set(['astro-island'])],
  ['before-hydration-url', new Set(['astro-island'])],
]);
// <meta> whose content is a URL: the first two must be the page's own address.
const SELF_META = new Set(['og:url', 'twitter:url']);
const URL_META = new Set(['og:image', 'og:image:url', 'og:image:secure_url', 'og:video', 'og:audio', 'twitter:image', 'twitter:image:src', 'msapplication-tileimage']);
// Elements whose content is text, not markup.
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'noembed', 'noframes']);
// JSON-LD keys whose string values are addresses.
const JSONLD_URL_KEYS = new Set(['@id', 'url', 'image', 'logo', 'contentUrl', 'thumbnailUrl', 'mainEntityOfPage', 'item', 'target']);

const ATTR = /\s*([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
const TAG = /<([a-zA-Z][^\s/>]*)/y;

export function scanHtml(html: string): Scan {
  const scan: Scan = { refs: [], ids: [], anchors: new Set(), selfUrls: [], jsonLd: [] };
  let templates = 0;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      i = after(html, '-->', lt + 4);
      continue;
    }
    if (html.startsWith('<![CDATA[', lt)) {
      i = after(html, ']]>', lt + 9);
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      i = after(html, '>', lt + 2);
      continue;
    }
    if (html[lt + 1] === '/') {
      const end = /^<\/([a-zA-Z][^\s/>]*)/.exec(html.slice(lt, lt + 40));
      if (end?.[1].toLowerCase() === 'template') templates = Math.max(0, templates - 1);
      i = after(html, '>', lt + 2);
      continue;
    }
    TAG.lastIndex = lt;
    const open = TAG.exec(html);
    if (!open) {
      i = lt + 1;
      continue;
    }
    const tag = open[1].toLowerCase();
    const { attrs, end } = readAttrs(html, TAG.lastIndex);
    i = end;
    if (tag === 'template') templates++;
    tagAttrs(scan, tag, attrs, html, end, templates > 0);

    if (RAW_TEXT.has(tag)) {
      const close = indexOfCI(html, `</${tag}`, end);
      const body = html.slice(end, close === -1 ? html.length : close);
      if (tag === 'style') scan.refs.push(...cssRefs(body, end, 'style'));
      if (tag === 'script' && attrs.get('type')?.value.toLowerCase() === 'application/ld+json') scan.jsonLd.push(...jsonLdRefs(body, end));
      i = close === -1 ? html.length : close;
    }
  }
  return scan;
}

type Attr = { value: string; offset: number };

function readAttrs(html: string, from: number): { attrs: Map<string, Attr>; end: number } {
  const attrs = new Map<string, Attr>();
  let i = from;
  while (i < html.length) {
    while (i < html.length && /\s|\//.test(html[i])) i++;
    if (html[i] === '>') return { attrs, end: i + 1 };
    ATTR.lastIndex = i;
    const m = ATTR.exec(html);
    if (!m || m[0].length === 0) {
      i++;
      continue;
    }
    const name = m[1].toLowerCase();
    const raw = m[2] ?? m[3] ?? m[4] ?? '';
    if (!attrs.has(name)) attrs.set(name, { value: decodeEntities(raw), offset: i + m[0].indexOf(m[1]) });
    i = ATTR.lastIndex;
  }
  return { attrs, end: html.length };
}

function tagAttrs(scan: Scan, tag: string, attrs: Map<string, Attr>, html: string, end: number, inTemplate: boolean) {
  const push = (name: string, attr: Attr, extra: Partial<Ref> = {}) => {
    const ref: Ref = { url: attr.value.trim(), attr: name, tag, offset: attr.offset, ...extra };
    scan.refs.push(ref);
    return ref;
  };
  const id = attrs.get('id');
  if (id && id.value !== '') {
    scan.anchors.add(id.value);
    if (!inTemplate) scan.ids.push({ id: id.value, offset: id.offset });
  }
  if (tag === 'a' && attrs.get('name')?.value) scan.anchors.add(attrs.get('name')!.value);
  if (tag === 'base') {
    if (attrs.get('href')) scan.base = attrs.get('href')!.value.trim();
    return;
  }
  const rel = (attrs.get('rel')?.value ?? '').toLowerCase().split(/\s+/);
  for (const [name, attr] of attrs) {
    if (URL_ATTRS.has(name) && (URL_ATTRS.get(name)?.has(tag) ?? true)) {
      // An empty action submits to the page itself; an empty href or src is a mistake but harmless here.
      if (attr.value.trim() === '') continue;
      const canonical = tag === 'link' && name === 'href' && rel.includes('canonical');
      const ref = push(canonical ? 'canonical' : name, attr, tag === 'a' ? { text: linkText(html, end) } : {});
      if (canonical) scan.canonical = ref;
      if (tag === 'link' && name === 'href' && rel.includes('manifest')) scan.manifest = ref;
    } else if (name === 'srcset' || name === 'imagesrcset') {
      for (const candidate of srcsetUrls(attr.value)) scan.refs.push({ url: candidate, attr: name, tag, offset: attr.offset });
    } else if (name === 'style') {
      scan.refs.push(...cssRefs(attr.value, attr.offset, 'style').map((ref) => ({ ...ref, offset: attr.offset, tag })));
    }
  }
  if (tag === 'meta') {
    const key = (attrs.get('property') ?? attrs.get('name'))?.value.toLowerCase() ?? '';
    const content = attrs.get('content');
    if (content && SELF_META.has(key)) scan.selfUrls.push(push(key, content));
    else if (content && URL_META.has(key)) push(key, content);
    const refresh = attrs.get('http-equiv')?.value.toLowerCase() === 'refresh' && content && /^\s*\d*\.?\d*\s*[;,]\s*url\s*=\s*['"]?([^'"]+)/i.exec(content.value);
    if (refresh && content) scan.refs.push({ url: refresh[1].trim(), attr: 'http-equiv="refresh"', tag, offset: content.offset });
  }
}

/** The first words of a link's text, tags removed. */
function linkText(html: string, from: number): string | undefined {
  const close = indexOfCI(html, '</a', from);
  if (close === -1) return undefined;
  const text = decodeEntities(html.slice(from, Math.min(close, from + 2000)).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/** The URLs of a srcset: comma-separated candidates, each a URL and optional descriptors. */
export function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) i++;
    let url = value.slice(start, i);
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      // Skip the descriptors (1x, 480w …) up to the comma that ends the candidate.
      let depth = 0;
      for (; i < value.length && !(value[i] === ',' && depth <= 0); i++) depth += value[i] === '(' ? 1 : value[i] === ')' ? -1 : 0;
    }
    if (url) urls.push(url);
  }
  return urls;
}

/** url(…) and @import in CSS, with comments removed. Offsets point into the CSS. */
export function cssRefs(css: string, offset = 0, tag = 'css'): Ref[] {
  const refs: Ref[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length));
  for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) {
    refs.push({ url: m[1] ?? m[2] ?? m[3] ?? '', attr: 'url()', tag, offset: offset + m.index });
  }
  for (const m of text.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
    refs.push({ url: m[1] ?? m[2] ?? '', attr: '@import', tag, offset: offset + m.index });
  }
  return refs.filter((ref) => ref.url !== '');
}

/** Address-like strings in a JSON-LD block. A block that isn't JSON gives none. */
function jsonLdRefs(text: string, offset: number): Ref[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const refs: Ref[] = [];
  const walk = (value: unknown, key: string) => {
    if (typeof value === 'string') {
      if (JSONLD_URL_KEYS.has(key) && /^https?:\/\//i.test(value)) refs.push({ url: value, attr: key, tag: 'script', offset: offset + Math.max(0, text.indexOf(JSON.stringify(value).slice(1, -1))) });
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, key);
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(data, '');
  return refs;
}

export type XmlRef = Ref & { element: string };

/**
 * Address-like values in an XML file (sitemaps, feeds): the text of <loc>, <link>, <guid> (unless
 * isPermaLink="false"), <url> and <icon>/<logo>, and href, url and src attributes.
 */
export function scanXml(xml: string): { root?: string; refs: XmlRef[] } {
  const refs: XmlRef[] = [];
  let root: string | undefined;
  const textElements = new Set(['loc', 'link', 'guid', 'url', 'icon', 'logo']);
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!?][^>]*>|<\/[^>]*>|<([A-Za-z_][\w.:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  for (const m of xml.matchAll(re)) {
    if (!m[1]) continue;
    const name = m[1];
    const local = name.replace(/^.*:/, '').toLowerCase();
    root ??= local;
    const attrs = new Map<string, Attr>();
    for (const a of (m[2] ?? '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs.set(a[1].toLowerCase(), { value: decodeEntities(a[2] ?? a[3] ?? ''), offset: m.index + 1 + name.length + a.index });
    }
    for (const key of ['href', 'url', 'src']) {
      const attr = attrs.get(key);
      if (attr?.value) refs.push({ url: attr.value.trim(), attr: key, tag: name, element: local, offset: attr.offset });
    }
    if (m[3] || !textElements.has(local)) continue;
    if (local === 'guid' && attrs.get('ispermalink')?.value === 'false') continue;
    const start = m.index + m[0].length;
    const close = xml.indexOf('<', start);
    let text = xml.slice(start, close === -1 ? xml.length : close);
    if (xml.startsWith('<![CDATA[', close)) text = xml.slice(close + 9, xml.indexOf(']]>', close));
    text = decodeEntities(text).trim();
    if (text) refs.push({ url: text, attr: 'text', tag: name, element: local, offset: start });
  }
  return { root, refs };
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/** 1-based line and column of an offset. */
export function position(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let start = 0;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) {
    line++;
    start = i + 1;
  }
  return { line, col: offset - start + 1 };
}

function after(text: string, needle: string, from: number): number {
  const at = text.indexOf(needle, from);
  return at === -1 ? text.length : at + needle.length;
}

function indexOfCI(text: string, needle: string, from: number): number {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  re.lastIndex = from;
  return re.exec(text)?.index ?? -1;
}
