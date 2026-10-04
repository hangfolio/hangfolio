// content/home.yaml (SPEC 5.4). Optional: without it, the home page is built from the other content.
import { z } from 'zod';
import { bool, headingLink, md, text } from './common.ts';
import { partialDate } from './dates.ts';
import { noRepeats } from './issues.ts';

/** The home sections, in their default order. */
export const SECTIONS = ['highlights', 'work', 'research', 'experience', 'education', 'news', 'writing', 'contact'] as const;

const highlight = z.strictObject({
  value: text.describe('The number, e.g. "up to 40%" or "3s → 300ms".'),
  what: text,
  source: md.optional(),
  asOf: partialDate().optional().describe('When the number was measured; a warning after 180 days.'),
});

const research = z.strictObject({
  heading: text.optional(),
  problem: md.optional(),
  approach: z.array(z.strictObject({ title: text, chip: text.optional(), text: md })).default([]),
  status: md.optional(),
  featured: text.optional().describe('A publication key from content/publications.bib.'),
  teaching: md.optional(),
  link: headingLink.optional(),
});

const count = (value: number) => z.int().min(0).default(value);

export const home = z.strictObject({
  example: bool(false).describe('While true, this file is the example and stays hidden on your site.'),
  intro: md.optional().describe('The paragraph under your tagline.'),
  now: md.optional().describe('The "Now:" line.'),
  highlights: z
    .strictObject({
      heading: text.default('Results at a glance'),
      items: z.array(highlight).min(1, 'needs at least 1 item').max(4, 'can have at most 4 items'),
    })
    .optional(),
  research: research.optional(),
  sections: z
    .array(z.enum(SECTIONS))
    .check(noRepeats)
    .default([...SECTIONS])
    .describe('The sections in order; leave one out to hide it.'),
  counts: z.strictObject({ experience: count(5), news: count(4), writing: count(2) }).prefault({}),
  headings: z
    .strictObject({
      work: text.default('Selected work'),
      experience: text.default('Experience'),
      education: text.default('Education'),
      news: text.default('News'),
      writing: text.default('Writing'),
      contact: text.default('Get in touch'),
    })
    .prefault({}),
});

export type Home = z.output<typeof home>;
