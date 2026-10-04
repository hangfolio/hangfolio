// Writes the JSON Schemas in schema/ from the zod schemas in src/schema/. The build runs it; run
// it by hand with `npm run schema -w packages/theme`. The test suite fails when they are stale.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jsonSchemaFiles } from '../src/schema/json.ts';

export const SCHEMA_DIR = new URL('../schema/', import.meta.url);

/** Writes every schema file and removes any that no longer exists. Returns the file names. */
export function writeSchemas() {
  const files = jsonSchemaFiles();
  mkdirSync(SCHEMA_DIR, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(new URL(name, SCHEMA_DIR), text);
  for (const name of readdirSync(SCHEMA_DIR)) {
    if (!(name in files)) rmSync(new URL(name, SCHEMA_DIR));
  }
  return Object.keys(files);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`schema/: ${writeSchemas().join(', ')}`);
}
