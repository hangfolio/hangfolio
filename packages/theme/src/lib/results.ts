// The "Results at a glance" strip (components/ResultsStrip.astro) from home.yaml `highlights`
// (SPEC 5.4): each value is split into the spans that style it, and the strip gets its columns.

export type HighlightValue = {
  /** A leading "up to ", shown smaller (the prefix span) */
  pre?: string;
  /** The value cut at each " → ", which is shown dimmer (the arrow span) */
  parts: string[];
  /** Kept on one line: a value with a prefix or an arrow reads as one figure */
  nowrap: boolean;
};

const ARROW = ' → ';

/** "up to 40%" is {pre: "up to ", parts: ["40%"]}; "3s → 300ms" is {parts: ["3s", "300ms"]}. */
export function highlightValue(value: string): HighlightValue {
  const pre = /^up to /i.exec(value)?.[0];
  const parts = value.slice(pre?.length ?? 0).split(ARROW);
  return { ...(pre && { pre }), parts, nowrap: Boolean(pre) || parts.length > 1 };
}

/** One column per item on wide screens, at most 4 (home.yaml allows 1 to 4 items). */
export const resultColumns = (count: number) => Math.min(Math.max(count, 1), 4);
