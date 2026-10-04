// content/experience.yaml (SPEC 5.7).
import { z } from 'zod';
import { bool, filePath, md, text } from './common.ts';
import { partialDate } from './dates.ts';
import { fail } from './issues.ts';

export const EXPERIENCE_SECTIONS = ['professional', 'research', 'teaching', 'education', 'programs', 'earlier'] as const;

const image = z.strictObject({
  thumb: filePath,
  full: filePath,
  alt: text,
  width: z.int().positive(),
  height: z.int().positive(),
});

const entry = z
  .strictObject({
    section: z.enum(EXPERIENCE_SECTIONS),
    role: text,
    org: text,
    short: text.optional().describe('A shorter organisation name for the home page.'),
    location: text.optional(),
    start: partialDate().optional(),
    end: partialDate({ present: true }).optional(),
    expected: bool(false).describe('Adds "(expected)" after the dates.'),
    when: z.array(text).optional().describe('Text instead of dates, e.g. ["Spring 2025"].'),
    bullets: z.array(md).optional(),
    desc: md.optional().describe('A paragraph instead of bullets.'),
    home: text.optional().describe('A one-line summary; shows the entry on the home page.'),
    homeLine: z.strictObject({ text, years: text }).optional().describe('Education and programs: the home page line.'),
    gallery: z.strictObject({ caption: md.optional(), images: z.array(image).min(1) }).optional(),
    example: bool(false).describe('While true, this entry is the example and stays hidden on your site.'),
  })
  .check((ctx) => {
    if (ctx.value.bullets && ctx.value.desc) fail(ctx, ctx.value, 'E202', 'needs bullets or desc, not both');
  });

export const experience = z.strictObject({
  entries: z.array(entry).default([]).describe('Shown in this order within each section.'),
});

export type Experience = z.output<typeof experience>;
