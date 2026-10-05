// The hangfolio Astro integration: checks site.yaml and content/ before every build and dev
// session, injects every page, gives pages the site settings as virtual:hangfolio/site, restarts
// dev when site.yaml changes, and tidies the output (file names, example files).
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import { exampleBanner } from './lib/banner.ts';
import { currentDevState, markDevStateStale, setDevState } from './lib/dev-checks.ts';
import { hasPublicationContent } from './lib/bib-file.ts';
import { relocateDirRoutes } from './lib/relocate.ts';
import { pageRoutes, publicationsRoute, ROUTES, type Route } from './lib/routes.ts';
import type { SiteYaml } from './lib/site.ts';
import { terminalReport, wantsColor } from './validate/format.ts';
import { counts, docsUrl, severity, validateSite, type Report } from './validate/index.ts';

type Options = { root: string; site: SiteYaml; siteFile: string; urlFormat: 'preserve' | 'directory' };

const VIRTUAL_ID = 'virtual:hangfolio/site';

// Icons the head links to when the file exists at the root of public/.
const ICONS = [
  { file: 'favicon.ico', rel: 'icon', sizes: 'any' },
  { file: 'favicon.svg', rel: 'icon', type: 'image/svg+xml' },
  { file: 'apple-touch-icon.png', rel: 'apple-touch-icon' },
];

export default function hangfolio({ root, site, siteFile, urlFormat }: Options): AstroIntegration {
  let publicDir: URL;
  let report: Report | undefined;
  let routes: Route[] = [];
  const print = (r: Report) => process.stdout.write(`\n${terminalReport(r, { color: wantsColor(process.stdout, process.env) })}\n`);

  return {
    name: 'hangfolio',
    hooks: {
      'astro:config:setup': async ({ command, config, injectRoute, addWatchFile, updateConfig }) => {
        addWatchFile(siteFile);
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
        // The pages follow the site as it shows (an example booking block that is hidden adds no /meet).
        // The publications page exists only with something on it; in dev it is always there.
        const visible = report?.visible ?? site;
        const inPublic = (file: string) => existsSync(new URL(file, config.publicDir));
        const papers = command === 'dev' || hasPublicationContent(root, report?.demo ?? false);
        routes = [...ROUTES, ...pageRoutes(visible, inPublic), ...publicationsRoute(visible, papers)];
        for (const { pattern, entry } of routes) {
          injectRoute({ pattern, entrypoint: `hangfolio/routes/${entry}` });
        }
        const icons = ICONS.filter((icon) => inPublic(icon.file));
        const values = {
          site: report?.visible ?? site,
          build: { urlFormat, icons },
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
            // Every MDX post makes the bundler warn about a directive Astro adds itself
            // ("use astro:head-inject"); it is harmless, and a site owner can do nothing about it.
            build: {
              rolldownOptions: {
                onLog(level: string, log: { code?: string; message: string }, handler: (level: string, log: unknown) => void) {
                  if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('astro:head-inject')) return;
                  handler(level, log);
                },
              },
            },
          },
        });
      },
      'astro:config:done': ({ config }) => {
        publicDir = config.publicDir;
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
        if (urlFormat !== 'preserve') return;
        const patterns = routes.filter((route) => route.dir).map((route) => route.pattern);
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
