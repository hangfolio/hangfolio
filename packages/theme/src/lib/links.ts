// Helpers for link labels and ids. The site schema (src/schema/) normalises site.yaml `links`
// with them: a bare URL gets its label from the host, and an id from the label (SPEC 5.1).

const HOST_LABELS: Record<string, string> = {
  'github.com': 'GitHub',
  'scholar.google.com': 'Google Scholar',
  'orcid.org': 'ORCID',
  'linkedin.com': 'LinkedIn',
  'x.com': 'X',
  'twitter.com': 'X',
  'bsky.app': 'Bluesky',
};

/** The label for a bare URL: a known site's name, Email or Phone, otherwise the host. */
export function inferLabel(href: string): string {
  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'mailto:') return 'Email';
    if (parsed.protocol === 'tel:') return 'Phone';
    const host = parsed.hostname.replace(/^www\./, '');
    return HOST_LABELS[host] ?? (host || href);
  } catch {
    return href;
  }
}

/** Lowercase letters and digits joined by dashes: "Google Scholar" becomes google-scholar. */
export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
