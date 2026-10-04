// Dates (SPEC 5.1): 2026, 2026-08 or 2026-08-14. YAML reads 2026 as a number, and Astro's
// front-matter parser (js-yaml) reads 2026-08-14 as a Date, so both are accepted too. Each
// schema's editor form (JSON Schema) is set with meta(), because a Date has no JSON form.
import { z } from 'zod';
import { guessDate } from './date-guess.ts';
import { fail, missing, show } from './issues.ts';

type Least = 'year' | 'month';

const FORM = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const EXAMPLES = { year: '2026, 2026-08 or 2026-08-14', month: '2026-08 or 2026-08-14' };
const PATTERNS = { year: '^\\d{4}(-\\d{2}(-\\d{2})?)?$', month: '^\\d{4}-\\d{2}(-\\d{2})?$' };

/** "you wrote 'Sept 2024'; did you mean 2024-09?" (the validator turns it into two sentences). */
const wrote = (value: unknown, guess?: string) => `you wrote ${show(value)}${guess ? `; did you mean ${guess}?` : ''}`;

/** The date as written text, or undefined when it can't be one. */
function asText(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isInteger(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return undefined;
}

/** True when the parts name a real month and day: 2026-13 and 2026-02-30 are not. */
function real(year: number, month?: number, day?: number): boolean {
  if (month === undefined) return true;
  if (month < 1 || month > 12) return false;
  if (day === undefined) return true;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * A date written as 2026, 2026-08 or 2026-08-14, normalised to that text. The precision is
 * kept, so a year-only range renders years only. `least: 'month'` refuses a bare year (news
 * items), and `present: true` also accepts the word present (the end of a range).
 */
export function partialDate({ least = 'year', present = false }: { least?: Least; present?: boolean } = {}) {
  const forms: Record<string, unknown>[] = [{ type: 'string', pattern: PATTERNS[least] }];
  if (least === 'year') forms.push({ type: 'integer', minimum: 1000, maximum: 9999 });
  if (present) forms.unshift({ const: 'present' });
  return z
    .unknown()
    .meta(forms.length > 1 ? { anyOf: forms } : forms[0])
    .transform((value, ctx) => {
      if (value === undefined) return missing(ctx);
      if (present && value === 'present') return 'present';
      const written = asText(value);
      const match = written === undefined ? null : FORM.exec(written);
      const [year, month, day] = (match?.slice(1) ?? []).map((part) => (part === undefined ? undefined : Number(part)));
      if (!match || (least === 'month' && month === undefined) || !real(year!, month, day)) {
        const options = present ? `${EXAMPLES[least]}, or present` : EXAMPLES[least];
        return fail(ctx, value, 'E204', `must look like ${options} (${wrote(value, guessDate(value, { present }))})`);
      }
      return written!;
    });
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[Tt ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*([Zz]|[+-]\d{2}:?\d{2})?)?$/;

/** A post's date: 2026-08-14, optionally with a time (UTC unless it names a zone). Becomes a Date. */
export const postDate = z
  .unknown()
  .meta({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}([Tt ].*)?$' })
  .transform((value, ctx) => {
    if (value === undefined) return missing(ctx);
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const match = typeof value === 'string' ? DATE_TIME.exec(value.trim()) : null;
    if (match) {
      const [year, month, day] = match[1].split('-').map(Number);
      const zone = (match[3] ?? 'Z').toUpperCase().replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
      const date = new Date(`${match[1]}T${match[2] ?? '00:00'}${zone}`);
      if (real(year, month, day) && !Number.isNaN(date.getTime())) return date;
    }
    const guess = guessDate(value);
    return fail(ctx, value, 'E204', `must look like 2026-08-14 (${wrote(value, guess?.length === 10 ? guess : undefined)})`);
  });

