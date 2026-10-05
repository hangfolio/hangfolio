// The hangfolio Astro integration: checks site.yaml and content/ before every build and dev
// session, injects every page, gives pages the site settings as virtual:hangfolio/site, restarts
// dev when site.yaml changes, and tidies the output (file names, example files).
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import { exampleBanner } from './lib/banner.ts';
import { currentDevState, markDevStateStale, setDevState } from './lib/dev-checks.ts';
import { planSeo, type SeoPlan } from './lib/endpoints.ts';
import { buildSha } from './lib/head.ts';
import { relocateDirRoutes } from './lib/relocate.ts';
import { ROUTES } from './lib/routes.ts';
import type { SiteYaml } from './lib/site.ts';
import { writeSitemaps } from './lib/sitemap.ts';
import { absUrl } from './lib/url.ts';
import { terminalReport, wantsColor } from './validate/format.ts';
import { counts, docsUrl, severity, validateSite, type Report } from './validate/index.ts';

type Options = { root: string; site: SiteYaml; siteFile: string; urlFormat: 'preserve' | 'directory' };

const VIRTUAL_ID = 'virtual:hangfolio/site';

const THEME_VERSION: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export default function hangfolio({ root, site, siteFile, urlFormat }: Options): AstroIntegration {
  let publicDir: URL;
  let siteUrl = { origin: '', base: '/', home: '' };
  let seo: SeoPlan | undefined;
  let report: Report | undefined;
  const print = (r: Report) => process.stdout.write(`\n${terminalReport(r, { color: wantsColor(process.stdout, process.env) })}\n`);

  return {
    name: 'hangfolio',
    hooks: {
      'astro:config:setup': async ({ command, config, injectRoute, addWatchFile, updateConfig }) => {
        addWatchFile(siteFile);
        for (const { pattern, entry } of ROUTES) {
          injectRoute({ pattern, entrypoint: `hangfolio/routes/${entry}` });
        }
        if (command !== 'preview') {
          report = await validateSite(root, { mode: command === 'dev' ? 'dev' : 'build' });
          print(report);
          const { errors } = counts(report.issues);
          if (errors > 0 && command === 'build') {
            const what = errors === 1 ? 'an error' : `${errors} errors`;
            const error = new AstroError(`hangfolio check found ${what} in site.yaml or content/ (listed above), so nothing was built.`, 'Fix the lines it names and build again.');
            error.stack = ''; // the list above says where; a stack trace into the theme would not help
            throw error;
          }
          if (command === 'dev') {
            const refresh = async () => {
              const next = await validateSite(root, { mode: 'dev' });
              if (signature(next) !== signature(report)) print(next);
              report = next;
              return devStateOf(next);
            };
            setDevState(devStateOf(report), refresh);
          }
        }
        // Feed, robots.txt, manifest and verification file; a file in public/ wins (lib/endpoints.ts).
        const visible = report?.visible ?? site;
        seo = planSeo({ root, site: visible, demo: report?.demo ?? false, base: config.base, publicDir: config.publicDir });
        for (const { pattern, entry } of seo.routes) injectRoute({ pattern, entrypoint: `hangfolio/routes/${entry}` });
        const values = {
          site: visible,
          build: { urlFormat, head: seo.head, version: THEME_VERSION, sha: buildSha(root) },
          demo: report?.demo ?? false,
          banner: exampleBanner(process.env),
          help: docsUrl(),
        };
        const source = Object.entries(values).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};\n`).join('');
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
        const origin = config.site ?? 'http://localhost:4321';
        siteUrl = { origin, base: config.base, home: absUrl('/', origin, config.base) };
      },
      // In dev, a change under content/ or public/ runs the checks again before the next page
      // render, and reloads the page if the result changed. A site.yaml change restarts dev.
      'astro:server:setup': ({ server }) => {
        const watched = [`${root}${sep}content${sep}`, `${root}${sep}public${sep}`];
        let timer: ReturnType<typeof setTimeout> | undefined;
        server.watcher.on('all', (_event: string, path: string) => {
          if (!watched.some((dir) => path.startsWith(dir))) return;
          markDevStateStale();
          clearTimeout(timer);
          timer = setTimeout(async () => {
            const before = signature(report);
            await currentDevState();
            if (signature(report) !== before) server.ws.send({ type: 'full-reload', path: '*' });
          }, 150);
        });
      },
      'astro:build:done': async ({ assets, dir, logger }) => {
        // Example files leave the build once site.yaml is the owner's (SPEC 5.2 rule 4).
        if (report && !report.demo) await rm(fileURLToPath(new URL('example/', dir)), { recursive: true, force: true });
        if (seo) {
          // The theme's pages, in their usual order, follow the home page in the sitemap.
          const visible = report?.visible ?? site;
          const { origin, base, home } = siteUrl;
          const order = Object.values(visible.pages).flatMap((page) => (page && 'path' in page && page.path ? [absUrl(page.path, origin, base)] : []));
          const count = await writeSitemaps(fileURLToPath(dir), seo.sitemaps, home, order);
          if (seo.sitemaps.length > 0) logger.info(`${seo.sitemaps.map((path) => path.slice(1)).join(', ')}: ${count} pages`);
        }
        if (urlFormat !== 'preserve') return;
        const patterns = ROUTES.filter((route) => route.dir).map((route) => route.pattern);
        await relocateDirRoutes({ patterns, assets, dir, publicDir, logger });
      },
    },
  };
}

function devStateOf(report: Report) {
  const errors = report.issues.filter((issue) => severity(issue.code) === 'error');
  return { root: report.root, errors, others: report.issues.filter((issue) => severity(issue.code) !== 'error') };
}

const signature = (report?: Report) => JSON.stringify(report?.issues ?? null);
