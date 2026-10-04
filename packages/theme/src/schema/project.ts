// content/projects/<id>.md(x) front matter and content/projects.yaml (SPEC 5.5).
import { z } from 'zod';
import { slug } from '../lib/links.ts';
import { bool, headingLink, htmlId, md, projectLink, text } from './common.ts';
import { partialDate } from './dates.ts';
import { exactlyOne, fail, show } from './issues.ts';

/** A terminal window: `$ ` starts a prompt, `# ` a comment, and [CRITICAL] … [LOW] get badges. */
const terminal = z.strictObject({ label: text, lines: z.array(z.string()) });

const metrics = z.strictObject({
  title: text,
  rows: z.array(z.strictObject({ label: text, before: text, after: text, highlight: bool(false) })).min(1),
  footer: md.optional(),
  footerMuted: text.optional(),
});

const bars = z.strictObject({
  label: text,
  rows: z
    .array(z.strictObject({ label: text, value: z.number().min(0), unit: text.optional(), tone: z.enum(['accent', 'faint']) }))
    .min(1),
  caption: md,
});

/** The figure beside a featured project: exactly one of terminal, metrics, bars or install. */
export const exhibit = z
  .strictObject({
    terminal: terminal.optional(),
    metrics: metrics.optional(),
    bars: bars.optional(),
    install: z.strictObject({ command: text }).optional(),
  })
  .check(exactlyOne(['terminal', 'metrics', 'bars', 'install']));

// Problem / Built / Result / Install / Data are conventions, not a list to choose from.
const fact = z
  .strictObject({
    label: text,
    text: md.optional(),
    lines: z.array(text).optional(),
    code: text.optional(),
    note: text.optional(),
    terminal: terminal.optional(),
  })
  .check((ctx) => {
    const kinds = ['text', 'lines', 'code', 'note'].filter((key) => ctx.value[key as keyof typeof ctx.value] !== undefined);
    if (kinds.length > 1) fail(ctx, ctx.value, 'E202', `needs only one of text, lines, code or note, but has ${kinds.join(' and ')}`);
    if (kinds.length === 0 && !ctx.value.terminal) fail(ctx, ctx.value, 'E202', 'needs text, lines, code, note or terminal');
  });

/** A result line: text, or {tag, parts, muted}. Always {tag, parts, muted?} after parsing. */
const result = z
  .union([md, z.strictObject({ tag: text.default('Result'), parts: z.array(md).min(1), muted: text.optional() })])
  .transform((value) => (typeof value === 'string' ? { tag: 'Result', parts: [value] } : value));

export const project = z.strictObject({
  example: bool(false).describe('While true, this project is the example and stays hidden on your site.'),
  title: text,
  kicker: text.optional().describe('A short line above the title, e.g. "CLI · Rust".'),
  group: text.default('Projects').describe('The heading this project is listed under on /projects.'),
  order: z.int().optional().describe('Position on /projects. Default: file order.'),
  start: partialDate().optional(),
  end: partialDate({ present: true }).optional(),
  margin: text.optional().describe('Margin text instead of the dates.'),
  summary: md,
  facts: z.array(fact).default([]),
  links: z.array(projectLink).default([]),
  compact: bool(false).describe('A one-line entry.'),
  listed: bool(true).describe('false: shown on the home page only.'),
  home: z
    .strictObject({
      order: z.int(),
      title: text.optional(),
      summary: md.optional(),
      result: result.optional(),
      links: z.array(projectLink).optional(),
      footnote: z.array(text).optional(),
      exhibit: exhibit.optional(),
    })
    .optional()
    .describe('Features the project in "Selected work" on the home page.'),
  result: result.optional(),
});

/** content/projects.yaml: the order, titles and ids of the groups on /projects. */
export const projectsGroups = z.strictObject({
  groups: z
    .array(z.strictObject({ title: text, id: htmlId.optional(), headingId: htmlId.optional(), link: headingLink.optional() }))
    .default([])
    .transform((groups, ctx) => {
      const owner = new Map<string, number>();
      return groups.map((group, i) => {
        const id = group.id ?? (slug(group.title) || `group-${i + 1}`);
        const first = owner.get(id);
        if (first !== undefined) {
          const message = `${show(id)} is already the id of group ${first + 1}; give each group its own id`;
          fail(ctx, id, 'E303', message, [i, group.id === undefined ? 'title' : 'id']);
        }
        owner.set(id, i);
        return { ...group, id };
      });
    }),
});

export type Project = z.output<typeof project>;
export type ProjectsGroups = z.output<typeof projectsGroups>;
