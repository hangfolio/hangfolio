// A paper as a citation (lib/citation.ts): who counts as the site owner, equal-contribution
// marks, the title's full stop, the venue, and the links from BibTeX and the extras file.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBib } from '../src/lib/bib.ts';
import { citationView, isOwner, isUnsafeHref, linkHref, ownerNames, personOf } from '../src/lib/citation.ts';
import { publication } from '../src/schema/publication.ts';
import { site as siteSchema } from '../src/schema/site.ts';
import { parseOk } from './helpers.ts';

const site = parseOk(siteSchema, {
  name: 'Rowan Vale',
  email: 'rowan@vale.test',
  nameVariants: ['Vale, R. J.'],
  links: [{ url: 'https://example.org/notes', label: 'Notes' }],
});
const owner = ownerNames(site);

test('the owner: family name, and a first name that agrees, where an initial matches a whole name', () => {
  assert.deepEqual(personOf('Rowan Vale'), { given: ['rowan'], family: 'vale' });
  assert.deepEqual(personOf('Vale, R. J.'), { given: ['r', 'j'], family: 'vale' });
  assert.equal(isOwner({ given: 'Rowan', family: 'Vale' }, owner), true);
  assert.equal(isOwner({ given: 'R.', family: 'Vale' }, owner), true);
  assert.equal(isOwner({ given: 'R. J.', family: 'Vale' }, owner), true);
  // The variant "Vale, R. J." stands for any R. Vale; without it, Robin Vale is someone else.
  assert.equal(isOwner({ given: 'Robin', family: 'Vale' }, owner), true);
  assert.equal(isOwner({ given: 'Robin', family: 'Vale' }, ownerNames({ ...site, nameVariants: [] })), false);
  assert.equal(isOwner({ given: 'Rowan', family: 'Vane' }, owner), false);
  assert.equal(isOwner({ literal: 'Rowan Vale' }, owner), true);
  assert.equal(isOwner({ others: true }, owner), false);
});

test('accents and case are set aside, and advanced.nameParts sets the family name', () => {
  const accented = parseOk(siteSchema, { name: 'Zoë Núñez García', email: 'z@n.test', advanced: { nameParts: { given: 'Zoë', family: 'Núñez García' } } });
  const names = ownerNames(accented);
  assert.equal(isOwner({ given: 'Zoe', family: 'Nunez Garcia' }, names), true);
  assert.equal(isOwner({ given: 'Z.', family: 'NÚÑEZ GARCÍA' }, names), true);
  assert.equal(isOwner({ given: 'Zoë Núñez', family: 'García' }, names), false);
});

test('author matching: "Last, First" or "First Last", initials, accents and letters such as ø and ß', () => {
  const names = ownerNames(parseOk(siteSchema, { name: 'Søren Straßer', email: 's@s.test' }));
  for (const author of [
    { given: 'Søren', family: 'Straßer' },
    { given: 'Soren', family: 'Strasser' },
    { given: 'S.', family: 'STRASSER' },
    { literal: 'Søren Straßer' },
    { literal: 'Strasser, S.' },
  ]) {
    assert.equal(isOwner(author, names), true, JSON.stringify(author));
  }
  assert.equal(isOwner({ given: 'Sara', family: 'Strasser' }, names), false);
});

test('author matching: a family name of several words, a prefix and a suffix', () => {
  const garcia = ownerNames(parseOk(siteSchema, { name: 'Gabriel García Márquez', email: 'g@g.test' }));
  assert.equal(isOwner({ given: 'Gabriel', family: 'García Márquez' }, garcia), true);
  assert.equal(isOwner({ given: 'G.', family: 'Garcia Marquez' }, garcia), true);
  assert.equal(isOwner({ given: 'Gabriel García', family: 'Márquez' }, garcia), true);
  assert.equal(isOwner({ given: 'Ana', family: 'García Márquez' }, garcia), false);

  const berg = ownerNames(parseOk(siteSchema, { name: 'Lotte van der Berg', email: 'l@b.test' }));
  assert.equal(isOwner({ given: 'Lotte', prefix: 'van der', family: 'Berg' }, berg), true);
  assert.equal(isOwner({ given: 'L.', family: 'Berg' }, berg), true);

  const junior = ownerNames(parseOk(siteSchema, { name: 'Anders Berg Jr.', email: 'a@b.test' }));
  assert.equal(isOwner({ given: 'Anders', family: 'Berg', suffix: 'Jr.' }, junior), true);
});

test('author matching: nameVariants add other spellings', () => {
  const names = ownerNames(parseOk(siteSchema, { name: 'Mei Tanabe', email: 'm@t.test', nameVariants: ['Tanabe-Ross, Mei', 'M. Ross'] }));
  assert.equal(isOwner({ given: 'Mei', family: 'Tanabe-Ross' }, names), true);
  assert.equal(isOwner({ given: 'M', family: 'Ross' }, names), true);
  assert.equal(isOwner({ given: 'Mei', family: 'Tanabe' }, names), true);
  assert.equal(isOwner({ given: 'Mei', family: 'Rossi' }, names), false);
});

test('link fields: a DOI goes to doi.org, a bare file name to /files/, anything else as written', () => {
  assert.equal(linkHref('doi', '10.5555/x'), 'https://doi.org/10.5555/x');
  assert.equal(linkHref('doi', 'doi:10.5555/x'), 'https://doi.org/10.5555/x');
  assert.equal(linkHref('doi', 'https://doi.org/10.5555/x'), 'https://doi.org/10.5555/x');
  assert.equal(linkHref('pdf', 'paper.pdf'), '/files/paper.pdf');
  assert.equal(linkHref('pdf', '/papers/paper.pdf'), '/papers/paper.pdf');
  assert.equal(linkHref('pdf', 'files/paper.pdf'), 'files/paper.pdf');
  assert.equal(linkHref('code', 'https://example.org/code'), 'https://example.org/code');
  assert.equal(linkHref('code', 'www.example.org/code'), 'https://www.example.org/code');
});

test('a link field with a scheme that runs code is left out', () => {
  const [bad] = parseBib('@misc{k, title = {T}, url = {javascript:alert(1)}, code = {https://example.org/code}, slides = { JavaScript:x}}');
  assert.equal(isUnsafeHref('data:text/html,x'), true);
  assert.deepEqual(citationView(bad, undefined, site).links, [{ label: 'Code', href: 'https://example.org/code' }]);
});

const [entry, scholar] = parseBib(String.raw`
@inproceedings{vale2024bounded,
  title     = {Bounded Staleness for \textit{Edge} Caches},
  author    = {Author, Ada and Vale, Rowan and Investigator, Pat},
  booktitle = {Proceedings of the Example Conference (EXC '24)},
  year      = {2024},
  doi       = {10.5555/exc24.0001},
  url       = {https://doi.org/10.5555/exc24.0001},
  pdf       = {vale2024bounded.pdf},
  code      = {https://example.org/code},
  slides    = {https://example.org/slides.pdf}
}
@article{vale2025tail,
title={Is tail latency fixable?},
author={Vale, R. and Hrub{\'y}, Tom{\'a}{\v{s}} and others},
journal={Journal of Example Systems},
year={2025}
}`);

test('a citation: the owner and equal marks, title with a full stop, venue, place, note and links', () => {
  const extras = parseOk(publication, {
    equal: ['author', 'Vale'],
    place: 'Lisbon, May 13–17, 2024',
    links: [{ label: 'Talk', url: 'https://example.org/talk' }, { label: 'Notes', profile: 'notes' }, { label: 'Gone', profile: 'nope' }],
  });
  assert.deepEqual(citationView(entry, extras, site), {
    year: '2024',
    authors: [
      { name: 'Ada Author', me: false, equal: true },
      { name: 'Rowan Vale', me: true, equal: true },
      { name: 'Pat Investigator', me: false, equal: false },
    ],
    title: 'Bounded Staleness for <i>Edge</i> Caches.',
    venue: "Proceedings of the Example Conference (EXC '24)",
    place: 'Lisbon, May 13–17, 2024',
    note: '*Equal contribution',
    links: [
      { label: 'PDF', href: '/files/vale2024bounded.pdf' },
      { label: 'DOI', href: 'https://doi.org/10.5555/exc24.0001' },
      { label: 'Code', href: 'https://example.org/code' },
      { label: 'Slides', href: 'https://example.org/slides.pdf' },
      { label: 'Talk', href: 'https://example.org/talk' },
      { label: 'Notes', href: 'https://example.org/notes' },
    ],
  });
});

test('without extras: no note, the journal as the venue, a question mark kept, et al. at the end', () => {
  const view = citationView(scholar, undefined, site);
  assert.deepEqual(view.authors, [
    { name: 'R. Vale', me: true, equal: false },
    { name: 'Tomáš Hrubý', me: false, equal: false },
    { name: 'et al.', me: false, equal: false },
  ]);
  assert.equal(view.title, 'Is tail latency fixable?');
  assert.equal(view.venue, 'Journal of Example Systems');
  assert.equal(view.note, undefined);
  assert.deepEqual(view.links, []);
});

test('venueDetail replaces the venue, escaped; authorNote replaces the note', () => {
  const extras = parseOk(publication, { equal: ['Investigator'], authorNote: '*Co-first authors', venueDetail: 'EXC ’24 <Best Paper>' });
  const view = citationView(entry, extras, site);
  assert.equal(view.venue, 'EXC ’24 &lt;Best Paper&gt;');
  assert.equal(view.note, '*Co-first authors');
});
