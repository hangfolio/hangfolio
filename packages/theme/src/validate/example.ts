// Example mode outside demo mode (SPEC 5.2): required site.yaml values still equal to the
// starter's are errors (E401); optional ones are hidden (W402); example entries are hidden (W403);
// and example files under /example/ are hidden, with the avatar becoming a monogram (W404).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findAvatar } from '../lib/avatar.ts';
import type { Site } from '../schema/site.ts';
import type { StarterValues } from '../lib/starter-values.ts';
import type { ExampleEntry } from './entries.ts';
import type { Code, Issue } from './issue.ts';
import { locate, type Source } from './source.ts';

/** What example mode takes out of site.yaml. */
export type HiddenSite = {
  location?: boolean;
  links: number[];
  availability?: boolean;
  booking?: boolean;
  seo: string[];
  assets: ('avatar' | 'ogImage' | 'cv')[];
};

const EXAMPLE_DOMAIN = /@(?:[^@]+\.)?example\.(com|net|org|edu)$/i;
const isExampleAsset = (path?: string) => typeof path === 'string' && /^\/?example\//.test(path);

export function siteExamples(site: Site, source: Source, starter: StarterValues, root: string) {
  const issues: Issue[] = [];
  const hidden: HiddenSite = { links: [], seo: [], assets: [] };
  const add = (code: Code, path: PropertyKey[], message: string) => {
    const at = locate(source, path);
    issues.push({ code, file: 'site.yaml', ...(at && { line: at.line, col: at.col, endLine: at.endLine, endCol: at.endCol }), message });
  };
  const was = starter.site;

  // Rule 1: required fields
  if (was.tagline && site.tagline === was.tagline) add('E401', ['tagline'], 'tagline is still the example text. Write your own sentence.');
  if (was.role && site.role === was.role) add('E401', ['role'], 'role is still the example text. Write your own.');
  if (was.affiliation && site.affiliation?.name === was.affiliation.name) {
    add('E401', ['affiliation'], `affiliation is still the example (${was.affiliation.name}). Write yours.`);
  } else if (was.affiliation?.url && site.affiliation?.url === was.affiliation.url) {
    add('E401', ['affiliation', 'url'], `affiliation url is still the example address (${was.affiliation.url}). Write yours, or delete it.`);
  }
  if (was.email && site.email.toLowerCase() === was.email.toLowerCase()) {
    add('E401', ['email'], `email is still the example address (${was.email}). Write yours.`);
  } else if (EXAMPLE_DOMAIN.test(site.email)) {
    const domain = EXAMPLE_DOMAIN.exec(site.email)![0].slice(1);
    add('E401', ['email'], `email uses ${domain}, a placeholder domain only the example site may use. Write your own address.`);
  }

  // Rule 2: optional values
  if (was.location && site.location === was.location) {
    hidden.location = true;
    add('W402', ['location'], `location is still the example (${was.location}), so it's hidden. Write yours or delete the line.`);
  }
  site.links.forEach((link, i) => {
    if (!was.links.includes(link.url)) return;
    hidden.links.push(i);
    add('W402', ['links', i], `This link is still the example (${link.url}), so it's hidden. Replace it with yours or delete the line.`);
  });
  if (was.availability && site.availability?.headline === was.availability.headline) {
    hidden.availability = true;
    add('W402', ['availability'], "The availability box is still the example, so it's hidden. Edit it or delete the block.");
  }
  const booking = site.booking;
  if (was.booking && booking && ((booking.calcom && booking.calcom === was.booking.calcom) || (booking.link && booking.link === was.booking.link))) {
    hidden.booking = true;
    add('W402', ['booking'], "The booking block is still the example, so it's hidden and there is no /meet page. Put in your own booking link or delete the block.");
  }
  for (const [key, value] of Object.entries(site.seo ?? {})) {
    if (value === undefined || JSON.stringify(value) !== JSON.stringify(was.seo?.[key])) continue;
    hidden.seo.push(key);
    add('W402', ['seo', key], `seo.${key} is still the example, so it's left out. Write your own or delete the line.`);
  }

  // Rule 4: example files
  const ASSET_TEXT = {
    avatar: ['the example photo', 'so your initials are shown instead. Upload your photo to public/images/ and set avatar, or delete the line.'],
    ogImage: ['the example image', "so it's left out. Point it at your own image, or delete the line."],
    cv: ['the example CV', "so it's left out. Upload yours to public/files/ and set cv, or delete the line."],
  } as const;
  // A photo uploaded as public/images/avatar.* replaces the example one (SPEC 3.2, step 6).
  const uploaded = findAvatar(root);
  for (const key of ['avatar', 'ogImage', 'cv'] as const) {
    if (!isExampleAsset(site[key])) continue;
    hidden.assets.push(key);
    const [what, rest] = ASSET_TEXT[key];
    const instead = key === 'avatar' && uploaded ? `so your photo ${uploaded} is shown instead. Delete this line.` : rest;
    add('W404', [key], `${key} is ${what} (${site[key]}), ${instead}`);
  }
  if (existsSync(join(root, 'public/example'))) {
    const message = "public/example/ holds the example files, so it's left out of your site. Delete the folder when you no longer need it.";
    issues.push({ code: 'W404', file: 'public/example', message });
  }
  return { issues, hidden };
}

/** site.yaml without what example mode hides. */
export function visibleSite(site: Site, hidden: HiddenSite): Site {
  const visible: Site = { ...site, links: site.links.filter((_, i) => !hidden.links.includes(i)) };
  if (hidden.location) delete visible.location;
  if (hidden.availability) delete visible.availability;
  if (hidden.booking) delete visible.booking;
  if (visible.seo && hidden.seo.length > 0) {
    visible.seo = Object.fromEntries(Object.entries(visible.seo).filter(([key]) => !hidden.seo.includes(key)));
  }
  for (const key of hidden.assets) delete visible[key];
  return visible;
}

const LABELS: Record<ExampleEntry['kind'], string> = {
  home: 'This home page text is',
  projects: 'This project is',
  publications: 'These publication extras are',
  writing: 'This post is',
  experience: 'This experience entry is',
  news: 'This news item is',
  bib: 'This BibTeX entry is',
};

/** Rule 3: W403 for each example entry, saying whether it was edited since the starter. */
export function entryIssues(entries: ExampleEntry[], starter: StarterValues): Issue[] {
  return entries.map((entry) => {
    const label = entry.inPreparation ? 'This in-preparation item is' : entry.kind === 'bib' ? `This BibTeX entry (${entry.key}) is` : LABELS[entry.kind];
    const marker = entry.kind === 'bib' ? 'example = {true}' : 'example: true';
    const act = entry.alone ? `Delete line ${entry.line}` : `Remove ${marker} from line ${entry.line}`;
    const edited = !starter.entries[entry.kind]?.includes(entry.hash);
    const message = edited
      ? `You edited this example, but it still says ${marker}, so it's hidden. ${act} to publish it.`
      : label.endsWith(' are')
        ? `${label} an example, so they're hidden. ${act} to publish them.`
        : `${label} an example, so it's hidden. ${act} to publish it.`;
    return { code: 'W403', file: entry.file, line: entry.line, col: entry.col, message };
  });
}
