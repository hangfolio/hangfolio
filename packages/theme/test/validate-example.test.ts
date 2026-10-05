// Example mode (SPEC 5.2): the demo identity, what outside demo mode hides from site.yaml, how
// example entries are found and told apart from edited ones, and starter-values.json itself.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isDemoIdentity, STARTER_VALUES_FILE, starterValues } from '../src/lib/starter-values.ts';
import { site as siteSchema } from '../src/schema/site.ts';
import { scanBib } from '../src/validate/bib-keys.ts';
import { loadFile } from '../src/validate/content-files.ts';
import { entryHash, exampleEntries } from '../src/validate/entries.ts';
import { siteExamples, visibleSite } from '../src/validate/example.ts';
import { validateSite } from '../src/validate/index.ts';
import { loadSource } from '../src/validate/source.ts';
import { starterValuesText } from '../src/validate/starter-values.ts';
import { experience } from '../src/schema/index.ts';
import { parseOk } from './helpers.ts';

const STARTER = fileURLToPath(new URL('../../../starter/', import.meta.url));

test('starter-values.json matches starter/ (run `npm run build` to update it)', () => {
  assert.equal(readFileSync(STARTER_VALUES_FILE, 'utf8'), starterValuesText(STARTER));
});

test('the starter is the demo, and the checks find nothing wrong with it', async () => {
  const report = await validateSite(STARTER, { env: {} });
  assert.equal(report.demo, true);
  assert.deepEqual(report.issues, []);
  assert.equal(report.visible?.avatar, '/example/avatar.jpg');
});

test('demo mode needs both the name and the email', () => {
  assert.equal(isDemoIdentity('Rowan Vale', 'rowan@example.edu'), true);
  assert.equal(isDemoIdentity(' Rowan Vale ', 'Rowan@Example.edu'), true);
  // A real Rowan Vale who changes the email leaves demo mode.
  assert.equal(isDemoIdentity('Rowan Vale', 'rowan@harbor.test'), false);
  assert.equal(isDemoIdentity('Mara Quill', 'rowan@example.edu'), false);
  assert.equal(isDemoIdentity(undefined, 'rowan@example.edu'), false);
});

test('outside demo mode, example values leave site.yaml and the rest stays', () => {
  const was = starterValues().site;
  const text = [
    'name: "Mara Quill"',
    'email: "mara@quill.test"',
    `location: "${was.location}"`,
    'avatar: "/example/avatar.jpg"',
    'cv: "/files/cv.pdf"',
    'links:',
    `  - "${was.links[0]}"`,
    '  - "https://github.com/hangfolio/hangfolio"',
    'booking: { calcom: "mara-quill/30min" }',
  ].join('\n');
  const site = parseOk(siteSchema, parseYaml(text));
  const { issues, hidden } = siteExamples(site, loadSource('site.yaml', text), starterValues(), STARTER);
  assert.deepEqual(issues.map((i) => `${i.line ?? '-'} ${i.code}`), ['3 W402', '7 W402', '4 W404', '- W404']);
  const visible = visibleSite(site, hidden);
  assert.equal(visible.location, undefined);
  assert.equal(visible.avatar, undefined);
  assert.equal(visible.cv, '/files/cv.pdf');
  assert.deepEqual(visible.links.map((l) => l.url), ['https://github.com/hangfolio/hangfolio']);
  assert.equal(visible.booking?.calcom, 'mara-quill/30min');
});

test('a partly edited availability keeps showing; only the example headline hides it', () => {
  const was = starterValues().site;
  const text = `name: "Mara Quill"\nemail: "mara@quill.test"\navailability: { headline: "Visiting Lisbon in May." }\n`;
  const site = parseOk(siteSchema, parseYaml(text));
  assert.deepEqual(siteExamples(site, loadSource('site.yaml', text), starterValues(), STARTER).issues.filter((i) => i.code !== 'W404'), []);
  assert.notEqual(site.availability?.headline, was.availability?.headline);
});

test('example entries: list items, the marker line, and hashes that ignore the marker', () => {
  const text = readFileSync(`${STARTER}content/experience.yaml`, 'utf8');
  const { loaded } = loadFile(STARTER, 'content/experience.yaml', 'experience', experience);
  const entries = exampleEntries([loaded]);
  assert.equal(entries.length, 5);
  // The starter writes each marker on its own line, so it can be deleted whole.
  assert.deepEqual(entries.map((e) => [e.line, e.col, e.alone]), [[7, 5, true], [17, 5, true], [26, 5, true], [33, 5, true], [42, 5, true]]);
  assert.ok(entries.every((e) => starterValues().entries.experience.includes(e.hash)));
  assert.ok(text.includes('example: true'));
  // Key order, quoting and the marker itself don't change the hash; the content does.
  assert.equal(entryHash({ example: true, a: '1', b: [2] }), entryHash({ b: [2], a: '1' }));
  assert.notEqual(entryHash({ a: '1' }), entryHash({ a: '2' }));
  assert.notEqual(entryHash({ a: '1' }, 'body'), entryHash({ a: '1' }, 'other body'));
});

test('BibTeX: keys, lines, and the example field on its own line', () => {
  const bib = `% comment\n@string{exc = {Example Conference}}\n@inproceedings{vale2024bounded,\n  example   = {true},\n  title = {A {Nested} Title},\n}\n@article( second ,\n  title = {B}, example = true)\n`;
  const entries = scanBib(bib);
  assert.deepEqual(entries.map((e) => [e.key, e.line, e.exampleLine, e.exampleAlone]), [['vale2024bounded', 3, 4, true], ['second', 7, 8, false]]);
});

const parseYaml = (text: string) => loadSource('site.yaml', text).doc?.toJS();
