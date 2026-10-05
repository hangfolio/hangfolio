// SPEC 10.2: every documented text colour on every background it is used on meets WCAG AA
// (4.5:1) in both themes, computed from tokens.css. tokens.test.ts keeps the tokens equal to the
// frozen snapshot; this test says why a changed token would be wrong.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTokens } from '../src/lib/tokens.ts';

const AA = 4.5;
const { light, dark } = parseTokens(readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8'));

type RGB = [number, number, number];
const rgb = (hex: string): RGB => {
  assert.match(hex, /^#[\da-f]{6}$/i, `${hex} is not a #rrggbb colour`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = ([r, g, b]: RGB) => {
  const linear = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};
/** The WCAG 2 contrast ratio of two colours. */
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** color-mix(in srgb, a p%, b), as global.css writes it. */
const mix = (a: RGB, p: number, b: RGB): RGB => a.map((v, i) => Math.round(v * p + b[i] * (1 - p))) as RGB;

// Where each pair is used (global.css and the components).
const TEXT = ['fg', 'muted', 'faint', 'accent', 'accent-strong'];
const PAIRS: [string, string, string][] = [
  // body text, secondary text, dates and captions, links and hovered links: on the page, on tinted
  // panels (.inline-code, chips) and in code wells (.well)
  ...TEXT.flatMap((fg) => ['bg', 'tint', 'well'].map((bg): [string, string, string] => [fg, bg, 'text'])),
  ['btn-fg', 'btn-bg', 'buttons'],
  ['btn-fg', 'btn-bg-hover', 'hovered buttons'],
  ['well', 'fg', 'critical severity badges (.sev)'],
  ['well', 'muted', 'high severity badges (.sev.high)'],
  // the availability box (.status.box): color-mix(in srgb, var(--accent) 9%, var(--bg))
  ...['fg', 'muted', 'accent', 'accent-strong'].map((fg): [string, string, string] => [fg, 'status-box', 'the availability box']),
];

function failures(tokens: Record<string, string>): string[] {
  const colour = (name: string) => (name === 'status-box' ? mix(rgb(tokens.accent), 0.09, rgb(tokens.bg)) : rgb(tokens[name]));
  return PAIRS.flatMap(([fg, bg, use]) => {
    const ratio = contrast(colour(fg), colour(bg));
    return ratio < AA ? [`--${fg} on --${bg} (${use}): ${ratio.toFixed(2)}:1, needs ${AA}:1`] : [];
  });
}

for (const [theme, tokens] of [['light', light], ['dark', dark]] as const) {
  test(`${theme}: every documented text and background pair meets ${AA}:1`, () => {
    assert.deepEqual(failures(tokens), [], `contrast below AA in the ${theme} theme`);
  });
}

test('the check fails a pair below 4.5:1', () => {
  const faded = { ...light, faint: '#8a95a7' };
  assert.deepEqual(failures(faded).slice(0, 1), ['--faint on --bg (text): 2.82:1, needs 4.5:1']);
  assert.equal(contrast(rgb('#000000'), rgb('#ffffff')).toFixed(1), '21.0');
});
