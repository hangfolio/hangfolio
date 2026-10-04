// The starter's example values (SPEC 5.2), from starter-values.json. scripts/starter-values.mjs
// writes that file from starter/ (src/validate/starter-values.ts), and a test fails when it is stale.
// Demo mode is keyed on name and email together: a real "Rowan Vale" who changes the email leaves it.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

export const ENTRY_KINDS = ['home', 'projects', 'publications', 'writing', 'experience', 'news', 'bib'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export type StarterValues = {
  identity: { name: string; email: string };
  /** The starter's site.yaml values that example mode compares, after the site schema */
  site: {
    tagline?: string;
    role?: string;
    affiliation?: { name: string; url?: string };
    email?: string;
    location?: string;
    links: string[];
    availability?: { headline: string };
    booking?: { calcom?: string; link?: string };
    seo?: Record<string, unknown>;
  };
  /** Hashes of the example entries, by kind (src/validate/entries.ts) */
  entries: Record<EntryKind, string[]>;
};

export const STARTER_VALUES_FILE = new URL('../../starter-values.json', import.meta.url);

let cached: StarterValues | undefined;

export function starterValues(): StarterValues {
  cached ??= JSON.parse(readFileSync(STARTER_VALUES_FILE, 'utf8')) as StarterValues;
  return cached;
}

/** True when name and email both still equal the starter's. */
export function isDemoIdentity(name: unknown, email: unknown, values: StarterValues = starterValues()): boolean {
  if (typeof name !== 'string' || typeof email !== 'string') return false;
  return name.trim() === values.identity.name && email.trim().toLowerCase() === values.identity.email.toLowerCase();
}

/** Demo mode for the site at `root`, from its site.yaml alone (the content loaders use this). */
export function isDemoSite(root: string | URL): boolean {
  const dir = typeof root === 'string' ? pathToFileURL(root.endsWith('/') ? root : `${root}/`) : root;
  const file = new URL('site.yaml', dir);
  if (!existsSync(file)) return false;
  try {
    const data = parse(readFileSync(file, 'utf8')) as Record<string, unknown> | null;
    return isDemoIdentity(data?.name, data?.email);
  } catch {
    return false;
  }
}
