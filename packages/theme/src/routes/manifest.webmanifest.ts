// The web manifest, with its colours from the design tokens (SPEC 6.1). Injected only when
// public/ has no manifest of its own (lib/endpoints.ts).
import type { APIRoute } from 'astro';
import { build, site } from 'virtual:hangfolio/site';
import tokensCss from '../styles/tokens.css?raw';
import { webManifest } from '../lib/site-files.ts';
import { parseTokens } from '../lib/tokens.ts';
import { absUrl, url } from '../lib/url.ts';

export const GET: APIRoute = () => {
  const { light } = parseTokens(tokensCss);
  const body = webManifest(site, {
    abs: (path) => absUrl(path),
    url: (path) => url(path),
    icons: build.head.manifestIcons,
    colors: { bg: light.bg, accent: light.accent },
  });
  return new Response(body, { headers: { 'Content-Type': 'application/manifest+json' } });
};
