// Positions in YAML files and front matter (S11): lines are the file's lines whatever comes before
// the front matter, columns count code points, and paths through maps and lists find their node.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource, locate, toData } from '../src/validate/source.ts';
import { quote, syntaxIssues, valueOf } from '../src/validate/yaml-hints.ts';

const at = (file: string, text: string, path: PropertyKey[]) => {
  const found = locate(loadSource(file, text), path);
  return found && `${found.line}:${found.col}`;
};

test('front matter lines count from the top of the file: a BOM, blank lines and CRLF', () => {
  const text = '\uFEFF\r\n---\r\ntitle: "Kelp"\r\nsumary: "x"\r\n---\r\nBody\r\n';
  assert.equal(at('content/projects/kelp.md', text, ['sumary']), '4:1');
  const source = loadSource('content/projects/kelp.md', text);
  assert.equal(source.opener, 2);
  assert.equal(source.body, '\r\nBody\r\n');
  assert.deepEqual(toData(source), { title: 'Kelp', sumary: 'x' });
});

test('columns count code points, so an emoji before the mistake is one column', () => {
  const text = 'name: "x"\nemail: "a@b.c"\naffiliation: { name: "Café 🌊 Lab", url: 42 }\n';
  assert.equal(at('site.yaml', text, ['affiliation', 'url']), '3:36');
});

test('paths go through lists and nested maps; a path past the file stops at its deepest node', () => {
  const text = 'entries:\n  - section: research\n    gallery:\n      images:\n        - { thumb: a.jpg }\n        - thumb: b.jpg\n          width: "800px"\n';
  assert.equal(at('content/experience.yaml', text, ['entries', 0, 'gallery', 'images', 1, 'width']), '7:11');
  assert.equal(at('content/experience.yaml', text, ['entries', 0, 'gallery', 'images', 1]), '6:11');
  const deep = locate(loadSource('content/experience.yaml', text), ['entries', 0, 'gallery', 'images', 1, 'alt']);
  assert.equal(deep?.found, false);
  assert.equal(deep?.line, 6);
  assert.equal(locate(loadSource('site.yaml', ''), ['name']), null);
});

test('a multi-line value ends on its own last line, not at column 1 of the next', () => {
  const found = locate(loadSource('site.yaml', 'tagline: >\n  one\n  two\nname: "x"\n'), ['tagline']);
  assert.deepEqual([found?.line, found?.endLine], [1, 3]);
});

test('Markdown without a closing --- has no front matter: E103 on the opening line', () => {
  const source = loadSource('content/projects/harbor.md', '\n---\ntitle: "Harbor"\n\nText.\n');
  assert.equal(source.unclosed, true);
  assert.equal(toData(source), undefined);
  assert.deepEqual(syntaxIssues(source), [{ code: 'E103', file: 'content/projects/harbor.md', line: 2, col: 1, message: 'The block starting with --- needs a closing --- line.' }]);
  assert.deepEqual(toData(loadSource('content/writing/x.md', 'Just text.\n')), {});
});

test('one problem per line, and no BAD_INDENT echo after a tab (S11 finding 3)', () => {
  const issues = syntaxIssues(loadSource('content/experience.yaml', 'entries:\n  - section: research\n\torg: "x"\n    role: "y"\n'));
  assert.deepEqual(issues.map((i) => `${i.line} ${i.code}`), ['3 E102']);
  const two = syntaxIssues(loadSource('site.yaml', 'a: x: y\nb: 1\nc: x: y\n'));
  assert.deepEqual(two.map((i) => `${i.line}:${i.col} ${i.code}`), ['1:4 E101', '3:4 E101']);
});

test('an alias with no anchor is a quoting mistake, not a crash', () => {
  const source = loadSource('site.yaml', 'name: "x"\nrole: *Senior\n');
  assert.equal(toData(source), undefined);
  assert.deepEqual(syntaxIssues(source).map((i) => i.message), ['This value starts with *, so it needs quotes: role: "*Senior"']);
});

test('valueOf and quote build the fixed line', () => {
  assert.deepEqual(valueOf('tagline: a: b   # note'), { prefix: 'tagline: ', text: 'a: b', col: 10 });
  assert.deepEqual(valueOf('  - text'), { prefix: '  - ', text: 'text', col: 5 });
  assert.equal(quote('a: b'), '"a: b"');
  assert.equal(quote('say "hi": now'), `'say "hi": now'`);
  assert.equal(quote('C:\\path'), '"C:\\\\path"');
});

const hints = (file: string, text: string) => syntaxIssues(loadSource(file, text)).map((i) => `${i.line}:${i.col} ${i.message}`);

test('an unclosed quote is reported where it opens, with the line fixed', () => {
  // yaml gives up at the closing --- of the front matter, two lines later
  assert.deepEqual(hints('content/projects/kelp.md', '---\ntitle: "Kelp"\nsummary: "Counts kelp.\nstart: 2025-04\n---\nBody.\n'), [
    '3:10 This value\'s " quote is never closed. Add the closing ": summary: "Counts kelp."',
  ]);
  // before a trailing comment, and inside { } before the }; the echo on the next line is left out
  assert.deepEqual(hints('site.yaml', 'location: "Harbor Point        # example\n'), ['1:11 This value\'s " quote is never closed. Add the closing ": location: "Harbor Point"']);
  assert.deepEqual(hints('content/news.yaml', 'items:\n  - { date: 2026-08, text: "Started }\n  - { date: 2026-05, text: "Joined." }\n'), [
    '2:28 This value\'s " quote is never closed. Add the closing ": - { date: 2026-08, text: "Started" }',
  ]);
});

test('an unclosed quote that runs on into the next value, or is closed with a curly quote', () => {
  // inside { } or [ ], the next value's opening quote closes it and yaml stumbles after that
  assert.deepEqual(hints('content/experience.yaml', 'entries:\n  - { section: research, role: "Field engineer, org: "Harbor Institute" }\n'), [
    '2:32 This value\'s " quote is never closed. Add the closing ": - { section: research, role: "Field engineer", org: "Harbor Institute" }',
  ]);
  assert.deepEqual(hints('site.yaml', 'lines: ["$ check ./db, "# 3 points"]\n'), ['1:9 This value\'s " quote is never closed. Add the closing ": lines: ["$ check ./db", "# 3 points"]']);
  // a phone types the closing quote curly; the fix replaces it, unless something inside opened it
  assert.deepEqual(hints('site.yaml', 'role: "Marine ecologist”\nlocation: "Harbor Point"\n'), [
    '1:7 This value\'s " quote is closed with a curly ”, which YAML doesn\'t read as a quote. Use a straight one: role: "Marine ecologist"',
  ]);
  assert.deepEqual(hints('site.yaml', "role: 'Marine ecologist’   # example\n"), [
    "1:7 This value's ' quote is closed with a curly ’, which YAML doesn't read as a quote. Use a straight one: role: 'Marine ecologist'",
  ]);
  assert.deepEqual(hints('site.yaml', 'tagline: "I said “hi”\n'), ['1:10 This value\'s " quote is never closed. Add the closing ": tagline: "I said “hi”"']);
});

test('inside { }, a missing comma and text with ": " get different fixes', () => {
  assert.deepEqual(hints('content/news.yaml', 'items:\n  - { date: 2026-09 text: "A talk." }\n'), [
    '2:13 A comma is missing before text. Inside { }, put a comma between fields: - { date: 2026-09, text: "A talk." }',
  ]);
  assert.deepEqual(hints('content/news.yaml', 'items:\n  - { date: 2026-09, text: Keynote talk: kelp, tides }\n'), [
    `2:28 This value contains ': ' and needs quotes: - { date: 2026-09, text: "Keynote talk: kelp, tides" }`,
  ]);
});

test('a list item without the space after -, curly quotes, and a key repeated on one line', () => {
  // the six lines yaml misreads after the first are not reported
  assert.deepEqual(hints('site.yaml', 'links:\n  - "a"\n  -"https://x.org/"\n  - { url: "b", label: "c" }\nnext: 1\n'), ['3:3 Put a space after the -: - "https://x.org/"']);
  assert.deepEqual(hints('site.yaml', 'tagline: “Kelp: how it grows”\n'), [
    `1:10 This value is in curly quotes (“ ”), which YAML doesn't read as quotes. Use straight ones: tagline: "Kelp: how it grows"`,
  ]);
  assert.deepEqual(hints('content/news.yaml', 'items:\n  - { date: 2026-09, text: "a", text: "b" }\n'), ["2:33 'text' is set twice on this line. Keep one of them."]);
});
