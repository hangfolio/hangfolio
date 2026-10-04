// The plumbing check (SPEC 9, layer 4; N701).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkPlumbing, PLUMBING_FILES, PLUMBING_SCRIPTS } from '../src/schema/plumbing.ts';

const REPO = new URL('../../../', import.meta.url);
const reader = (dir: string) => (file: string) => {
  const url = new URL(`${dir}/${file}`, REPO);
  return existsSync(url) ? readFileSync(url, 'utf8') : undefined;
};
const files = (overrides: Record<string, string | undefined>) => (file: string) =>
  file in overrides ? overrides[file] : reader('starter')(file);

test("the starter's plumbing is exactly what the check expects, and the fixtures use it too", () => {
  for (const { file, text } of PLUMBING_FILES) {
    assert.equal(reader('starter')(file), text, `starter/${file}`);
  }
  assert.deepEqual(checkPlumbing(reader('starter')), []);
  assert.deepEqual(checkPlumbing(reader('fixtures/minimal')), []);
});

test('a missing, unmarked or outdated plumbing file is N701 with the replacement text', () => {
  const config = PLUMBING_FILES[0];
  const [missing] = checkPlumbing(files({ [config.file]: undefined }));
  assert.deepEqual(missing, {
    code: 'N701',
    file: 'astro.config.mjs',
    line: undefined,
    message: 'astro.config.mjs is missing. It connects your site to hangfolio; create it with the text below.',
    replacement: config.text,
  });

  const edited = checkPlumbing(files({ [config.file]: "import { defineSiteConfig } from 'hangfolio/config';\nexport default defineSiteConfig({ x: 1 });\n" }));
  assert.equal(edited.length, 1);
  assert.equal(edited[0].line, 1);
  assert.match(edited[0].message, /has no hangfolio-plumbing line/);

  const old = checkPlumbing(files({ 'src/content.config.ts': '\n// Do not edit.  hangfolio-plumbing: 0\nexport {};\n' }));
  assert.equal(old[0].file, 'src/content.config.ts');
  assert.equal(old[0].line, 2);
  assert.match(old[0].message, /plumbing version 0; this hangfolio needs version 1/);

  const newer = checkPlumbing(files({ [config.file]: config.text.replace('plumbing: 1', 'plumbing: 2') }));
  assert.match(newer[0].message, /version 2, which needs a newer hangfolio/);
});

test('package.json scripts are plumbing too', () => {
  const pkg = JSON.stringify({ name: 'site', scripts: { ...PLUMBING_SCRIPTS, build: 'astro build', lint: 'x' } }, null, 2);
  const [notice] = checkPlumbing(files({ 'package.json': pkg }));
  assert.equal(notice.file, 'package.json');
  assert.equal(notice.line, 3);
  assert.equal(notice.message, 'package.json needs these scripts for hangfolio to run: "build": "hangfolio build". Replace the "scripts" block with the text below.');
  assert.match(notice.replacement, /^"scripts": \{\n {4}"dev": "hangfolio dev",/);
  assert.deepEqual(checkPlumbing(files({ 'package.json': '{ not json' })), []);
});
