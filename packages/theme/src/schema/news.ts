// content/news.yaml (SPEC 5.8): newest first.
import { z } from 'zod';
import { bool, md } from './common.ts';
import { partialDate } from './dates.ts';

export const news = z.strictObject({
  items: z
    .array(
      z.strictObject({
        date: partialDate({ least: 'month' }),
        text: md,
        example: bool(false).describe('While true, this item is the example and stays hidden on your site.'),
      }),
    )
    .default([])
    .describe('Newest first.'),
});

export type News = z.output<typeof news>;
