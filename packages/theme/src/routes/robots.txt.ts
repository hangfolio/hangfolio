// robots.txt with the absolute sitemap URLs. Injected only at base /, because crawlers read it at
// the host root only, and only when public/ has no robots.txt (lib/endpoints.ts).
import type { APIRoute } from 'astro';
import { site } from 'virtual:hangfolio/site';
import { robotsTxt } from '../lib/site-files.ts';
import { absUrl } from '../lib/url.ts';

export const GET: APIRoute = () => new Response(robotsTxt(site, (path) => absUrl(path)), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
