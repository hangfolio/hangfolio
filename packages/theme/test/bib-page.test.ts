// The publications page's data (lib/bib-page.ts): a paper's view with its ids, DOI line, links
// and BibTeX block; the groups and their order; in-preparation items; the papers the home page
// features; ScholarlyArticle JSON-LD; and whether the page has anything to show
// (lib/bib-file.ts). Every person, venue and address here is invented.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { hasPublicationContent } from '../src/lib/bib-file.ts';
import { featuredKeys, groupOf, listedEntries, paperGroups, paperView, prepViews, publicationsPath, scholarlyArticle } from '../src/lib/bib-page.ts';
import { parseBib } from '../src/lib/bib.ts';
import { availablePages, navItems } from '../src/lib/nav.ts';
import { publicationsRoute } from '../src/lib/routes.ts';
import { publication } from '../src/schema/publication.ts';
import { site as siteSchema } from '../src/schema/site.ts';
import { parseOk } from './helpers.ts';

const site = parseOk(siteSchema, { name: 'Wren Halloway', email: 'wren@halloway.test', links: [{ url: 'https://example.org/scholar', label: 'Scholar' }] });

const entries = parseBib(String.raw`@string{exs = "Proceedings of the Example Symposium"}
@inproceedings{halloway2024drift,
  title     = {Drift in \textit{Remote} Caches},
  author    = {Okonkwo, Adaeze and Halloway, W. and Lindqvist, Bj{\"o}rn},
  booktitle = exs # " (EXS '24)",
  publisher = {Example Press},
  year      = {2024},
  month     = may,
  pages     = {101--114},
  doi       = {10.5555/exs24.0042},
  url       = {https://doi.org/10.5555/exs24.0042},
  pdf       = {drift.pdf},
  abbr      = {EXS ’24},
  abstract  = {Not shown in the block.}
}
@article{halloway2022quay,
title={Offline package mirrors},
author={Halloway, Wren and others},
journal={Journal of Example Engineering},
year={2022},
selected={true}
}
@article{halloway2025tail,
title={Tail latency, again},
author={Halloway, Wren},
journal={arXiv preprint arXiv:2501.00001},
year={2025}
}
@phdthesis{halloway2023thesis,
  title  = {Caches That Explain Themselves},
  author = {Halloway, Wren},
  school = {Institute of Example Studies},
  year   = {2023}
}
@misc{halloway2026note,
  title = {A Note},
  author = {Halloway, Wren},
  year = {2026}
}`);
const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry]));
const extras = parseOk(publication, {
  equal: ['Okonkwo', 'Halloway'],
  authorNote: '*Co-first authors',
  venueDetail: 'The Example Symposium (EXS ’24)',
  place: 'Kestrel Harbour, June 2–6, 2024',
  anchor: 'exs24',
  bibtexAnchor: 'bibtex',
  data: { text: '9,400 phones · **six** countries' },
  links: [{ label: 'Google Scholar', profile: 'scholar' }],
  featured: true,
});

test('a paper: ids from extras, the DOI on its own line, the links without it, and [BibTeX] last', () => {
  const view = paperView(byKey.halloway2024drift, extras, site);
  assert.equal(view.anchor, 'exs24');
  assert.equal(view.bibtexAnchor, 'bibtex');
  assert.equal(view.title, 'Drift in <i>Remote</i> Caches');
  assert.equal(view.year, '2024');
  assert.equal(view.abbr, 'EXS ’24');
  assert.deepEqual(view.authors, [
    { name: 'Adaeze Okonkwo', me: false, equal: true },
    { name: 'W. Halloway', me: true, equal: true },
    { name: 'Björn Lindqvist', me: false, equal: false },
  ]);
  assert.equal(view.note, '*Co-first authors');
  assert.equal(view.venue, 'The Example Symposium (EXS ’24)');
  assert.equal(view.place, 'Kestrel Harbour, June 2–6, 2024');
  assert.deepEqual(view.doi, { text: '10.5555/exs24.0042', href: 'https://doi.org/10.5555/exs24.0042' });
  // The url field is the DOI's address, so it is not listed again.
  assert.deepEqual(view.links, [
    { label: 'PDF', href: '/files/drift.pdf' },
    { label: 'Google Scholar', href: 'https://example.org/scholar' },
    { label: 'BibTeX', href: '#bibtex' },
  ]);
  assert.deepEqual(view.data, { tag: 'Data', text: '9,400 phones · **six** countries' });
  assert.equal(view.bibtexLabel, 'BibTeX entry for the EXS ’24 paper');
  assert.doesNotMatch(view.bibtex, /abstract/);
  assert.match(view.bibtex, /^@inproceedings\{halloway2024drift,\n {2}title {5}= \{Drift in \\textit\{Remote\} Caches\},/);
});

test('without extras: the key is the anchor, bibtex-<key> the block, the venue from BibTeX', () => {
  const view = paperView(byKey.halloway2022quay, undefined, site);
  assert.equal(view.anchor, 'halloway2022quay');
  assert.equal(view.bibtexAnchor, 'bibtex-halloway2022quay');
  assert.equal(view.venue, 'Journal of Example Engineering');
  assert.equal(view.doi, undefined);
  assert.deepEqual(view.links, [{ label: 'BibTeX', href: '#bibtex-halloway2022quay' }]);
  assert.equal(view.bibtexLabel, 'BibTeX entry for “Offline package mirrors”');
  assert.deepEqual(view.authors.map((a) => [a.name, a.me]), [['Wren Halloway', true], ['et al.', false]]);
});

test('groups: by kind, in a fixed order, each newest first; an arXiv "journal" is a preprint', () => {
  assert.equal(groupOf(byKey.halloway2025tail), 'preprints');
  assert.equal(groupOf(byKey.halloway2022quay), 'journal');
  const groups = paperGroups(entries, new Map([['halloway2024drift', extras]]), site);
  assert.deepEqual(
    groups.map((group) => [group.id, group.heading, group.papers.map((paper) => paper.key)]),
    [
      ['conference', 'Conference papers', ['halloway2024drift']],
      ['journal', 'Journal articles', ['halloway2022quay']],
      ['preprints', 'Preprints and reports', ['halloway2026note', 'halloway2025tail']],
      ['theses', 'Theses', ['halloway2023thesis']],
    ],
  );
});

test('a crossref parent is not listed as a paper, unless the owner edited it', () => {
  const entries = parseBib(`
@inproceedings{halloway2024a, title = {A}, author = {Halloway, Wren}, crossref = {EXC24}, year = 2024}
@proceedings{exc24, title = {Proceedings of EXC}, editor = {Chair, Program}, year = 2024}
@inproceedings{halloway2023b, title = {B}, author = {Halloway, Wren}, crossref = {wsx23}, year = 2023}
@proceedings{wsx23, title = {Proceedings of WSX}, editor = {Halloway, W.}, year = 2023}`);
  assert.deepEqual(listedEntries(entries, site).map((entry) => entry.key), ['halloway2024a', 'halloway2023b', 'wsx23']);
  assert.deepEqual(paperGroups(entries, new Map(), site).map((group) => `${group.id}: ${group.papers.map((paper) => paper.key).join(' ')}`), ['conference: halloway2024a halloway2023b', 'books: wsx23']);
});

test('in-preparation items: by order, numbered, text kept as written, the owner marked among the authors', () => {
  const item = (order: number, title: string, more = {}) => parseOk(publication, { status: 'in-preparation', order, title, text: `About *${title}*.`, ...more });
  const views = prepViews(
    [
      { id: 'b', data: item(2, 'Second') as never },
      { id: 'a', data: item(1, 'First', { margin: 'Rust · C', chip: 'Venue 2027 · in preparation', authors: ['Wren Halloway', { name: 'Ada Advisor', url: 'https://example.org/ada' }] }) as never },
    ],
    site,
  );
  assert.deepEqual(views, [
    {
      id: 'a',
      number: '01',
      margin: 'Rust · C',
      title: 'First',
      chip: 'Venue 2027 · in preparation',
      authors: [
        { name: 'Wren Halloway', me: true },
        { name: 'Ada Advisor', url: 'https://example.org/ada', me: false },
      ],
      text: 'About *First*.',
    },
    { id: 'b', number: '02', margin: undefined, title: 'Second', chip: undefined, authors: [], text: 'About *Second*.' },
  ]);
});

test('featured on the home page: research.featured first, then selected = {true} or featured: true, newest first', () => {
  const marks = new Map([['halloway2024drift', { featured: true }]]);
  assert.deepEqual(featuredKeys(entries, marks), ['halloway2024drift', 'halloway2022quay']);
  assert.deepEqual(featuredKeys(entries, marks, 'halloway2023thesis'), ['halloway2023thesis', 'halloway2024drift', 'halloway2022quay']);
  assert.deepEqual(featuredKeys(entries, new Map(), 'halloway2022quay'), ['halloway2022quay']);
  assert.deepEqual(featuredKeys(entries, new Map(), 'no-such-key'), ['halloway2022quay']);
});

test('ScholarlyArticle: from the BibTeX fields, the owner as the site Person, and extras.schema on top', () => {
  const urls = { page: 'https://u.github.io/hangfolio/publications', home: 'https://u.github.io/hangfolio/' };
  assert.deepEqual(scholarlyArticle(byKey.halloway2024drift, extras, site, urls), {
    '@type': 'ScholarlyArticle',
    '@id': 'https://u.github.io/hangfolio/publications#exs24',
    headline: 'Drift in Remote Caches',
    name: 'Drift in Remote Caches',
    author: [{ '@type': 'Person', name: 'Adaeze Okonkwo' }, { '@id': 'https://u.github.io/hangfolio/#person' }, { '@type': 'Person', name: 'Björn Lindqvist' }],
    datePublished: '2024-05',
    publisher: { '@type': 'Organization', name: 'Example Press' },
    pagination: '101-114',
    identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: '10.5555/exs24.0042' },
    sameAs: 'https://doi.org/10.5555/exs24.0042',
    url: 'https://u.github.io/hangfolio/publications',
  });
  const plain = scholarlyArticle(byKey.halloway2022quay, parseOk(publication, { schema: { '@type': 'Article', inLanguage: 'en' } }) as never, site, urls);
  assert.deepEqual(plain, {
    '@type': 'Article',
    '@id': 'https://u.github.io/hangfolio/publications#halloway2022quay',
    headline: 'Offline package mirrors',
    name: 'Offline package mirrors',
    author: [{ '@id': 'https://u.github.io/hangfolio/#person' }],
    datePublished: '2022',
    url: 'https://u.github.io/hangfolio/publications',
    inLanguage: 'en',
  });
});

test('the page exists while it is on and has a paper or an in-preparation item', () => {
  assert.equal(publicationsPath(site, { papers: 1, prep: 0 }), '/publications');
  assert.equal(publicationsPath(site, { papers: 0, prep: 2 }), '/publications');
  assert.equal(publicationsPath(site, { papers: 0, prep: 0 }), undefined);
  const moved = parseOk(siteSchema, { name: 'W', email: 'w@h.test', pages: { publications: { path: '/papers/' } } });
  assert.equal(publicationsPath(moved, { papers: 1, prep: 0 }), '/papers/');
  const off = parseOk(siteSchema, { name: 'W', email: 'w@h.test', pages: { publications: false } });
  assert.equal(publicationsPath(off, { papers: 3, prep: 0 }), undefined);
});

test('the nav links to the page while it has something to show, at its path', () => {
  // The contact page is always on (M4), so it follows in the default nav.
  const contact = { key: 'contact', label: 'Contact', href: '/contact' };
  assert.deepEqual(navItems(site, availablePages(site, { publications: true })), [{ key: 'publications', label: 'Publications', href: '/publications' }, contact]);
  assert.deepEqual(navItems(site, availablePages(site, { publications: false })), [contact]);
  const moved = parseOk(siteSchema, { name: 'W', email: 'w@h.test', pages: { publications: { path: '/papers/' } }, nav: ['publications', 'research'] });
  assert.deepEqual(navItems(moved, availablePages(moved, { research: true, publications: true })), [
    { key: 'publications', label: 'Publications', href: '/papers/' },
    { key: 'research', label: 'Research', href: '/#research' },
  ]);
  const off = parseOk(siteSchema, { name: 'W', email: 'w@h.test', pages: { publications: false } });
  assert.deepEqual(navItems(off, availablePages(off, { publications: true })), [contact]);
});

test('the route: at the page path, only when shown; a path ending in / is a folder', () => {
  assert.deepEqual(publicationsRoute(site, true), [{ pattern: '/publications', entry: 'publications.astro', dir: false }]);
  assert.deepEqual(publicationsRoute(site, false), []);
  const moved = parseOk(siteSchema, { name: 'W', email: 'w@h.test', pages: { publications: { path: '/research/papers/' } } });
  assert.deepEqual(publicationsRoute(moved, true), [{ pattern: '/research/papers', entry: 'publications.astro', dir: true }]);
  const off = parseOk(siteSchema, { name: 'W', email: 'w@h.test', pages: { publications: false } });
  assert.deepEqual(publicationsRoute(off, true), []);
});

const work = mkdtempSync(join(tmpdir(), 'hangfolio-bib-page-'));
after(() => rmSync(work, { recursive: true, force: true }));

test('content for the page, read from the files: example entries count only in demo mode', () => {
  const site = (name: string, files: Record<string, string>) => {
    const root = join(work, name);
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    return root;
  };
  const none = site('none', {});
  assert.equal(hasPublicationContent(none, false), false);
  const example = site('example', { 'content/publications.bib': '@misc{a,\n  example = {true},\n  title = {A}\n}\n' });
  assert.equal(hasPublicationContent(example, false), false);
  assert.equal(hasPublicationContent(example, true), true);
  const broken = site('broken', { 'content/publications.bib': '@misc{a,\n  title = {A}\n  year = {2020}\n}\n' });
  assert.equal(hasPublicationContent(broken, false), false);
  const prep = site('prep', {
    'content/publications/draft.md': '---\nstatus: in-preparation\norder: 1\ntitle: "Draft"\ntext: "Soon."\n---\n',
    'content/publications/extras.md': '---\nplace: "Lisbon"\n---\n',
  });
  assert.equal(hasPublicationContent(prep, false), true);
  const prepExample = site('prep-example', { 'content/publications/draft.md': '---\nexample: true\nstatus: in-preparation\norder: 1\ntitle: "Draft"\ntext: "Soon."\n---\n' });
  assert.equal(hasPublicationContent(prepExample, false), false);
  assert.equal(hasPublicationContent(prepExample, true), true);
});
