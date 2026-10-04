// tokens.css is the design's token blocks (:root and both dark blocks), copied byte for byte.
// test/fixtures/owner-tokens.snapshot.css is the frozen copy they must keep matching (SPEC G2).
// Changing a token means changing both files on purpose, in a reviewed change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseTokens, tokenBlocks } from '../src/lib/tokens.ts';

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url));
const snapshot = readFileSync(new URL('./fixtures/owner-tokens.snapshot.css', import.meta.url));

test('tokens.css matches the frozen token snapshot byte for byte', () => {
  if (!tokens.equals(snapshot)) {
    const a = tokens.toString('utf8').split('\n');
    const b = snapshot.toString('utf8').split('\n');
    const line = a.findIndex((text, i) => text !== b[i]);
    assert.fail(`tokens.css differs from the snapshot at line ${line + 1}:\n  tokens.css: ${JSON.stringify(a[line])}\n  snapshot:   ${JSON.stringify(b[line])}`);
  }
});

test('the file is exactly the three token blocks', () => {
  const blocks = tokenBlocks(tokens.toString('utf8'));
  assert.deepEqual(blocks.map((b) => b.selector), [':root', 'html[data-theme="dark"]', 'html:not([data-theme="light"])']);
  // Both ways dark mode can apply carry the same values.
  assert.deepEqual(blocks[1].values, blocks[2].values);
});

test('light and dark define the same colour tokens', () => {
  const { light, dark } = parseTokens(tokens.toString('utf8'));
  const colours = Object.keys(light).filter((name) => !['serif', 'sans', 'mono'].includes(name));
  assert.deepEqual(Object.keys(dark).sort(), colours.sort());
});

test('the theme-color values come from --bg', () => {
  const { light, dark } = parseTokens(tokens.toString('utf8'));
  assert.equal(light.bg, '#f5f7fa');
  assert.equal(dark.bg, '#0e1219');
});
