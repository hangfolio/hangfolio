// content/publications.bib through lib/bib.ts: the parser's options and the wrapper's fixes from
// spike S9 (findings 1 to 10), over the spike's torture file and edge cases. Every person, venue
// and address here is invented.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bibHtml, displayName, fold, isExampleEntry, isSelectedEntry, parseBib, readBib, withoutHiddenFields } from '../src/lib/bib.ts';

const SOURCE = String.raw`% A comment line { with braces }
@string{rv = "Vale, Rowan"}
@string{exc = "Proceedings of the Example Conference"}

@inproceedings{vale2024bounded,
  title     = {Bounded Staleness for {Edge} Caches},
  author    = rv # " and Investigator, Pat",
  booktitle = exc # " (EXC '24)",
  year      = 2024,
  pages     = {1--12},
  doi       = {10.5555/exc24_0001},
  code      = {https://example.org/~vale/code_v2#readme},
  slides    = {https://example.org/slides%20v2.pdf},
  pdf       = {vale2024bounded.pdf},
  example   = {true}
}

@article{broken2022comma,
  title  = {This Entry Is Missing a Comma}
  author = {Vale, Rowan},
  year   = {2022}
}

@article{nunez2023accents,
  author  = {N{\'u}{\~n}ez, Ana Luc{\'\i}a and Dvo{\v{r}}{\'a}k, Ji\v{r}\'{\i} and {The Example Consortium} and {van der} Berg, Lotte and Berg, Jr., Anders},
  title   = {Caf\'e, Na\"{\i}ve and \textit{R\'esum\'e}},
  journal = {Journal of Imaginary {\&} Example Results},
  year    = {2023}
}
@inproceedings{vale2025tail,
title={Taming tail latency in example systems},
author={Vale, Rowan and Hrub{\'y}, Tom{\'a}{\v{s}} and others},
booktitle={Proceedings of the 2025 Example Symposium on Systems},
year={2025}
}`;

const entries = parseBib(SOURCE);
const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry]));

test('every readable entry, in file order; the entry the parser gave up on is left out', () => {
  assert.deepEqual(entries.map((entry) => entry.key), ['vale2024bounded', 'nunez2023accents', 'vale2025tail']);
  assert.equal(byKey.vale2024bounded.type, 'inproceedings');
});

test('titles keep their case, and @string macros are resolved', () => {
  const entry = byKey.vale2024bounded;
  assert.equal(entry.fields.title, 'Bounded Staleness for Edge Caches');
  assert.equal(entry.fields.booktitle, "Proceedings of the Example Conference (EXC '24)");
  assert.equal(entry.fields.year, '2024');
  assert.equal(entry.fields.pages, '1–12');
  assert.deepEqual(entry.names.author, [{ given: 'Rowan', family: 'Vale' }, { given: 'Pat', family: 'Investigator' }]);
});

test('link fields stay byte for byte', () => {
  const { fields } = byKey.vale2024bounded;
  assert.equal(fields.code, 'https://example.org/~vale/code_v2#readme');
  assert.equal(fields.slides, 'https://example.org/slides%20v2.pdf');
  assert.equal(fields.doi, '10.5555/exc24_0001');
  assert.equal(fields.pdf, 'vale2024bounded.pdf');
});

test('accents come out composed (NFC), \\i included', () => {
  const entry = byKey.nunez2023accents;
  const names = entry.names.author.map(displayName);
  assert.deepEqual(names, ['Ana Lucía Núñez', 'Jiří Dvořák', 'The Example Consortium', 'Lotte van der Berg', 'Anders Berg Jr.']);
  for (const name of names) assert.equal(name, name.normalize('NFC'));
  assert.equal(entry.fields.title, 'Café, Naïve and <i>Résumé</i>');
  assert.equal(entry.fields.journal, 'Journal of Imaginary & Example Results');
  assert.equal(fold('Naïve ı́'), 'Naïve í');
});

test('"and others" is et al.', () => {
  const authors = byKey.vale2025tail.names.author;
  assert.deepEqual(authors.at(-1), { others: true });
  assert.deepEqual(authors.map(displayName), ['Rowan Vale', 'Tomáš Hrubý', 'et al.']);
});

test('example = {true} marks an example entry', () => {
  assert.equal(isExampleEntry(byKey.vale2024bounded), true);
  assert.equal(isExampleEntry(byKey.nunez2023accents), false);
});

test('bibHtml escapes the text and keeps only the formatting tags', () => {
  assert.equal(bibHtml('Café, Naïve and <i>Résumé</i>'), 'Café, Naïve and <i>Résumé</i>');
  assert.equal(bibHtml('a < b & "c" <b>d</b>'), 'a &lt; b &amp; &quot;c&quot; <b>d</b>');
  assert.equal(bibHtml('x<sup>2</sup> H<sub>2</sub>O'), 'x<sup>2</sup> H<sub>2</sub>O');
  assert.equal(bibHtml('<span style="font-variant:small-caps;">Small</span> caps'), '<span class="smallcaps">Small</span> caps');
  assert.equal(bibHtml('<span class="nocase">LRU</span> caches'), 'LRU caches');
  assert.equal(bibHtml('see <a href="https://example.org">the site</a>'), 'see the site');
  assert.equal(bibHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(bibHtml('<a href="javascript:x" onclick="y">z</a>'), 'z');
  assert.equal(bibHtml('<i>open <b>both'), '<i>open <b>both</b></i>');
  assert.equal(bibHtml('stray </b> close'), 'stray  close');
});

test('a file with no entries, or only comments, gives none', () => {
  assert.deepEqual(parseBib(''), []);
  assert.deepEqual(parseBib('% nothing yet\n@comment{ later }\n'), []);
});

// Spike S9's torture file and edge cases (test/fixtures/bib), which gate every parser upgrade.
const BIB = new URL('./fixtures/bib/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, BIB), 'utf8');
const torture = readBib(read('torture.bib'));
const tortureKey = (key: string) => torture.entries.find((entry) => entry.key === key)!;

test('torture: seven entries with their first and last lines; the broken one is W301 on its first line', () => {
  assert.deepEqual(
    torture.entries.map((entry) => `${entry.key} ${entry.line}-${entry.endLine}`),
    ['nunez2023accents 13-24', 'vale2024bounded 27-40', 'okafor2021nested 48-53', 'kjaer2020comment 55-62', 'exc24 64-71', 'vale2025tail 74-81', 'vale2019early 82-87'],
  );
  assert.deepEqual(torture.problems, [
    { line: 42, col: 1, key: 'broken2022comma', skipped: true, message: "Couldn't read the entry broken2022comma (a comma is missing at the end of line 43). It's skipped; the rest of the file is fine." },
  ]);
});

test('torture: the same with CRLF line ends and a byte order mark', () => {
  const crlf = readBib(`\uFEFF${read('torture.bib').replace(/\n/g, '\r\n')}`);
  assert.deepEqual(
    crlf.entries.map((entry) => [entry.key, entry.line, entry.endLine]),
    torture.entries.map((entry) => [entry.key, entry.line, entry.endLine]),
  );
  assert.deepEqual(crlf.problems.map((problem) => problem.line), [42]);
  assert.equal(crlf.entries[0].raw, torture.entries[0].raw.replace(/\n/g, '\r\n'));
});

test('torture: accents, @string, # concatenation, crossref, month macros, nested braces, comments inside entries', () => {
  const nunez = tortureKey('nunez2023accents');
  assert.deepEqual(nunez.names.author.map(displayName), ['Ana Lucía Núñez', 'Jörg Müller', 'François Garçon', 'Søren Østergaard', 'Jiří Dvořák', 'Ilse Straßer']);
  assert.equal(nunez.fields.title, 'Café, Naïve and Résumé: Études on Übersetzung — the α-Conversion');
  assert.equal(nunez.fields.journal, 'Journal of Imaginary & Example Results');
  assert.equal(nunez.fields.note, '“Quoted” text, en–dash, 50% off, §\u00a04, <i>italic</i> and <b>bold</b>');
  assert.equal(nunez.fields.pages, '101–117');
  assert.equal(nunez.fields.month, '9');

  const vale = tortureKey('vale2024bounded');
  assert.deepEqual(vale.names.author.map(displayName), ['Rowan Vale', 'Pat Investigator']);
  // Inherited from the @proceedings parent through crossref, which comes after it in the file
  assert.equal(vale.fields.booktitle, "Proceedings of the Example Conference (EXC '24)");
  assert.equal(vale.fields.publisher, 'Example University Press');
  assert.equal(vale.fields.year, '2024');
  assert.equal(vale.fields.address, undefined);
  assert.equal(vale.fields.url, 'https://example.org/papers/vale_2024%20final.pdf');

  const okafor = tortureKey('okafor2021nested');
  assert.equal(okafor.type, 'misc');
  assert.equal(okafor.fields.title, 'The GPU Kernel of Truth: Über-Nested Braces');
  assert.deepEqual(okafor.names.author.map(displayName), ['Chidi Okafor', 'Ren Ōta', 'The Example Consortium']);

  const kjaer = tortureKey('kjaer2020comment');
  assert.equal(kjaer.type, 'article');
  assert.equal(kjaer.fields.title, 'Comments Inside Entries');
  assert.deepEqual(kjaer.names.author.map(displayName), ['Søren Kjær', 'Lotte van der Berg', 'Anders Berg Jr.']);
  assert.equal(tortureKey('exc24').fields.address, 'Port Alder');
  assert.deepEqual(tortureKey('vale2025tail').names.author.map(displayName), ['Rowan Vale', 'Tomáš Hrubý', 'et al.']);
  for (const entry of torture.entries) for (const value of Object.values(entry.fields)) assert.equal(value, value.normalize('NFC'));
});

test('torture: the raw slice is the text as written, without abstract, file, keywords, annote or example', () => {
  assert.equal(
    tortureKey('vale2024bounded').raw,
    [
      '@inproceedings{vale2024bounded,',
      '  title     = {Bounded Staleness for {Edge} Caches},',
      '  author    = rv # " and Investigator, Pat",',
      '  crossref  = {exc24},',
      '  pages     = {1--12},',
      '  doi       = {10.5555/exc24_0001},',
      '  url       = {https://example.org/papers/vale_2024%20final.pdf},',
      '  month     = may # "~13--17",',
      '  selected  = {true}',
      '}',
    ].join('\n'),
  );
  // Stops at the closing brace, before the comment that follows the entry
  assert.ok(tortureKey('nunez2023accents').raw.endsWith('\\textbf{bold}},\n}'));
  assert.ok(tortureKey('okafor2021nested').raw.startsWith('@misc(okafor2021nested,') && tortureKey('okafor2021nested').raw.endsWith('"2021",\n)'));
  // The commented-out field stays; nothing is hidden, so the slice is the file's text
  const source = read('torture.bib');
  for (const key of ['kjaer2020comment', 'vale2025tail', 'vale2019early', 'exc24']) assert.ok(source.includes(tortureKey(key).raw), key);
  assert.match(tortureKey('kjaer2020comment').raw, /% TITLE = \{A commented-out title/);
});

test('hidden fields: each shape keeps the rest byte for byte and the commas right', () => {
  const cases: [string, string][] = [
    // the starter's shape: example first
    ['@inproceedings{k,\n  example   = {true},\n  title     = {T},\n  year      = {2024}\n}', '@inproceedings{k,\n  title     = {T},\n  year      = {2024}\n}'],
    // Scholar: the last field is hidden, so the comma before it goes
    ['@article{k,\ntitle={T},\nyear={2019},\nkeywords={a, b}\n}', '@article{k,\ntitle={T},\nyear={2019}\n}'],
    // one line, ( ) delimited, last field hidden
    ['@misc(k, title = {T}, abstract = {A, with a comma})', '@misc(k, title = {T})'],
    // one line, a field in the middle hidden
    ['@misc{k, title = {T}, file = {:x.pdf:PDF}, year = 2020}', '@misc{k, title = {T}, year = 2020}'],
    // a hidden field after a comment: the comment stays
    ['@article{k,\n  title = {T},\n  % notes for me\n  annote = {private},\n  year = {2020},\n}', '@article{k,\n  title = {T},\n  % notes for me\n  year = {2020},\n}'],
    // nothing hidden: unchanged, trailing comma and all
    ['@article{k,\n  title = "A {"}quoted{"} title",\n  year = {2020},\n}', '@article{k,\n  title = "A {"}quoted{"} title",\n  year = {2020},\n}'],
    // upper-case names, braces and commas inside values
    ['@ARTICLE{k,\n  ABSTRACT = {One, two {three, four}},\n  TITLE = {T}\n}', '@ARTICLE{k,\n  TITLE = {T}\n}'],
    // the only field hidden: the key keeps its comma
    ['@misc{k,\n  example = {true}\n}', '@misc{k,\n}'],
  ];
  for (const [raw, expected] of cases) assert.equal(withoutHiddenFields(raw), expected, raw);
});

test('edge cases: both neighbours survive every one, with W301 on the problem entry (line 7)', () => {
  const expected: Record<string, { keys: string[]; problems: string[] }> = {
    'e1-missing-comma': { keys: [], problems: ["7 Couldn't read the entry bad1 (a comma is missing at the end of line 8). It's skipped; the rest of the file is fine."] },
    'e2-unclosed-inner-brace': { keys: [], problems: ["7 Couldn't read the entry bad2 (a { is never closed). It's skipped; the rest of the file is fine."] },
    'e3-missing-entry-close': { keys: [], problems: ["7 Couldn't read the entry bad3 (its closing } is missing). It's skipped; the rest of the file is fine."] },
    'e4-unknown-command': {
      keys: ['odd4'],
      problems: ["8 The entry odd4 uses \\frobnicate, a LaTeX command the site doesn't know, so it shows as written.", "8 The entry odd4 uses \\unknowncmd, a LaTeX command the site doesn't know, so it shows as written."],
    },
    'e5-undefined-string': { keys: ['odd5'], problems: ['9 journal = undefinedjournal uses a @string that isn\'t defined, so it shows as "undefinedjournal". Put the text in braces, journal = {…}, or define it first: @string{undefinedjournal = {…}}.'] },
    'e6-comment-with-email': { keys: ['fine6'], problems: [] },
    'e7-free-text-email': { keys: ['fine7'], problems: ['7 Line 7 has an @ outside an entry, and BibTeX reads every @ as the start of one. Put % at the start of the line to make it a comment, or remove the @.'] },
    // The checks report the second key as E303; the first entry wins.
    'e8-duplicate-key': { keys: [], problems: [] },
    'e9-no-key': { keys: [], problems: ['7 This entry has no key, so it is skipped. Add one after the opening brace, like @article{vale2024,'] },
    'e10-unclosed-math': { keys: [], problems: ["7 Couldn't read the entry bad10 (a $ on line 8 is never closed). It's skipped; the rest of the file is fine."] },
    // One W301: the address inside the broken entry is not a second problem.
    'e11-email-after-error': { keys: [], problems: ["7 Couldn't read the entry bad11 (a comma is missing at the end of line 8). It's skipped; the rest of the file is fine."] },
    'e12-no-equals': { keys: [], problems: ["7 Couldn't read the entry bad12 (a field on line 8 has no = after its name). It's skipped; the rest of the file is fine."] },
    'e13-unclosed-quote': { keys: [], problems: ["7 Couldn't read the entry bad13 (a \" is never closed). It's skipped; the rest of the file is fine."] },
    'e15-string-unclosed-math': { keys: ['odd15'], problems: [] },
    'e16-begin-no-end': { keys: ['odd16'], problems: ["8 The entry odd16 uses \\begin, a LaTeX command the site doesn't know, so it shows as written."] },
    'e17-accent-no-argument': { keys: ['odd17'], problems: [] },
    'e18-extra-brace': { keys: ['bad18'], problems: ['7 The entry bad18 ends early: line 8 has one } too many, so the fields after it are left out. Remove the extra }.'] },
  };
  for (const [name, want] of Object.entries(expected)) {
    const { entries, problems } = readBib(read(`${name}.bib`));
    assert.deepEqual(entries.map((entry) => entry.key), ['before2020', ...want.keys, 'after2021'], name);
    assert.deepEqual(problems.map((problem) => `${problem.line} ${problem.message}`), want.problems, name);
  }
});

test('an unknown LaTeX command stays in the text as written', () => {
  const [, odd] = readBib(read('e4-unknown-command.bib')).entries;
  assert.equal(odd.fields.title, 'A \\frobnicatex and \\unknowncmdTitle');
});

test('selected = {true} marks a paper for the home page', () => {
  assert.equal(isSelectedEntry(tortureKey('vale2024bounded')), true);
  assert.equal(isSelectedEntry(tortureKey('vale2025tail')), false);
});
