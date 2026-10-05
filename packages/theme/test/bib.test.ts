// content/publications.bib through lib/bib.ts: the parser's options and the wrapper's fixes from
// spike S9 (findings 1, 2, 6, 7, 8 and 9). Every person, venue and address here is invented.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bibHtml, displayName, fold, isExampleEntry, parseBib } from '../src/lib/bib.ts';

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
