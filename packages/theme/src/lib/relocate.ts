// Moves the pages of directory-shaped routes from <path>.html to <path>/index.html after a
// 'preserve' build (S2). A same-named file from public/ always wins (SPEC 7.2).
import { existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

type Logger = { info(message: string): void; warn(message: string): void };
type Args = { patterns: string[]; assets: Map<string, URL[]>; dir: URL; publicDir: URL; logger: Logger };

export async function relocateDirRoutes({ patterns, assets, dir, publicDir, logger }: Args) {
  const out = fileURLToPath(dir);
  const pub = fileURLToPath(publicDir);
  for (const pattern of patterns) {
    for (const file of assets.get(pattern) ?? []) {
      const from = relative(out, fileURLToPath(file));
      if (!from.endsWith('.html') || /(^|\/)index\.html$/.test(from)) continue;
      // Astro already skipped this page because public/ has the same file; what is in dist is that file.
      if (existsSync(join(pub, from))) continue;
      const to = from.replace(/\.html$/, '/index.html');
      if (existsSync(join(pub, to))) {
        await rm(join(out, from));
        logger.warn(`kept public/${to}; dropped the generated ${from}`);
        continue;
      }
      await mkdir(dirname(join(out, to)), { recursive: true });
      await rename(join(out, from), join(out, to));
      logger.info(`moved ${from} -> ${to}`);
    }
  }
}
