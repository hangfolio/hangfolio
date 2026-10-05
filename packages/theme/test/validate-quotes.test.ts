// Quote marks YAML keeps as text (E206, W206): a value in curly quotes, or with a quote at one end
// and none at the other. The golden cases 49 and 50 show one of each; these cover the branches and
// the text with quotes in it that must stay silent.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainLines } from '../src/validate/format.ts';
import { quoteIssues, quoteProblem } from '../src/validate/quotes.ts';
import { loadSource } from '../src/validate/source.ts';

const issues = (file: string, text: string) => plainLines(quoteIssues(loadSource(file, text)));
const code = (value: string) => quoteProblem(value)?.code;
const text = (value: string) => quoteProblem(value)?.text;

test('a value wrapped in curly quotes is W206, double or single, with the quotes taken off', () => {
  assert.equal(code('“Marine ecologist”'), 'W206');
  assert.equal(code('‘Marine ecologist’'), 'W206');
  assert.equal(code('„Meeresökologin“'), 'W206');
  assert.equal(text('“He said “hi” to me”'), 'He said “hi” to me');
  assert.equal(text('‘I’m a marine ecologist’'), 'I’m a marine ecologist');
});

test('an unpaired " is E206: closing only, opening only, or a curly opening with a straight closing', () => {
  assert.equal(code('Marine ecologist"'), 'E206');
  assert.equal(text('Marine ecologist"'), 'Marine ecologist');
  assert.equal(code('Marine ecologist”'), 'E206');
  assert.equal(code('“Marine ecologist'), 'E206');
  assert.equal(text('“Marine ecologist"'), 'Marine ecologist');
  assert.equal(code('“Marine ecologist"'), 'E206');
});

test("an unpaired ' is W206, since it may be an apostrophe", () => {
  assert.equal(code("Marine ecologist'"), 'W206');
  assert.equal(code('Marine ecologist’'), 'W206');
  assert.equal(code("I'm a marine ecologist'"), 'W206');
  assert.equal(code("‘Marine ecologist'"), 'W206');
  assert.match(quoteProblem("Marine ecologist'")!.says, /Unless it is an apostrophe/);
});

test('quotes inside the text, inches, feet and possessives are left alone', () => {
  for (const value of [
    'The “quoted” words',
    '“Quoted” words first',
    'Words “quoted” last',
    '“Measure twice,” I say, “cut once.”',
    'I said "hi"',
    'A 27" display',
    '27"',
    '27”',
    `5' 11"`,
    "Students'",
    'Students’',
    "Rock 'n' roll",
    'I’m here',
    'EXC ’24',
    'Plain text',
  ]) {
    assert.equal(quoteProblem(value), undefined, value);
  }
});

test('the message ends with the fixed line: no trailing comment, the rest of a { } line kept', () => {
  assert.equal(
    issues('site.yaml', 'name: "A"\nrole: “Marine ecologist”   # example\n'),
    `site.yaml:2:7 W206 This value is in curly quotes (“ ”), which YAML doesn't read as quotes, so your site shows them. Use straight ones: role: "Marine ecologist"`,
  );
  assert.equal(
    issues('content/experience.yaml', 'entries:\n  - { section: research, role: Field engineer", org: "Harbor Institute" }\n'),
    `content/experience.yaml:2:32 E206 This value ends with " but doesn't start with one, so the " would show on your site. Put the value in straight quotes: - { section: research, role: "Field engineer", org: "Harbor Institute" }`,
  );
  assert.equal(
    issues('content/projects/x.md', '---\ntitle: “Tidepool\nlines: [$ check ./db", "# 3 points"]\n---\n'),
    [
      `content/projects/x.md:2:8 E206 This value starts with “ but nothing closes it, so the “ would show on your site. Put the value in straight quotes: title: "Tidepool"`,
      `content/projects/x.md:3:9 E206 This value ends with " but doesn't start with one, so the " would show on your site. Put the value in straight quotes: lines: ["$ check ./db", "# 3 points"]`,
    ].join('\n'),
  );
});

test('a value over two lines is fixed on one; a value with " in it goes in single quotes', () => {
  assert.equal(
    issues('site.yaml', 'tagline: “Tide gauges\n  for small harbours”\n'),
    `site.yaml:1:10 W206 This value is in curly quotes (“ ”), which YAML doesn't read as quotes, so your site shows them. Use straight ones: tagline: "Tide gauges for small harbours"`,
  );
  assert.match(issues('site.yaml', 'kicker: “A 27" screen”\n'), / kicker: 'A 27" screen'$/);
});

test('quoted values, keys, numbers and block text are never checked', () => {
  assert.equal(issues('site.yaml', 'role: "“Measure twice.”"\nlocation: \'Harbor Point"\'\n“role”: x\nn: 42\nbio: |\n  “Quoted\n'), '');
});
