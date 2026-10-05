// Dates as pages show them. Dates arrive as the text the schemas keep (2026, 2026-08 or
// 2026-08-14; src/schema/dates.ts) and are read in UTC, so a build never shifts a month.

type Parts = { year: number; month?: number };

function parse(date: string): Parts | undefined {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(date);
  if (!match) return undefined;
  return { year: Number(match[1]), month: match[2] === undefined ? undefined : Number(match[2]) };
}

/** "Aug" in the site's locale, read in UTC. */
function monthName(year: number, month: number, locale: string): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
}

/** "Aug 2026", or "2026" for a year written alone. A day is not shown. */
export function monthYear(date: string, locale = 'en-US'): string {
  const parts = parse(date);
  if (!parts) return date;
  return parts.month === undefined ? String(parts.year) : `${monthName(parts.year, parts.month, locale)} ${parts.year}`;
}

/**
 * The DateRange rule (SPEC 5.7): the parts of `<span class=range><span>start</span> <span>– end</span></span>`.
 * - Start and end in the same year drop the start's year: ["Jun", "– Aug 2024"]; the same month is one part.
 * - `present` stays literal: ["Jan 2025", "– present"].
 * - A year written alone shows as a year; the same year twice is one part.
 * - `expected` adds a third part, "(expected)".
 * Only one of start and end gives that one date. Neither gives [].
 */
export function dateRange(
  start: string | undefined,
  end: string | undefined,
  { expected = false, locale = 'en-US' }: { expected?: boolean; locale?: string } = {},
): string[] {
  const from = start === undefined ? undefined : parse(start);
  const to = end === undefined || end === 'present' ? undefined : parse(end);
  const parts: string[] = [];
  if (from && end === 'present') {
    parts.push(monthYear(start!, locale), '– present');
  } else if (from && to) {
    const sameYear = from.year === to.year;
    if (sameYear && from.month === to.month) parts.push(monthYear(end!, locale));
    else if (sameYear && from.month !== undefined && to.month !== undefined) parts.push(monthName(from.year, from.month, locale), `– ${monthYear(end!, locale)}`);
    else parts.push(monthYear(start!, locale), `– ${monthYear(end!, locale)}`);
  } else if (from || to) {
    parts.push(monthYear((from ? start : end)!, locale));
  } else if (end === 'present') {
    parts.push('present');
  }
  if (expected && parts.length > 0) parts.push('(expected)');
  return parts;
}
