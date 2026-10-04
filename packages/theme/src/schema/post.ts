// content/writing/<slug>.md(x) front matter (SPEC 5.9).
import { z } from 'zod';
import { bool, text } from './common.ts';
import { postDate } from './dates.ts';

export const post = z
  .strictObject({
    title: text,
    date: postDate.describe('For example 2026-08-14.'),
    updated: postDate.optional(),
    description: text.describe('For search results and the feed.'),
    excerpt: text.optional().describe('The teaser in post lists. Default: description.'),
    tags: z.array(text).default([]),
    draft: bool(false).describe('true: not built (the file is still public in the repository).'),
    example: bool(false).describe('While true, this post is the example and stays hidden on your site.'),
    minutes: z.int().positive().optional().describe('Pins "N min read".'),
  })
  .transform((value) => ({ ...value, excerpt: value.excerpt ?? value.description }));

export type Post = z.output<typeof post>;
