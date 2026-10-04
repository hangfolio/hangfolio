// What a date written another way most likely means, for the "did you mean" in E204:
// Sept 2024 → 2024-09, 3 Sept 2024 or Sept 3, 2024 → 2024-09-03, 09/2024 → 2024-09,
// 2024-6 → 2024-06, and Present or now → present. 03/04/2024 could be March or April, so it gets
// no guess.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NOW = new Set(['present', 'now', 'current', 'currently', 'ongoing', 'today']);

/** A month name or its first three or more letters (Sept too), as 1–12. */
function monthOf(word: string): number | undefined {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (w === 'sept') return 9;
  const i = w.length >= 3 ? MONTHS.findIndex((m) => m.startsWith(w)) : -1;
  return i === -1 ? undefined : i + 1;
}

/** The date from a month name, a year and maybe a day. */
function named(word: string, year: string, day?: string): string | undefined {
  const month = monthOf(word);
  return month ? form(+year, month, day === undefined ? undefined : +day) : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

function form(year: number, month: number, day?: number): string | undefined {
  if (month < 1 || month > 12) return undefined;
  if (day === undefined) return `${year}-${pad(month)}`;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 ? `${year}-${pad(month)}-${pad(day)}` : undefined;
}

/** The date in the YYYY-MM or YYYY-MM-DD form, or `present`; undefined when it can't be told. */
export function guessDate(value: unknown, { present = false } = {}): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().replace(/,/g, ' ').replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1').replace(/\s+/g, ' ');
  if (NOW.has(text.toLowerCase())) return present ? 'present' : undefined;
  let m: RegExpExecArray | null;
  if ((m = /^([a-z]+\.?) (\d{4})$/i.exec(text))) return named(m[1], m[2]);
  if ((m = /^([a-z]+\.?) (\d{1,2}) (\d{4})$/i.exec(text))) return named(m[1], m[3], m[2]);
  if ((m = /^(\d{1,2}) ([a-z]+\.?) (\d{4})$/i.exec(text))) return named(m[2], m[3], m[1]);
  if ((m = /^(\d{1,2})[/.](\d{4})$/.exec(text))) return form(+m[2], +m[1]);
  if ((m = /^(\d{4})[-/.](\d{1,2})$/.exec(text))) return form(+m[1], +m[2]);
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text))) return form(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text))) {
    const [a, b, year] = [+m[1], +m[2], +m[3]];
    if (a > 12 && b <= 12) return form(year, b, a);
    if (b > 12 && a <= 12) return form(year, a, b);
  }
  return undefined;
}
