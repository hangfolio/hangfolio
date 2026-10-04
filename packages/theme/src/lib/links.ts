// site.yaml `links`: each one a bare URL or {url, label?, id?, hero?, contact?, footer?} (SPEC 5.3).
// TODO(M2): the site schema normalises these with validation; the shell uses this until then.

export type Link = { url: string; label: string; id: string; hero: boolean; contact: boolean; footer: boolean };

const HOST_LABELS: Record<string, string> = {
  'github.com': 'GitHub',
  'scholar.google.com': 'Google Scholar',
  'orcid.org': 'ORCID',
  'linkedin.com': 'LinkedIn',
  'x.com': 'X',
  'twitter.com': 'X',
  'bsky.app': 'Bluesky',
};

/** The label for a bare URL: a known site's name, otherwise the host. */
export function inferLabel(href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    return HOST_LABELS[host] ?? host;
  } catch {
    return href;
  }
}

export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeLinks(raw: unknown): Link[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const entry = typeof item === 'string' ? { url: item } : item;
    if (!entry || typeof entry.url !== 'string') return [];
    const label = entry.label ?? inferLabel(entry.url);
    return [{
      url: entry.url,
      label,
      id: entry.id ?? slug(label),
      hero: entry.hero ?? true,
      contact: entry.contact ?? true,
      footer: entry.footer ?? true,
    }];
  });
}
