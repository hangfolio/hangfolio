// Reads a zod schema's shape along a path, for "did you mean" over field names: the fields that
// may appear in the object at ['entries', 0], say. Wrappers (optional, default, pipe …) are
// looked through, and every branch of a union counts.
import type { z } from 'zod';

type Def = { type: string; [key: string]: unknown };
const def = (schema: unknown) => (schema as { _zod: { def: Def } })._zod.def;

/** The schema itself, without wrappers; each branch of a union. */
function expand(schema: z.ZodType): z.ZodType[] {
  const d = def(schema);
  switch (d.type) {
    case 'pipe':
      return expand(d.in as z.ZodType);
    case 'optional':
    case 'default':
    case 'prefault':
    case 'nullable':
    case 'readonly':
    case 'catch':
    case 'nonoptional':
      return expand(d.innerType as z.ZodType);
    case 'lazy':
      return expand((d.getter as () => z.ZodType)());
    case 'union':
      return (d.options as z.ZodType[]).flatMap(expand);
    default:
      return [schema];
  }
}

function child(schema: z.ZodType, seg: PropertyKey): z.ZodType[] {
  return expand(schema).flatMap((node) => {
    const d = def(node);
    const shape = d.shape as Record<string, z.ZodType> | undefined;
    if (d.type === 'object' && typeof seg === 'string' && shape && seg in shape) return [shape[seg]];
    if (d.type === 'array' && typeof seg === 'number') return [d.element as z.ZodType];
    if (d.type === 'record') return [d.valueType as z.ZodType];
    return [];
  });
}

/** The field names an object at `path` may have. */
export function knownKeys(schema: z.ZodType, path: readonly PropertyKey[]): string[] {
  let nodes = [schema];
  for (const seg of path) nodes = nodes.flatMap((node) => child(node, seg));
  const keys = nodes.flatMap(expand).flatMap((node) => (def(node).type === 'object' ? Object.keys(def(node).shape as object) : []));
  return [...new Set(keys)];
}
