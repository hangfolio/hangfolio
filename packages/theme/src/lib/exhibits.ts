// The exhibits beside a featured project (SPEC 5.5 `Exhibit`): how a terminal's lines are read
// and how bars are measured. The components are components/Exhibit*.astro.
import type { Project } from '../schema/project.ts';

export type Exhibit = NonNullable<NonNullable<Project['home']>['exhibit']>;
export type Bars = NonNullable<Exhibit['bars']>;

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Severity = (typeof SEVERITIES)[number];

export type TerminalLine =
  | { kind: 'prompt'; text: string }
  | { kind: 'comment'; text: string }
  | { kind: 'severity'; severity: Severity; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'blank' };

/**
 * A terminal's lines: `$ ` starts a prompt (the $ is drawn dim and hidden from screen readers),
 * `# ` a comment (shown whole, dim), and [CRITICAL] , [HIGH] , [MEDIUM] or [LOW]  a severity badge.
 */
export function terminalLines(lines: string[]): TerminalLine[] {
  return lines.map((line): TerminalLine => {
    if (line.trim() === '') return { kind: 'blank' };
    if (line.startsWith('$ ')) return { kind: 'prompt', text: line.slice(2) };
    if (line.startsWith('# ')) return { kind: 'comment', text: line };
    const severity = /^\[(CRITICAL|HIGH|MEDIUM|LOW)\] /.exec(line)?.[1] as Severity | undefined;
    if (severity) return { kind: 'severity', severity, text: line.slice(severity.length + 3) };
    return { kind: 'text', text: line };
  });
}

/** "8.6 GB", "45%", "3×": a unit that starts with a letter or digit gets a space before it. */
export function valueText(value: number, unit?: string): string {
  if (!unit) return String(value);
  return /^[\p{L}\p{N}]/u.test(unit) ? `${value} ${unit}` : `${value}${unit}`;
}

/** A bar's width: value / max as a percentage rounded to 0.1% ("33.7%"); 0% when every value is 0. */
export function barWidth(value: number, max: number): string {
  return `${max > 0 ? Math.round((value / max) * 1000) / 10 : 0}%`;
}

export type BarRow = { label: string; value: string; width: string; tone: 'accent' | 'faint' };

/** The rows of a bars exhibit, each drawn to scale against the largest value. */
export function barRows(bars: Bars): BarRow[] {
  const max = Math.max(...bars.rows.map((row) => row.value));
  return bars.rows.map((row) => ({ label: row.label, value: valueText(row.value, row.unit), width: barWidth(row.value, max), tone: row.tone }));
}

/** The longest label and value, in characters, which set the label and value columns' widths. */
export function barColumns(rows: BarRow[]): { label: number; value: number } {
  const longest = (texts: string[]) => Math.max(0, ...texts.map((text) => [...text].length));
  return { label: longest(rows.map((row) => row.label)), value: longest(rows.map((row) => row.value)) };
}

/**
 * The bars' accessible name: the chart is one image to a screen reader, so its label carries
 * every value: "Cold-start time: Before 840 ms, After 310 ms".
 */
export function barsLabel(bars: Bars): string {
  const values = barRows(bars).map((row) => `${row.label} ${row.value}`).join(', ');
  return `${bars.label.replace(/[\s.:;,]+$/, '')}: ${values}`;
}
