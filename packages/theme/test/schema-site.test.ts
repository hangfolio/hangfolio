// site.yaml (SPEC 5.3) with the card additions (SPEC-card-wallet.md 3.2): defaults, shorthands,
// page paths and the checks the schema makes itself.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { site } from '../src/schema/site.ts';
import { issuesOf, parseOk } from './helpers.ts';

const REPO = new URL('../../../', import.meta.url);
const minimal = { name: 'Wren Halloway', email: 'wren@halloway.test' };

test('name and email are all a site needs (fixtures/empty)', () => {
  assert.deepEqual(issuesOf(site, {}), ['name invalid_type: Invalid input: expected string, received undefined', 'email invalid_type: Invalid input: expected string, received undefined']);
  assert.deepEqual(issuesOf(site, minimal), []);
});

test('defaults for a site with only name and email', () => {
  const parsed = parseOk(site, minimal);
  assert.deepEqual(parsed, {
    ...minimal,
    nameVariants: [],
    links: [],
    redirects: [],
    avatarAlt: 'Portrait of Wren Halloway',
    pages: {
      projects: { path: '/projects' },
      publications: { path: '/publications' },
      experience: { path: '/experience' },
      writing: { path: '/writing/' },
      contact: { path: '/contact' },
      meet: { path: '/meet' },
      card: false,
      notFound: {},
    },
    advanced: {
      urlFormat: 'preserve',
      trailingSlash: 'ignore',
      lang: 'en',
      locale: 'en_US',
      timezone: 'UTC',
      titleSuffix: ' — {name}',
      writingPath: '/writing',
      feed: { path: '/feed.xml', title: '{name} — Writing' },
      sitemapAliases: [],
      anchors: {
        highlights: 'results',
        work: 'work',
        research: 'research',
        experience: 'exp',
        education: 'education',
        news: 'news',
        writing: 'writing',
        contact: 'contact',
      },
      labels: { minRead: 'min read', allWriting: '← All writing', now: 'Now:', src: 'src ·' },
      footer: { links: [], showUpdated: true },
    },
  });
});

test('links: bare URLs, labels from the host, flags on by default, ids from labels', () => {
  const { links } = parseOk(site, {
    ...minimal,
    links: [
      'https://github.com/someone',
      { url: 'https://orcid.org/0000-0002-1825-0097', label: 'ORCID iD' },
      { url: 'https://www.linkedin.com/in/someone', contact: false, id: 'LI' },
      'mailto:wren@halloway.test',
    ],
  });
  assert.deepEqual(links, [
    { url: 'https://github.com/someone', label: 'GitHub', id: 'github', hero: true, contact: true, footer: true },
    { url: 'https://orcid.org/0000-0002-1825-0097', label: 'ORCID iD', id: 'orcid-id', hero: true, contact: true, footer: true },
    { url: 'https://www.linkedin.com/in/someone', label: 'LinkedIn', id: 'li', hero: true, contact: false, footer: true },
    { url: 'mailto:wren@halloway.test', label: 'Email', id: 'email', hero: true, contact: true, footer: true },
  ]);
});

test('links: inferred ids are numbered when taken; two written ids that match are E303', () => {
  const { links } = parseOk(site, {
    ...minimal,
    links: ['https://github.com/me', 'https://github.com/my-lab', { url: 'https://gitlab.com/me', id: 'GitHub' }],
  });
  assert.deepEqual(links.map((link) => link.id), ['github-2', 'github-3', 'github']);
  assert.deepEqual(
    issuesOf(site, { ...minimal, links: [{ url: 'https://github.com/a', id: 'code' }, { url: 'https://gitlab.com/b', id: 'Code' }] }),
    ["links.1.id E303: 'code' is already used by link 1; give each link its own id"],
  );
  assert.deepEqual(issuesOf(site, { ...minimal, links: ['/files/cv.pdf'] }), [
    "links.0 E202: must be a full address starting with https:// (you wrote '/files/cv.pdf')",
  ]);
});

test('affiliation as a string, and the other shorthands in site.yaml', () => {
  const parsed = parseOk(site, {
    ...minimal,
    affiliation: 'Institute of Example Studies',
    theme: { accent: '#2C5AA0' },
    booking: { calcom: 'https://cal.com/wren/30min' },
    availability: { headline: 'Open to collaborations.', until: 2027 },
  });
  assert.deepEqual(parsed.affiliation, { name: 'Institute of Example Studies' });
  assert.deepEqual(parsed.theme, { accent: { light: '#2c5aa0' } });
  assert.deepEqual(parsed.booking, {
    calcom: 'wren/30min',
    label: 'Book a 1:1',
    path: '/meet',
    emailSubject: 'Meeting request',
    keepPageWhenOff: false,
  });
  assert.deepEqual(parsed.availability, { headline: 'Open to collaborations.', until: '2027' });
});

test('booking needs calcom or link, not both; neither only to keep the page while booking is paused', () => {
  const PAUSE =
    'booking E202: needs one of calcom or link. To pause booking but keep the page (it then points to email), add keepPageWhenOff: true; to turn booking off, delete the whole booking block';
  assert.deepEqual(issuesOf(site, { ...minimal, booking: { label: 'Talk to me' } }), [PAUSE]);
  assert.deepEqual(parseOk(site, { ...minimal, booking: { keepPageWhenOff: true } }).booking, {
    label: 'Book a 1:1',
    path: '/meet',
    emailSubject: 'Meeting request',
    keepPageWhenOff: true,
  });
  assert.deepEqual(issuesOf(site, { ...minimal, booking: { keepPageWhenOff: false } }), [PAUSE]);
  assert.deepEqual(issuesOf(site, { ...minimal, booking: { calcom: 'a/b', link: 'https://example.org/book' } }), [
    'booking E202: needs only one of calcom or link, but has calcom and link',
  ]);
  assert.deepEqual(parseOk(site, { ...minimal, booking: { link: 'https://example.org/book', path: 'book' } }).pages.meet, { path: '/book' });
});

test('pages.card: off unless turned on (deferred past v0.1), and a path moves it (PLAN M2 acceptance)', () => {
  assert.equal(parseOk(site, minimal).pages.card, false);
  assert.equal(parseOk(site, { ...minimal, pages: { card: false } }).pages.card, false);
  assert.deepEqual(parseOk(site, { ...minimal, pages: { card: { path: '/qr' } } }).pages.card, { path: '/qr' });
  assert.deepEqual(parseOk(site, { ...minimal, pages: { card: { title: 'Card', lede: 'Scan me.' } } }).pages.card, {
    title: 'Card',
    lede: 'Scan me.',
    path: '/card',
  });
  assert.deepEqual(parseOk(site, { ...minimal, pages: { card: true } }).pages.card, { path: '/card' });
});

test('pages: overrides, the writing path, and publications.prepAside', () => {
  const { pages } = parseOk(site, {
    ...minimal,
    advanced: { writingPath: '/notes/' },
    pages: { projects: { path: '/work', heading: 'Work' }, publications: { prepAside: 'Drafts on request.' }, meet: false, notFound: { title: 'Lost' } },
  });
  assert.deepEqual(pages.projects, { path: '/work', heading: 'Work' });
  assert.deepEqual(pages.publications, { path: '/publications', prepAside: 'Drafts on request.' });
  assert.deepEqual(pages.writing, { path: '/notes/' });
  assert.equal(pages.meet, false);
  assert.deepEqual(pages.notFound, { title: 'Lost' });
  assert.deepEqual(issuesOf(site, { ...minimal, pages: { notFound: { path: '/missing' } } }).map((line) => line.split(':')[0]), [
    'pages.notFound unrecognized_keys',
  ]);
});

test('two pages at one path are E303, reported where the path was written', () => {
  assert.deepEqual(issuesOf(site, { ...minimal, pages: { card: { path: '/projects' } } }), [
    "pages.card.path E303: is also the address of the projects page ('/projects'); give each page its own path",
  ]);
  // the card page is off by default, so its path is free
  assert.deepEqual(issuesOf(site, { ...minimal, pages: { projects: { path: '/card/' } } }), []);
  assert.deepEqual(issuesOf(site, { ...minimal, pages: { card: true, projects: { path: '/card/' } } }), [
    "pages.projects.path E303: is also the address of the card page ('/card'); give each page its own path",
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, pages: { card: { path: '/' } } }), [
    "pages.card.path E303: is also the address of the home page ('/'); give each page its own path",
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/projects.html', to: '/' }] }), [
    "redirects.0.from E303: is also the address of the projects page ('/projects.html'); give each page its own path",
  ]);
  // a redirect writes exactly its file: /about.html and /about/ are two files; /about and /about.html are one
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/about.html', to: '/' }, { from: '/about/', to: '/' }] }), []);
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/about.html', to: '/' }, { from: 'about', to: '/' }] }), [
    "redirects.1.from E303: writes the same file as redirect 1 (about.html); give each redirect its own path",
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/contact/', to: '/' }] }), [
    "redirects.0.from E303: is also the address of the contact page ('/contact/'); give each page its own path",
  ]);
  // a redirect is a page, so it can't stand in for a PDF or a feed; .htm, /x/ and extensionless are pages
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/about.htm', to: '/' }, { from: '/v1.2/notes', to: '/' }, { from: '/old/', to: '/' }] }), []);
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/files/old-cv.pdf', to: '/files/cv.pdf' }, { from: '/feed.XML', to: '/' }] }), [
    "redirects.0.from E202: must be a page address like /about, /about/ or /about.html, because a redirect can't stand in for a .pdf file. To keep an old file's address working, put the file itself at that path in public/ (you wrote '/files/old-cv.pdf')",
    "redirects.1.from E202: must be a page address like /about, /about/ or /about.html, because a redirect can't stand in for a .XML file. To keep an old file's address working, put the file itself at that path in public/ (you wrote '/feed.XML')",
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, redirects: [{ from: '/a b.pdf', to: '/' }] }), [
    "redirects.0.from E202: must be a plain path like /projects, without spaces, ? or # (you wrote '/a b.pdf')",
  ]);
  // the booking page only takes its path when there is a booking block
  assert.deepEqual(issuesOf(site, { ...minimal, pages: { card: { path: '/meet' } } }), []);
  assert.equal(issuesOf(site, { ...minimal, booking: { calcom: 'a/b' }, pages: { card: { path: '/meet' } } }).length, 1);
});

test('advanced: nameParts, anchors, language and time zone', () => {
  const parsed = parseOk(site, { ...minimal, advanced: { nameParts: { given: 'Wren', family: 'Halloway' }, anchors: { experience: 'experience' } } });
  assert.deepEqual(parsed.advanced.nameParts, { given: 'Wren', family: 'Halloway' });
  assert.equal(parsed.advanced.anchors.experience, 'experience');
  assert.deepEqual(issuesOf(site, { ...minimal, advanced: { anchors: { news: 'work' } } }), [
    "advanced.anchors.news E303: 'work' is already the anchor of the work section; give each section its own",
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, advanced: { timezone: 'Mars/Olympus' } }), [
    "advanced.timezone E202: must be a time zone like UTC or America/New_York (you wrote 'Mars/Olympus')",
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, advanced: { googleVerification: { file: 'google 123.html' } } }), [
    'advanced.googleVerification.file invalid_format: must be the token Google gives you: letters, digits, ., - and _',
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, advanced: { nameParts: { given: 'Wren' } } }), [
    'advanced.nameParts.family invalid_type: Invalid input: expected string, received undefined',
  ]);
});

test('unknown fields are refused, including card: until Google Wallet lands (E201)', () => {
  assert.deepEqual(issuesOf(site, { ...minimal, card: { googleWallet: { issuerId: '1234' } } }), [' unrecognized_keys: Unrecognized key: "card"']);
  assert.deepEqual(issuesOf(site, { ...minimal, tagine: 'x' }), [' unrecognized_keys: Unrecognized key: "tagine"']);
  assert.deepEqual(issuesOf(site, { ...minimal, advanced: { labels: { affiliation: 'Lab' } } }), [
    'advanced.labels unrecognized_keys: Unrecognized key: "affiliation"',
  ]);
});

test('field checks: email, name length, nav keys, the pinned url', () => {
  assert.deepEqual(issuesOf(site, { ...minimal, email: 'wren at halloway' }), ["email E202: doesn't look like an email address (you wrote 'wren at halloway')"]);
  assert.deepEqual(issuesOf(site, { ...minimal, email: '“wren@halloway.test”' }), ["email E202: doesn't look like an email address (you wrote '“wren@halloway.test”')"]);
  assert.deepEqual(issuesOf(site, { ...minimal, name: 'x'.repeat(81) }), ['name too_big: must be 80 characters or fewer']);
  assert.deepEqual(issuesOf(site, { ...minimal, nav: ['projects', { label: 'Notes', href: '/notes' }, 'reserch'] }), [
    'nav.2 invalid_value: must be one of research, projects, publications, experience, writing, cv, booking, contact',
  ]);
  assert.deepEqual(issuesOf(site, { ...minimal, url: 'https://example.org/?x=1' }), [
    "url E202: must be the plain address of your home page, without ? or # (you wrote 'https://example.org/?x=1')",
  ]);
});

test('the starter and the fixtures parse', () => {
  for (const file of ['starter/site.yaml', 'fixtures/minimal/site.yaml']) {
    assert.deepEqual(issuesOf(site, parse(readFileSync(new URL(file, REPO), 'utf8'))), [], file);
  }
});
