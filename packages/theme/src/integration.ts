// The hangfolio Astro integration: injects every page, gives pages the site settings as
// virtual:hangfolio/site, restarts dev when site.yaml changes, and fixes output file names.
import { existsSync } from 'node:fs';
import type { AstroIntegration } from 'astro';
import { relocateDirRoutes } from './lib/relocate.ts';
import { ROUTES } from './lib/routes.ts';
import type { SiteYaml } from './lib/site.ts';

type Options = { site: SiteYaml; siteFile: string; urlFormat: 'preserve' | 'directory' };

const VIRTUAL_ID = 'virtual:hangfolio/site';

// Icons the head links to when the file exists at the root of public/.
const ICONS = [
  { file: 'favicon.ico', rel: 'icon', sizes: 'any' },
  { file: 'favicon.svg', rel: 'icon', type: 'image/svg+xml' },
  { file: 'apple-touch-icon.png', rel: 'apple-touch-icon' },
];

export default function hangfolio({ site, siteFile, urlFormat }: Options): AstroIntegration {
  let publicDir: URL;
  return {
    name: 'hangfolio',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, addWatchFile, updateConfig }) => {
        addWatchFile(siteFile);
        for (const { pattern, entry } of ROUTES) {
          injectRoute({ pattern, entrypoint: `hangfolio/routes/${entry}` });
        }
        const icons = ICONS.filter((icon) => existsSync(new URL(icon.file, config.publicDir)));
        const source =
          `export const site = ${JSON.stringify(site)};\n` +
          `export const build = ${JSON.stringify({ urlFormat, icons })};\n`;
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'hangfolio:site',
                resolveId: (id: string) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : undefined),
                load: (id: string) => (id === '\0' + VIRTUAL_ID ? source : undefined),
              },
            ],
          },
        });
      },
      'astro:config:done': ({ config }) => {
        publicDir = config.publicDir;
      },
      'astro:build:done': async ({ assets, dir, logger }) => {
        if (urlFormat !== 'preserve') return;
        const patterns = ROUTES.filter((route) => route.dir).map((route) => route.pattern);
        await relocateDirRoutes({ patterns, assets, dir, publicDir, logger });
      },
    },
  };
}
