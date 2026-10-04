// The one rule for links (SPEC 7.2): every internal href and src goes through url(), and every
// absolute URL (canonical, og:*, JSON-LD, sitemap, feed) goes through absUrl().

// A scheme (https:, mailto:, tel:, data: …), a protocol-relative //host, or a #fragment.
const PASS_THROUGH = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

/**
 * Turns a site-relative path into a path under the base, joining segment by segment so the
 * result never contains `//`. `url('/projects')` is `/projects` at base `/` and
 * `/hangfolio/projects` at base `/hangfolio`. Absolute URLs, mailto:, tel:, #fragments and
 * protocol-relative URLs are returned unchanged.
 */
export function url(path: string, base: string = import.meta.env.BASE_URL): string {
  if (PASS_THROUGH.test(path)) return path;
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const suffix = cut === -1 ? '' : path.slice(cut);
  const segments = [...base.split('/'), ...pathname.split('/')].filter(Boolean);
  const trailingSlash = segments.length > 0 && (pathname === '' || pathname.endsWith('/'));
  return '/' + segments.join('/') + (trailingSlash ? '/' : '') + suffix;
}

/**
 * The absolute form of url(path) on the site's origin. A #fragment resolves against the site's
 * home page, so `absUrl('#person')` is `https://u.github.io/hangfolio/#person`.
 */
export function absUrl(
  path: string,
  site: string = import.meta.env.SITE,
  base: string = import.meta.env.BASE_URL,
): string {
  return new URL(url(path, base), new URL(url('/', base), site)).href;
}
