// defineSiteConfig(): the whole Astro config for a hangfolio site, built from site.yaml and the
// environment. A site's astro.config.mjs calls it and does nothing else (SPEC 4.2).
import { resolve } from 'node:path';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import hangfolio from './integration.ts';
import { baseLinks } from './lib/base-links.ts';
import { readSiteConfig } from './lib/read-site.ts';
import { resolveSiteUrl } from './lib/site-url.ts';

export function defineSiteConfig() {
  const root = process.cwd();
  const siteFile = resolve(root, 'site.yaml');
  // Read on every call, so the dev restart that a site.yaml edit triggers sees the new file. Its
  // mistakes are reported by the integration's checks, with file:line.
  const { site } = readSiteConfig(siteFile);
  const { origin, base, warning } = resolveSiteUrl(site.url, process.env);
  if (warning) console.warn(`[hangfolio] ${warning}`);
  const urlFormat = site.advanced.urlFormat;

  return defineConfig({
    site: origin,
    base,
    trailingSlash: site.advanced.trailingSlash,
    build: { format: urlFormat },
    markdown: {
      // Sätteri is Astro 7's processor for Markdown and MDX; {#id} after a heading pins its id (S1).
      processor: satteri({ features: { headingAttributes: true }, hastPlugins: [baseLinks(base)] }),
      shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: false },
    },
    integrations: [mdx(), hangfolio({ root, site, siteFile, urlFormat })],
    devToolbar: { enabled: false },
  });
}
