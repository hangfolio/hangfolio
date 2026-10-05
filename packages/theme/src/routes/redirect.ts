// A redirect from site.yaml `redirects` (SPEC 5.3). The theme injects this endpoint once for each
// redirect, at exactly the file its `from` names (lib/paths.ts redirectFile), so `about.html` and
// `about/index.html` are written as they are (S2). The page refreshes to the base-aware target,
// names it as canonical, and is never indexed.
import type { APIRoute } from 'astro';
import { site } from 'virtual:hangfolio/site';
import { escapeHtml } from '../lib/inline-md.ts';
import { redirectFile } from '../lib/paths.ts';
import { absUrl, url } from '../lib/url.ts';

export const GET: APIRoute = ({ routePattern }) => {
  const entry = site.redirects.find(({ from }) => redirectFile(from, site.advanced.urlFormat) === routePattern);
  if (!entry) return new Response(null, { status: 404 });
  const href = escapeHtml(url(entry.to));
  const target = escapeHtml(absUrl(entry.to));
  return new Response(
    `<!doctype html><html lang="${escapeHtml(site.advanced.lang)}"><head><meta charset="utf-8"><title>Redirecting…</title>` +
      `<link rel="canonical" href="${target}"><meta name="robots" content="noindex">` +
      `<meta http-equiv="refresh" content="0; url=${href}"></head>` +
      `<body><p>This page has moved to <a href="${href}">${target}</a>.</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
};
