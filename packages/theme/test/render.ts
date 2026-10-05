// Renders the theme's .astro components to HTML in Node, for render tests: a Vite server in
// middleware mode compiles them, Astro's container API renders them, and a stand-in
// virtual:hangfolio/site supplies the site settings that components read.
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { site as siteSchema, type SiteInput } from '../src/schema/site.ts';
import { parseOk } from './helpers.ts';

const VIRTUAL_ID = 'virtual:hangfolio/site';

// The Vite that Astro itself uses, so the two never differ.
const { createServer } = (await import(pathToFileURL(createRequire(import.meta.resolve('astro/package.json')).resolve('vite')).href)) as typeof import('vite');

type Options = { site: Partial<SiteInput>; base?: string; demo?: boolean };

/** A renderer for one site.yaml (name and email filled in) at one base path. Call close() when done. */
export async function createRenderer({ site, base = '/', demo = false }: Options) {
  const parsed = parseOk(siteSchema, { name: 'Wren Halloway', email: 'wren@halloway.test', ...site });
  const values = { site: parsed, demo, build: { urlFormat: 'preserve', head: { icons: [], manifest: '/manifest.webmanifest', manifestIcons: [], sitemap: '/sitemap.xml' }, version: '0.0.0' }, banner: { text: '' }, help: '' };
  const source = Object.entries(values).map(([name, value]) => `export const ${name} = ${JSON.stringify(value)};\n`).join('');
  // Vite resolves the components' style modules against the root, so the root is this package;
  // only Vite's cache goes to a temporary folder.
  const root = fileURLToPath(new URL('..', import.meta.url));
  const cache = mkdtempSync(join(tmpdir(), 'hangfolio-render-'));
  const plugin = {
    name: 'hangfolio-test-site',
    resolveId: (id: string) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : undefined),
    load: (id: string) => (id === '\0' + VIRTUAL_ID ? source : undefined),
  };
  // `site` gives absUrl() an origin (canonical links, JSON-LD) in layouts rendered here.
  const astro = { root, base, site: 'https://u.github.io', devToolbar: { enabled: false }, logLevel: 'silent' } as Parameters<typeof getViteConfig>[1];
  const config = await getViteConfig({ plugins: [plugin], cacheDir: cache }, astro)({ mode: 'test', command: 'serve' });
  const server = await createServer({
    ...config,
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  const container = await AstroContainer.create();

  return {
    site: parsed,
    /** The HTML of src/components/<name>.astro, without Astro's scoping attributes. */
    async render(name: string, props: Record<string, unknown> = {}, slots?: Record<string, string>): Promise<string> {
      const file = fileURLToPath(new URL(`../src/components/${name}.astro`, import.meta.url));
      const component = (await server.ssrLoadModule(file)).default;
      const html = await container.renderToString(component, { props, slots });
      return html.replace(/ data-astro-cid-\w+/g, '');
    },
    async close() {
      await server.close();
      rmSync(cache, { recursive: true, force: true });
    },
  };
}
