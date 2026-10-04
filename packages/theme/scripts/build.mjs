// Build step for the published package. Later milestones generate schema/*.json and
// starter-values.json here; for now it only checks that everything the package publishes exists.
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
// Wildcard exports ("./src/components/*") are checked as their folder.
const exportTargets = Object.values(pkg.exports).map((target) => target.replace(/\*$/, ''));
const missing = [...pkg.files, ...Object.values(pkg.bin), ...exportTargets].filter((path) => !existsSync(new URL(path, root)));

if (missing.length > 0) {
  console.error(`${pkg.name} build: missing ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`${pkg.name}@${pkg.version} build: ok (nothing to generate yet)`);
