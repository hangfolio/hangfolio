// Reads site.yaml for defineSiteConfig().
// TODO(M2): replace the shape check below with the zod schema and file:line errors.
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { SiteYaml } from './site.ts';

export function readSiteYaml(file: string): SiteYaml {
  if (!existsSync(file)) {
    throw new Error(`hangfolio: no site.yaml in ${file.replace(/site\.yaml$/, '')}. Every site needs one next to package.json.`);
  }
  const data = parse(readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('hangfolio: site.yaml must be a list of "key: value" settings, starting with name: and email:.');
  }
  const missing = ['name', 'email'].filter((key) => typeof data[key] !== 'string' || !data[key].trim());
  if (missing.length > 0) throw new Error(`hangfolio: site.yaml needs ${missing.join(' and ')}.`);
  return data;
}
