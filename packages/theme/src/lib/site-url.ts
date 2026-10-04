// Works out Astro's `site` (the origin) and `base` from the first source that applies (SPEC 7.1).
// Nobody types a URL: on GitHub, build.yml passes the Pages URL in SITE_PAGES_URL.

export type SiteUrl = {
  origin: string;
  base: string;
  source: 'site.yaml' | 'SITE_PAGES_URL' | 'GITHUB_REPOSITORY' | 'local';
  warning?: string;
};

type Env = Record<string, string | undefined>;

export function resolveSiteUrl(pinned: unknown, env: Env): SiteUrl {
  const pages = env.SITE_PAGES_URL?.trim() || undefined;
  if (typeof pinned === 'string' && pinned.trim()) {
    const result = parse(pinned.trim(), 'site.yaml', 'site.yaml url');
    if (pages) {
      const actual = parse(pages, 'SITE_PAGES_URL', 'SITE_PAGES_URL');
      if (actual.origin !== result.origin || actual.base !== result.base) {
        result.warning =
          `site.yaml says ${pinned.trim()} but GitHub Pages serves ${pages}; using site.yaml. ` +
          'Add the domain in Settings → Pages or remove `url`.';
      }
    }
    return result;
  }
  if (pages) return parse(pages, 'SITE_PAGES_URL', 'SITE_PAGES_URL');

  // A validation build on GitHub before Pages is set up: derive the URL from the repository name.
  const [owner, repo] = env.GITHUB_ACTIONS === 'true' ? (env.GITHUB_REPOSITORY ?? '').split('/') : [];
  if (owner && repo) {
    const host = `${owner.toLowerCase()}.github.io`;
    return { origin: `https://${host}`, base: repo.toLowerCase() === host ? '/' : `/${repo}`, source: 'GITHUB_REPOSITORY' };
  }
  return { origin: 'http://localhost:4321', base: '/', source: 'local' };
}

function parse(value: string, source: SiteUrl['source'], what: string): SiteUrl {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`hangfolio: ${what} must be an absolute URL such as https://example.com, not "${value}".`);
  }
  const base = '/' + parsed.pathname.split('/').filter(Boolean).join('/');
  return { origin: parsed.origin, base, source };
}
