// The publications content as pages read it from the content collections (src/content.ts): the
// BibTeX entries, the extras files by key, and the in-preparation items. Example mode has
// already taken out what it hides.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { BibEntry } from './bib.ts';
import type { InPrep } from './bib-page.ts';
import type { Extras } from './citation.ts';

export type ExtrasEntry = CollectionEntry<'publications'> & { data: Extras };
export type PrepEntry = CollectionEntry<'publications'> & { data: InPrep };

export async function publicationsContent() {
  const entries = (await getCollection('bib')).map((entry) => entry.data as BibEntry);
  const files = await getCollection('publications');
  const extras = new Map<string, ExtrasEntry>();
  const prep: PrepEntry[] = [];
  for (const file of files) {
    if (file.data.status === 'in-preparation') prep.push(file as PrepEntry);
    else extras.set(file.id, file as ExtrasEntry);
  }
  return { entries, extras, prep, extrasData: new Map([...extras].map(([key, file]) => [key, file.data])) };
}
