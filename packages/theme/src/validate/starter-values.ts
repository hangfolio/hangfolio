// Builds starter-values.json from starter/ (SPEC 5.2): the identity that means demo mode, the
// site.yaml values example mode compares, and the hash of each example entry. The theme build and
// the starter release (M9) run it through scripts/starter-values.mjs.
import { ENTRY_KINDS, type StarterValues } from '../lib/starter-values.ts';
import type { Site } from '../schema/site.ts';
import { scanBib } from './bib-keys.ts';
import { loadContent, loadSite, readBib } from './content-files.ts';
import { exampleEntries } from './entries.ts';
import { plainLines } from './format.ts';

export function buildStarterValues(dir: string): StarterValues & { $comment: string } {
  const { loaded, issues } = loadSite(dir);
  const content = loadContent(dir);
  const problems = [...issues, ...content.issues];
  if (!loaded?.data || problems.length > 0) throw new Error(`The starter has problems:\n${plainLines(problems)}`);
  const site = loaded.data as Site;
  const bibText = readBib(dir);
  const bib = bibText && { file: bibText.file, entries: scanBib(bibText.text) };

  const entries = Object.fromEntries(ENTRY_KINDS.map((kind) => [kind, [] as string[]])) as StarterValues['entries'];
  for (const entry of exampleEntries(content.loaded, bib)) entries[entry.kind].push(entry.hash);
  for (const kind of ENTRY_KINDS) entries[kind] = [...new Set(entries[kind])].sort();

  return {
    $comment: 'Generated from starter/ by scripts/starter-values.mjs. Do not edit.',
    identity: { name: site.name, email: site.email },
    site: {
      tagline: site.tagline,
      role: site.role,
      affiliation: site.affiliation,
      email: site.email,
      location: site.location,
      links: site.links.map((link) => link.url),
      availability: site.availability && { headline: site.availability.headline },
      booking: site.booking && { calcom: site.booking.calcom, link: site.booking.link },
      seo: site.seo,
    },
    entries,
  };
}

export const starterValuesText = (dir: string) => `${JSON.stringify(buildStarterValues(dir), null, 2)}\n`;
