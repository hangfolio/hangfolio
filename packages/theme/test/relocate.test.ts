// S2: under build.format 'preserve', directory-shaped pages move from <path>.html to
// <path>/index.html after the build, and a same-named file from public/ always wins.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { relocateDirRoutes } from '../src/lib/relocate.ts';
import { listFiles } from './helpers.ts';

function setup(distFiles: string[], publicFiles: string[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'hangfolio-relocate-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  for (const file of distFiles) write(join(root, 'dist', file), `generated ${file}`);
  for (const file of publicFiles) write(join(root, 'public', file), `public ${file}`);
  return root;
}

async function run(root: string, assets: Record<string, string[]>) {
  const logs: string[] = [];
  const logger = { info: (m: string) => logs.push(m), warn: (m: string) => logs.push(`warn: ${m}`) };
  await relocateDirRoutes({
    patterns: ['/writing', '/writing/[slug]'],
    assets: new Map(Object.entries(assets).map(([p, files]) => [p, files.map((f) => pathToFileURL(join(root, 'dist', f)))])),
    dir: pathToFileURL(join(root, 'dist') + '/'),
    publicDir: pathToFileURL(join(root, 'public') + '/'),
    logger,
  });
  return logs;
}

test('directory-shaped pages move to <path>/index.html; others stay', async () => {
  const root = setup(['index.html', 'projects.html', 'writing.html', 'writing/x.html', 'writing/y.html']);
  await run(root, { '/writing': ['writing.html'], '/writing/[slug]': ['writing/x.html', 'writing/y.html'], '/projects': ['projects.html'] });
  assert.deepEqual(listFiles(join(root, 'dist')), ['index.html', 'projects.html', 'writing/index.html', 'writing/x/index.html', 'writing/y/index.html']);
  assert.equal(readFileSync(join(root, 'dist/writing/x/index.html'), 'utf8'), 'generated writing/x.html');
});

test('a page already named index.html is left alone', async () => {
  const root = setup(['writing/index.html']);
  await run(root, { '/writing': ['writing/index.html'] });
  assert.deepEqual(listFiles(join(root, 'dist')), ['writing/index.html']);
});

test('public/<path>/index.html wins: the generated page is dropped', async () => {
  const root = setup(['writing.html', 'writing/index.html'], ['writing/index.html']);
  // dist/writing/index.html stands for the copy Astro made of the public file.
  writeFileSync(join(root, 'dist/writing/index.html'), 'public writing/index.html');
  const logs = await run(root, { '/writing': ['writing.html'] });
  assert.deepEqual(listFiles(join(root, 'dist')), ['writing/index.html']);
  assert.equal(readFileSync(join(root, 'dist/writing/index.html'), 'utf8'), 'public writing/index.html');
  assert.match(logs.join('\n'), /warn: kept public\/writing\/index\.html/);
});

test('public/<path>.html wins: Astro skipped the page, so nothing moves', async () => {
  const root = setup(['writing.html'], ['writing.html']);
  writeFileSync(join(root, 'dist/writing.html'), 'public writing.html');
  await run(root, { '/writing': ['writing.html'] });
  assert.deepEqual(listFiles(join(root, 'dist')), ['writing.html']);
  assert.equal(readFileSync(join(root, 'dist/writing.html'), 'utf8'), 'public writing.html');
});
