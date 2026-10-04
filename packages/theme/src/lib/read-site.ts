// Reads site.yaml for defineSiteConfig(), which needs a few settings before Astro starts (url,
// advanced.urlFormat and trailingSlash). Mistakes are the validator's job: the integration runs it
// next and reports each one with file:line (src/validate/). So a file with problems gives the
// settings of a placeholder site here instead of an error without a line number.
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { site as siteSchema } from '../schema/site.ts';
import type { SiteYaml } from './site.ts';

const PLACEHOLDER = { name: 'Your name', email: 'you@example.invalid' };

export function readSiteConfig(file: string): { site: SiteYaml; valid: boolean } {
  if (existsSync(file)) {
    try {
      const result = siteSchema.safeParse(parse(readFileSync(file, 'utf8')));
      if (result.success) return { site: result.data, valid: true };
    } catch {
      // a YAML syntax error; the validator reports it
    }
  }
  return { site: siteSchema.parse(PLACEHOLDER), valid: false };
}
