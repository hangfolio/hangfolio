// Writes starter-values.json from starter/ (SPEC 5.2): the example values and entry hashes that
// example mode compares a site against. The build runs it; so does the starter release (M9).
// Run it by hand with `npm run starter-values -w packages/theme`. A test fails when it is stale.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STARTER_VALUES_FILE } from '../src/lib/starter-values.ts';
import { starterValuesText } from '../src/validate/starter-values.ts';

export const STARTER_DIR = fileURLToPath(new URL('../../../starter/', import.meta.url));

export function writeStarterValues() {
  writeFileSync(STARTER_VALUES_FILE, starterValuesText(STARTER_DIR));
  return fileURLToPath(STARTER_VALUES_FILE);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`wrote ${writeStarterValues()}`);
}
