// The JSON Schemas in schema/ (SPEC 5.1): generated from the zod schemas, published with the
// package, and named by the starter's yaml-language-server line.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { jsonSchema, jsonSchemaFiles, SCHEMA_URL } from '../src/schema/json.ts';

const THEME = new URL('../', import.meta.url);
const REPO = new URL('../../', THEME);
const pkg = JSON.parse(readFileSync(new URL('package.json', THEME), 'utf8'));

test('schema/ matches the zod schemas (run `npm run build` to update it)', () => {
  const expected = jsonSchemaFiles();
  assert.deepEqual(readdirSync(new URL('schema/', THEME)).sort(), Object.keys(expected).sort());
  for (const [name, text] of Object.entries(expected)) {
    assert.equal(readFileSync(new URL(`schema/${name}`, THEME), 'utf8'), text, `schema/${name} is stale`);
  }
});

test("the starter's site.yaml points at the published site schema", () => {
  const firstLine = readFileSync(new URL('starter/site.yaml', REPO), 'utf8').split('\n')[0];
  assert.equal(firstLine, `# yaml-language-server: $schema=${SCHEMA_URL}site.json`);
  assert.ok(SCHEMA_URL.startsWith(`https://unpkg.com/${pkg.name}@`));
  assert.ok(pkg.files.includes('schema'));
  assert.equal(pkg.exports['./schema/*'], './schema/*');
  assert.equal(jsonSchema('site').$id, `${SCHEMA_URL}site.json`);
});

test('site.json: the editor knows the required fields, the card page and nothing else', () => {
  const site = jsonSchema('site') as { required: string[]; additionalProperties: boolean; properties: Record<string, any> };
  assert.deepEqual(site.required, ['name', 'email']);
  assert.equal(site.additionalProperties, false);
  assert.equal(site.properties.card, undefined);
  assert.ok(site.properties.pages.properties.card);
  assert.ok(site.properties.advanced.properties.nameParts);
  assert.deepEqual(site.properties.advanced.properties.urlFormat, { default: 'preserve', type: 'string', enum: ['preserve', 'directory'] });
});

test('dates show their written forms, and no schema carries zod noise', () => {
  const site = jsonSchema('site') as { properties: Record<string, any> };
  assert.deepEqual(site.properties.availability.properties.until.anyOf, [
    { type: 'string', pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$' },
    { type: 'integer', minimum: 1000, maximum: 9999 },
  ]);
  for (const [name, text] of Object.entries(jsonSchemaFiles())) {
    assert.doesNotMatch(text, /9007199254740991/, name);
  }
});
