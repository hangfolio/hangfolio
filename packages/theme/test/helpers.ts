// Shared test helpers.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { z } from 'zod';

/** Every file under dir, as sorted paths relative to it. */
export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

/** Parses with a schema and throws with every issue when it fails. */
export function parseOk<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues, null, 2));
  return result.data;
}

/**
 * The issues a schema reports, as "path code: message". The code is the catalogue code a schema
 * tagged (E204, E303 …) or else zod's own issue code.
 */
export function issuesOf(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const code = (issue as { params?: { code?: string } }).params?.code ?? issue.code;
    return `${issue.path.join('.')} ${code}: ${issue.message}`;
  });
}
