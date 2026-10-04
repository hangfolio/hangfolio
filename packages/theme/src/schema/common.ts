// Building blocks shared by the content schemas (SPEC 5.1): text, paths and links, and the
// lenient shorthands for links (a bare URL, label inferred from the host), authors and
// affiliations (a plain string), colours and profile ids. Dates are in dates.ts.
import { z } from 'zod';
import { inferLabel, slug } from '../lib/links.ts';
import { fail, show } from './issues.ts';

export const bool = (value: boolean) => z.boolean().default(value);

/** A line of text. An empty value is refused: delete the line instead. */
export const text = z.string().min(1, "can't be empty; delete the line instead");

/** Inline Markdown: [text](url), **bold**, *em* and `code`; rendered exactly as written. */
export const md = text;

/** Text that must pass `problem`, which returns a message when it doesn't. */
function checked(problem: (value: string) => string | undefined, pattern?: string) {
  return (pattern ? text.meta({ pattern }) : text).check((ctx) => {
    const message = problem(ctx.value);
    if (message) fail(ctx, ctx.value, 'E202', message);
  });
}

const SCHEME = /^([a-z][a-z\d+.-]*):/i;
// A host written without https://, like www.example.org or github.com/someone.
const BARE_HOST = /^(?:www\.|(?:[a-z\d-]+\.)+(?:com|org|net|edu|io|dev|app)(?:[/?#]|$))/i;

function linkProblem(value: string, allowPath: boolean): string | undefined {
  const scheme = SCHEME.exec(value)?.[1].toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    try {
      if (new URL(value).hostname) return undefined;
    } catch {}
    return `must be a full address like https://example.org (you wrote ${show(value)})`;
  }
  if (scheme === 'mailto' || scheme === 'tel') return undefined;
  if (scheme) return `must start with https://, http://, mailto: or tel: (you wrote ${show(value)})`;
  if (value.startsWith('//')) return `needs https: in front: https:${value}`;
  const colon = /^(https?)\/\/+(.+)$/i.exec(value);
  if (colon) return `is missing the colon after ${colon[1]}: ${colon[1]}://${colon[2]}`;
  if (BARE_HOST.test(value)) return `needs https:// in front: https://${value}`;
  if (!allowPath) return `must be a full address starting with https:// (you wrote ${show(value)})`;
  return undefined;
}

/** A link target: https://, http://, mailto:, tel:, a #fragment, or a path on the site. */
export const href = checked((value) => linkProblem(value, true));

/** An address on another site, or mailto:/tel: (site.yaml links). */
export const externalUrl = checked((value) => linkProblem(value, false));

/** An http(s) address. */
export const webUrl = checked((value) => {
  const scheme = SCHEME.exec(value)?.[1].toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return `must be a full address starting with https:// (you wrote ${show(value)})`;
  return linkProblem(value, false);
});

/** A file in public/ (`/images/me.jpg`), or a file on another site. */
export const filePath = checked((value) => {
  const scheme = SCHEME.exec(value)?.[1].toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return `must be a file path like /files/cv.pdf, or an https:// address (you wrote ${show(value)})`;
  }
  return linkProblem(value, true);
});

/** A page's address on the site. "projects" is read as "/projects". */
export const pagePath = text.transform((value, ctx) => {
  if (SCHEME.test(value) || value.startsWith('//')) {
    return fail(ctx, value, 'E202', `must be a path on your site like /projects (you wrote ${show(value)})`);
  }
  if (/[\s?#]/.test(value)) {
    return fail(ctx, value, 'E202', `must be a plain path like /projects, without spaces, ? or # (you wrote ${show(value)})`);
  }
  return value.startsWith('/') ? value : `/${value}`;
});

/** An HTML id, used as a #anchor: letters, digits, - and _. */
export const htmlId = checked(
  (value) => (/^[A-Za-z0-9][\w-]*$/.test(value) ? undefined : `must be letters, digits, - and _ only (you wrote ${show(value)})`),
  '^[A-Za-z0-9][\\w-]*$',
);

/** A profile id, written any way and compared as a slug: "Google Scholar" is google-scholar. */
export const profileId = text.transform(
  (value, ctx) => slug(value) || fail(ctx, value, 'E202', `needs letters or digits (you wrote ${show(value)})`),
);

// The shorthands below are unions of a string and an object. The branches differ in type, and
// issues raised by checks continue (issues.ts), so zod reports a mistake inside the matching
// branch as itself rather than as "matches neither form".

const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** A hex colour, normalised to lowercase #rrggbb. The # is optional. */
export const hexColor = text.meta({ pattern: HEX.source }).transform((value, ctx) => {
  const match = HEX.exec(value.trim());
  if (!match) return fail(ctx, value, 'E202', `must be a hex colour like "#2c5aa0", in quotes (you wrote ${show(value)})`);
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return `#${digits.toLowerCase()}`;
});

/** One colour, or {light, dark?}. Always {light, dark?} after parsing. */
export const accent = z
  .union([hexColor, z.strictObject({ light: hexColor, dark: hexColor.optional() })])
  .transform((value) => (typeof value === 'string' ? { light: value } : value));

/** `affiliation`: a name, or {name, url}. Always {name, url?} after parsing. */
export const affiliation = z
  .union([text, z.strictObject({ name: text, url: webUrl.optional() })])
  .transform((value) => (typeof value === 'string' ? { name: value } : value));

/** An author: a name, or {name, url}. Always {name, url?} after parsing. */
export const author = z
  .union([text, z.strictObject({ name: text, url: href.optional() })])
  .transform((value) => (typeof value === 'string' ? { name: value } : value));

/** {label, href}: nav items and footer links. */
export const navLink = z.strictObject({ label: text, href });

/** One of `values`, reported the way zod reports a failed enum, so did-you-mean applies. */
export function oneOf<const T extends readonly string[]>(values: T) {
  return z
    .string()
    .meta({ enum: [...values] })
    .check((ctx) => {
      if (!values.includes(ctx.value)) {
        const message = `must be one of ${values.join(', ')}`;
        ctx.issues.push({ code: 'invalid_value', values: [...values], input: ctx.value, message, continue: true });
      }
    }) as unknown as z.ZodType<T[number], string>;
}

/** One of site.yaml's links, by id. Without a label, that link's own label is used. */
const profileRef = z.strictObject({ label: text.optional(), profile: profileId });

/** A link in content: a bare URL, {label?, url} or {label?, profile}. A missing label comes from the host. */
export const link = z
  .union([href, z.strictObject({ label: text.optional(), url: href }), profileRef])
  .transform((value) => {
    if (typeof value === 'string') return { label: inferLabel(value), url: value };
    if ('url' in value) return { ...value, label: value.label ?? inferLabel(value.url) };
    return value;
  });

/** A project link: as `link`, or {code} for a command shown in mono. */
export const projectLink = z.union([link, z.strictObject({ code: text })]);

/** {label, href} or {label?, profile}: a heading's link (projects.yaml groups, home research). */
export const headingLink = z.union([navLink, profileRef]);
