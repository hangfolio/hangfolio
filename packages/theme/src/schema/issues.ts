// Issues the schemas raise themselves. Each one carries its catalogue code in params.code
// (SPEC 5.10) for the validator, and its message reads after the field name ("date" + " must
// look like …"), because both the validator and Astro print the path first.
import { z } from 'zod';

export type Code = 'E202' | 'E204' | 'E303';
export type Issues = { issues: z.core.$ZodRawIssue[] };

/**
 * Records an issue with its catalogue code; returns z.NEVER so a transform can end with it.
 * `continue: true` lets a union report this issue itself: zod picks the one branch whose issues
 * all continue, instead of reporting that no branch matched.
 */
export function fail(ctx: Issues, input: unknown, code: Code, message: string, path: PropertyKey[] = []): never {
  ctx.issues.push({ code: 'custom', input, message, path, params: { code }, continue: true });
  return z.NEVER;
}

/** The issue zod raises for a missing required field, which the validator reports as E203. */
export function missing(ctx: Issues): never {
  ctx.issues.push({ code: 'invalid_type', expected: 'string', input: undefined, message: 'is required' });
  return z.NEVER;
}

/** A value as the message quotes it. */
export const show = (value: unknown) => (typeof value === 'string' ? `'${value}'` : String(value));

const either = (keys: string[]) => keys.join(', ').replace(/, ([^,]*)$/, ' or $1');

/** A check for an object: exactly one of `keys` is present. */
export function exactlyOne(keys: string[]) {
  return (ctx: Issues & { value: Record<string, unknown> }) => {
    const present = keys.filter((key) => ctx.value[key] !== undefined);
    if (present.length === 0) fail(ctx, ctx.value, 'E202', `needs one of ${either(keys)}`);
    if (present.length > 1) fail(ctx, ctx.value, 'E202', `needs only one of ${either(keys)}, but has ${present.join(' and ')}`);
  };
}

/** A check for a list of strings: no value twice. */
export function noRepeats(ctx: Issues & { value: readonly string[] }) {
  ctx.value.forEach((value, i) => {
    if (ctx.value.indexOf(value) !== i) fail(ctx, value, 'E202', `lists ${show(value)} twice`, [i]);
  });
}
