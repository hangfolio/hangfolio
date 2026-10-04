// JSON Schemas for editors (SPEC 5.1): what a person may write in each file, so github.dev,
// Codespaces and VS Code offer autocomplete and flag mistakes while typing. They describe the
// input (shorthands included); checks that need code, like dates and paths, run only in zod.
import { z } from 'zod';
import { SCHEMAS } from './index.ts';

/** Where the published schemas are served; the starter's yaml-language-server lines point here. */
export const SCHEMA_URL = 'https://unpkg.com/hangfolio@1/schema/';

/** Drops the ±MAX_SAFE_INTEGER bounds zod gives every integer; they only add noise. */
function tidy(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tidy);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key, value]) => !(['minimum', 'maximum'].includes(key) && Math.abs(value as number) === Number.MAX_SAFE_INTEGER))
      .map(([key, value]) => [key, tidy(value)]),
  );
}

export function jsonSchema(name: string): Record<string, unknown> {
  const { schema, file } = SCHEMAS[name];
  const { $schema, ...rest } = z.toJSONSchema(schema, { io: 'input', target: 'draft-7' });
  return { $schema, $id: `${SCHEMA_URL}${name}.json`, title: `hangfolio: ${file}`, ...(tidy(rest) as object) };
}

/** Every schema file, by file name (`site.json`), as the text written to schema/. */
export function jsonSchemaFiles(): Record<string, string> {
  return Object.fromEntries(Object.keys(SCHEMAS).map((name) => [`${name}.json`, `${JSON.stringify(jsonSchema(name), null, 2)}\n`]));
}
