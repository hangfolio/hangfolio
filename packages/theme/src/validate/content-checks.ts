// Checks on values that are valid but probably not what the person wants: a tagline over 220
// characters (W205, SPEC 5.3) and a home-page result measured more than 180 days ago (W605).
import type { Loaded } from './content-files.ts';
import type { Issue } from './issue.ts';
import { locate } from './source.ts';

const TAGLINE_LIMIT = 220;
const OLD_DAYS = 180;

export function taglineIssue(site: Loaded): Issue[] {
  const tagline = site.data?.tagline as string | undefined;
  if (!tagline || [...tagline].length <= TAGLINE_LIMIT) return [];
  const at = locate(site.source, ['tagline']);
  const message = `tagline is ${[...tagline].length} characters. It reads best under ${TAGLINE_LIMIT}; put the rest in content/home.yaml as intro.`;
  return [{ code: 'W205', file: site.file, ...(at && { line: at.line, col: at.col }), message }];
}

/** W605 for each highlight whose asOf (2026, 2026-08 or 2026-08-14) ended over 180 days before `now`. */
export function staleResults(home: Loaded, now: Date): Issue[] {
  const items = (home.data?.highlights?.items ?? []) as { asOf?: string }[];
  return items.flatMap((item, i) => {
    if (!item.asOf) return [];
    const [year, month, day] = item.asOf.split('-').map(Number);
    // The end of the period the date names: a year ends on 31 December, a month on its last day.
    const end = Date.UTC(year, month === undefined ? 12 : day === undefined ? month : month - 1, day ?? 1) - (day === undefined ? 1 : 0);
    const days = Math.floor((now.getTime() - end) / 86_400_000);
    if (days <= OLD_DAYS) return [];
    const at = locate(home.source, ['highlights', 'items', i, 'asOf']);
    const message = `This result is from ${item.asOf}, more than ${OLD_DAYS} days ago. Update the number and asOf, or delete asOf.`;
    return [{ code: 'W605', file: home.file, ...(at && { line: at.line, col: at.col }), message }];
  });
}
