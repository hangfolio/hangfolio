// How content reaches the pages: the loader for one YAML file (content/news.yaml and friends),
// site.yaml read through its schema for defineSiteConfig(), and example entries left out.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import type { LoaderContext } from 'astro/loaders';
import { readSiteConfig } from '../src/lib/read-site.ts';
import { yamlFile } from '../src/lib/yaml-file.ts';
import { news } from '../src/schema/news.ts';

const root = mkdtempSync(join(tmpdir(), 'hangfolio-loader-'));
after(() => rmSync(root, { recursive: true, force: true }));

/** Just enough of Astro's loader context: a map for the store and a watcher we can fire. */
function context() {
  const entries = new Map<string, { id: string; data: unknown; filePath?: string }>();
  const listeners: Record<string, ((path: string) => void)[]> = {};
  const ctx = {
    config: { root: pathToFileURL(`${root}/`) },
    store: { clear: () => entries.clear(), set: (entry: { id: string; data: unknown }) => entries.set(entry.id, entry) },
    parseData: async ({ data }: { data: unknown }) => news.parse(data),
    generateDigest: (text: string) => String(text.length),
    logger: { error: (message: string) => assert.fail(message) },
    watcher: { add: () => {}, on: (event: string, fn: (path: string) => void) => (listeners[event] ??= []).push(fn) },
  };
  const fire = async (event: string, path: string) => {
    for (const fn of listeners[event] ?? []) fn(path);
    await new Promise((resolve) => setTimeout(resolve, 20));
  };
  return { ctx: ctx as unknown as LoaderContext, entries, fire };
}

test('one YAML file is one entry named after it, parsed with its schema', async () => {
  const file = join(root, 'content-news.yaml');
  writeFileSync(file, '# news\nitems:\n  - { date: 2026-08, text: "Released Tidepool 1.0." }\n');
  const { ctx, entries } = context();
  await yamlFile('content-news.yaml').load(ctx);
  assert.deepEqual([...entries.keys()], ['content-news']);
  assert.deepEqual(entries.get('content-news')?.data, { items: [{ date: '2026-08', text: 'Released Tidepool 1.0.', example: false }] });
});

test('a missing file is an empty collection, and an empty file gets the defaults', async () => {
  const missing = context();
  await yamlFile('nothing-here.yaml').load(missing.ctx);
  assert.equal(missing.entries.size, 0);

  writeFileSync(join(root, 'empty.yaml'), '# only a comment\n');
  const empty = context();
  await yamlFile('empty.yaml').load(empty.ctx);
  assert.deepEqual(empty.entries.get('empty')?.data, { items: [] });
});

test('in dev, the entry follows the file being created, edited and deleted', async () => {
  const file = join(root, 'live.yaml');
  const { ctx, entries, fire } = context();
  await yamlFile('live.yaml').load(ctx);
  assert.equal(entries.size, 0);
  writeFileSync(file, 'items: []\n');
  await fire('add', file);
  assert.deepEqual(entries.get('live')?.data, { items: [] });
  writeFileSync(file, 'items:\n  - { date: 2026-09, text: "New." }\n');
  await fire('change', join(root, 'other.yaml'));
  assert.deepEqual(entries.get('live')?.data, { items: [] });
  await fire('change', file);
  assert.equal((entries.get('live')?.data as { items: unknown[] }).items.length, 1);
  unlinkSync(file);
  await fire('unlink', file);
  assert.equal(entries.size, 0);
});

test('a YAML syntax error names the file', async () => {
  writeFileSync(join(root, 'broken.yaml'), 'items:\n  - { date: 2026-08, text: "x" \n');
  await assert.rejects(yamlFile('broken.yaml').load(context().ctx), /^Error: broken\.yaml: /);
});

test('site.yaml is parsed with the site schema for the Astro config; a file with mistakes gives a placeholder', () => {
  const file = join(root, 'site.yaml');
  writeFileSync(file, 'name: "Wren Halloway"\nemail: "wren@halloway.test"\nlinks: ["https://github.com/someone"]\n');
  const { site, valid } = readSiteConfig(file);
  assert.equal(valid, true);
  assert.deepEqual(site.links.map((link) => link.label), ['GitHub']);
  assert.equal(site.advanced.timezone, 'UTC');

  // The checks report these with file:line; the config only needs settings it can use.
  for (const text of ['name: "Wren Halloway"\nemail: "wren"\ncard: {}\n', 'tagline: a: b\n']) {
    writeFileSync(file, text);
    const placeholder = readSiteConfig(file);
    assert.equal(placeholder.valid, false);
    assert.equal(placeholder.site.advanced.urlFormat, 'preserve');
  }
  assert.equal(readSiteConfig(join(root, 'nope', 'site.yaml')).valid, false);
});

test('outside demo mode a YAML file loses its example entries; in demo mode it keeps them', async () => {
  const site = join(root, 'site.yaml');
  writeFileSync(join(root, 'items.yaml'), 'items:\n  - { date: 2026-08, text: "Mine." }\n  - { date: 2026-07, text: "Example.", example: true }\n');
  const hide = (data: Record<string, unknown>) => ({ ...data, items: (data.items as { example?: boolean }[]).filter((item) => !item.example) });

  writeFileSync(site, 'name: "Wren Halloway"\nemail: "wren@halloway.test"\n');
  const owner = context();
  await yamlFile('items.yaml', hide).load(owner.ctx);
  assert.deepEqual((owner.entries.get('items')?.data as { items: unknown[] }).items.length, 1);

  writeFileSync(site, 'name: "Rowan Vale"\nemail: "rowan@example.edu"\n');
  const demo = context();
  await yamlFile('items.yaml', hide).load(demo.ctx);
  assert.deepEqual((demo.entries.get('items')?.data as { items: unknown[] }).items.length, 2);
});
