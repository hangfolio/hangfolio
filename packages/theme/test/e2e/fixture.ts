// Builds a fixture with the hangfolio command, and serves a dist/ folder the way GitHub Pages
// does: under its base path, `/x` finds `x.html` or `x/index.html`, and misses get 404.html.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const BIN = fileURLToPath(new URL('../../bin/hangfolio.mjs', import.meta.url));

/** Runs `hangfolio build` in fixtures/<name> with SITE_PAGES_URL set; returns the dist path. */
export function buildFixture(name: string, pagesUrl: string): string {
  return buildSite(join('fixtures', name), pagesUrl);
}

/** Runs `hangfolio build` in a site folder given relative to the repo (e.g. `starter`). */
export function buildSite(dir: string, pagesUrl: string): string {
  const cwd = join(REPO, dir);
  const result = spawnSync(process.execPath, [BIN, 'build'], {
    cwd,
    env: { ...process.env, SITE_PAGES_URL: pagesUrl },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`hangfolio build failed in ${cwd}:\n${result.stdout}\n${result.stderr}`);
  return join(cwd, 'dist');
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

/** Serves dist at http://127.0.0.1:<port><base>. Returns the site's home URL and a close function. */
export async function serve(dist: string, base: string) {
  const prefix = base.replace(/\/+$/, '');
  const isFile = (path: string) => existsSync(path) && statSync(path).isFile();
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const rest = pathname.startsWith(prefix + '/') ? pathname.slice(prefix.length) : pathname === prefix ? '/' : null;
    const candidates = rest === null ? [] : [join(dist, rest), join(dist, rest + '.html'), join(dist, rest, 'index.html')];
    const file = candidates.find(isFile);
    res.writeHead(file ? 200 : 404, { 'Content-Type': TYPES[extname(file ?? '.html')] ?? 'application/octet-stream' });
    res.end(readFileSync(file ?? join(dist, '404.html')));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { home: `http://127.0.0.1:${port}${prefix}/`, close: () => new Promise((resolve) => server.close(resolve)) };
}
