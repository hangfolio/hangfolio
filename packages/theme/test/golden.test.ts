// Golden tests (SPEC 10.2): each case in fixtures/broken is a small site with one kind of mistake,
// and the validator must report exactly the lines in its expected.txt (code, file, line, column
// and message). A case holds only the files that differ from fixtures/broken/_base.
// UPDATE_GOLDEN=1 rewrites expected.txt from the current output; review the diff before keeping it.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { plainLines } from '../src/validate/format.ts';
import { validateSite } from '../src/validate/index.ts';

const BROKEN = fileURLToPath(new URL('../../../fixtures/broken/', import.meta.url));
const CASES = readdirSync(BROKEN).filter((name) => /^\d{2}-/.test(name)).sort();
// W605 compares dates with today; the cases are judged on this day.
const NOW = new Date('2026-10-04T12:00:00Z');

const work = mkdtempSync(join(tmpdir(), 'hangfolio-golden-'));
after(() => rmSync(work, { recursive: true, force: true }));

/** The case's site: _base, with the case's files on top. */
function siteFor(name: string): string {
  const dir = join(work, name);
  cpSync(join(BROKEN, '_base'), dir, { recursive: true });
  cpSync(join(BROKEN, name), dir, { recursive: true, filter: (src) => !src.endsWith('expected.txt') });
  return dir;
}

test('fixtures/broken has at least 30 cases, each with its golden output', () => {
  assert.ok(CASES.length >= 30, `only ${CASES.length} cases`);
  for (const name of CASES) assert.ok(existsSync(join(BROKEN, name, 'expected.txt')) || process.env.UPDATE_GOLDEN, `${name} has no expected.txt`);
});

for (const name of CASES) {
  test(name, async () => {
    const report = await validateSite(siteFor(name), { mode: 'check', env: {}, now: NOW });
    const actual = `${plainLines(report.issues)}\n`;
    const file = join(BROKEN, name, 'expected.txt');
    if (process.env.UPDATE_GOLDEN) writeFileSync(file, actual);
    assert.equal(actual, readFileSync(file, 'utf8'));
    // The case is named after the code it is about, and that code is reported.
    const code = name.split('-')[1].toUpperCase();
    assert.ok(report.issues.some((issue) => issue.code === code), `${name} reports no ${code}`);
  });
}
