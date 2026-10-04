// Build step for the published package: writes the JSON Schemas (schema/*.json) and
// starter-values.json, then checks that everything the package publishes exists.
import { existsSync, readFileSync } from 'node:fs';
import { writeSchemas } from './schema.mjs';
import { writeStarterValues } from './starter-values.mjs';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

const schemas = writeSchemas();
writeStarterValues();

// Wildcard exports ("./src/components/*") are checked as their folder.
const exportTargets = Object.values(pkg.exports).map((target) => target.replace(/\*$/, ''));
const missing = [...pkg.files, ...Object.values(pkg.bin), ...exportTargets].filter((path) => !existsSync(new URL(path, root)));

if (missing.length > 0) {
  console.error(`${pkg.name} build: missing ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`${pkg.name}@${pkg.version} build: ok (${schemas.length} JSON Schemas in schema/, starter-values.json)`);
