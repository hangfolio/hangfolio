// How schema problems read (SPEC 5.10): plain words, the field's name, what was written, the fix,
// and "did you mean" over field names and allowed values. The golden cases in fixtures/broken
// cover one of each code; these cover the branches between them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { z } from 'zod';
import { experience, post, project, site } from '../src/schema/index.ts';
import { plainLines } from '../src/validate/format.ts';
import { loadSource, toData } from '../src/validate/source.ts';
import { didYouMean, distance, listOf } from '../src/validate/suggest.ts';
import { fieldName, schemaIssues, show } from '../src/validate/zod-issues.ts';

const SITE = 'name: "Wren Halloway"\nemail: "wren@halloway.test"\n';

function messages(file: string, schema: z.ZodType, text: string): string {
  const source = loadSource(file, text);
  return plainLines(schemaIssues(source, schema, toData(source)).issues);
}

test('distance counts a swap of neighbours as one edit', () => {
  assert.equal(distance('reserach', 'research'), 1);
  assert.equal(distance('sumary', 'summary'), 1);
  assert.equal(distance('kitten', 'sitting'), 3);
});

test('did you mean: at most 2 edits, 1 for short words, ignoring case', () => {
  assert.equal(didYouMean('writting', ['projects', 'writing']), 'writing');
  assert.equal(didYouMean('Summary', ['summary']), 'summary');
  assert.equal(didYouMean('id', ['cv', 'url']), undefined);
  assert.equal(didYouMean('tag', ['tags']), 'tags');
  assert.equal(didYouMean('colour', ['color', 'colors']), 'color');
  assert.equal(listOf(['a', 'b', 'c'], 2), 'a, b and 1 more');
});

test('field names: the keys after the last list index, or the list item itself', () => {
  assert.equal(fieldName(['entries', 1, 'section']), 'section');
  assert.equal(fieldName(['availability', 'until']), 'availability.until');
  assert.equal(fieldName(['links', 1]), 'links item 2');
  assert.equal(fieldName(['entries', 0, 'gallery', 'images', 1, 'alt']), 'alt');
  assert.equal(show('x'.repeat(70)), `'${'x'.repeat(57)}…'`);
  assert.equal(show(null), 'nothing');
});

test('a value that is neither form of a shorthand names both forms', () => {
  assert.equal(
    messages('site.yaml', site, `${SITE}affiliation: 42\n`),
    'site.yaml:3:1 E202 affiliation must be text or a group of fields (key: value lines). You wrote 42.',
  );
  // Inside the object form, the problem is reported where it is (S11 sample x3).
  assert.equal(
    messages('site.yaml', site, `${SITE}affiliation: { name: "Harbor Institute", url: 42 }\n`),
    'site.yaml:3:42 E202 affiliation.url must be text, so put it in quotes: url: "42"',
  );
  assert.equal(
    messages('site.yaml', site, `${SITE}pages:\n  experience: off\n`),
    'site.yaml:4:3 E202 pages.experience must be true or false or a group of fields (key: value lines). You wrote \'off\'.',
  );
});

test('lists, booleans and sizes say what to write', () => {
  const postText = (extra: string) => `---\ntitle: "T"\ndate: 2026-09-01\ndescription: "D"\n${extra}---\n`;
  assert.equal(messages('content/writing/t.md', post, postText('tags: storage\n')), "content/writing/t.md:5:1 E202 tags must be a list: tags: [\"storage\"]");
  assert.equal(messages('content/writing/t.md', post, postText('draft: "yes"\n')), "content/writing/t.md:5:1 E202 draft must be true or false, without quotes. You wrote 'yes'.");
  const metrics = 'title: "T"\nsummary: "S"\nhome:\n  order: 1\n  exhibit:\n    metrics: { title: "M", rows: [] }\n';
  assert.equal(messages('content/projects/t.md', project, `---\n${metrics}---\n`), 'content/projects/t.md:7:28 E202 home.exhibit.metrics.rows needs at least 1 item.');
  assert.equal(messages('site.yaml', site, `name: "${'N'.repeat(81)}"\nemail: "a@b.co"\n`), 'site.yaml:1:1 E202 name must be 80 characters or fewer.');
});

test('a missing field is reported where it belongs, and not when a misspelling explains it', () => {
  const text = 'entries:\n  - section: research\n    roel: "Engineer"\n    org: "Harbor Institute"\n';
  assert.equal(messages('content/experience.yaml', experience, text), "content/experience.yaml:3:5 E201 Unknown field 'roel'. Did you mean 'role'?");
  assert.equal(
    messages('content/experience.yaml', experience, 'entries:\n  - { section: research, org: "Harbor Institute" }\n'),
    'content/experience.yaml:2:5 E203 \'role\' is required in entries item 1. Add role: "…"',
  );
});

test('every problem in a file is reported at once', () => {
  const text = `${SITE}role: 42\nlinks: ["ftp://x.org"]\nnav: [projects, cv, { label: "Talks" }]\n`;
  assert.equal(
    messages('site.yaml', site, text),
    [
      'site.yaml:3:1 E202 role must be text, so put it in quotes: role: "42"',
      "site.yaml:4:9 E202 links item 1 must start with https://, http://, mailto: or tel:. You wrote 'ftp://x.org'.",
      "site.yaml:5:21 E203 'href' is required in nav item 3. Add href: \"…\"",
    ].join('\n'),
  );
});
