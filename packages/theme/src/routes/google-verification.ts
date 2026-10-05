// Google Search Console's HTML verification file, from advanced.googleVerification.file. Injected
// at /<token>.html unless public/ already has that file (lib/endpoints.ts).
import type { APIRoute } from 'astro';
import { site } from 'virtual:hangfolio/site';
import { verificationFile } from '../lib/head.ts';
import { verificationBody } from '../lib/site-files.ts';

export const GET: APIRoute = () => {
  const file = verificationFile(site.advanced.googleVerification!.file!).slice(1);
  return new Response(verificationBody(file), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
