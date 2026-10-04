// content/publications/<key>.md(x) front matter (SPEC 5.6). A file named after a BibTeX key adds
// extras to that entry. A file with `status: in-preparation` is a paper with no BibTeX yet.
import { z } from 'zod';
import { author, bool, htmlId, link, md, text } from './common.ts';

const extras = z.strictObject({
  status: z.literal('published').optional(),
  example: bool(false).describe('While true, these extras are the example and stay hidden on your site.'),
  featured: bool(false).describe('Feature the paper on the home page (or set selected = {true} in BibTeX).'),
  links: z.array(link).default([]).describe('Added after the links from BibTeX.'),
  equal: z.array(text).default([]).describe('Surnames of the authors who contributed equally (marked *).'),
  authorNote: text.default('*Equal contribution'),
  anchor: htmlId.optional().describe('The entry\'s #id. Default: the BibTeX key.'),
  bibtexAnchor: htmlId.optional().describe('The BibTeX block\'s #id. Default: bibtex-<anchor>.'),
  venueDetail: text.optional(),
  place: text.optional().describe('For example "Lisbon, May 13–17, 2024".'),
  data: z.strictObject({ tag: text.default('Data'), text: md }).optional(),
  schema: z.record(z.string(), z.unknown()).optional().describe('JSON-LD fields that replace the generated ones.'),
});

const inPreparation = z.strictObject({
  status: z.literal('in-preparation'),
  example: bool(false).describe('While true, this item is the example and stays hidden on your site.'),
  order: z.int(),
  title: text,
  authors: z.array(author).optional().describe('Names, or { name, url }.'),
  margin: text.optional().describe('Margin text, e.g. "Go · Java".'),
  chip: text.optional().describe('For example "Venue 2027 · in preparation".'),
  text: md,
});

export const publication = z.discriminatedUnion('status', [inPreparation, extras]);

export type Publication = z.output<typeof publication>;
