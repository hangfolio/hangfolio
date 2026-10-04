// The content schemas (SPEC 5.4–5.9): defaults, shorthands and the checks each makes itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SECTIONS } from '../src/schema/home.ts';
import { experience, home, news, post, project, projectsGroups, publication } from '../src/schema/index.ts';
import { SECTION_ANCHORS } from '../src/schema/site-parts.ts';
import { issuesOf, parseOk } from './helpers.ts';

test('home.yaml: an empty file gets every default', () => {
  assert.deepEqual(parseOk(home, {}), {
    example: false,
    sections: ['highlights', 'work', 'research', 'experience', 'education', 'news', 'writing', 'contact'],
    counts: { experience: 5, news: 4, writing: 2 },
    headings: {
      work: 'Selected work',
      experience: 'Experience',
      education: 'Education',
      news: 'News',
      writing: 'Writing',
      contact: 'Get in touch',
    },
  });
});

test('home.yaml: highlights, research and partial overrides', () => {
  const parsed = parseOk(home, {
    example: true,
    highlights: { items: [{ value: 'up to 40%', what: 'lower p99 latency', asOf: '2026-08' }] },
    research: { problem: 'Caches serve stale data.', featured: 'vale2024bounded', link: { label: 'Code', profile: 'GitHub' } },
    sections: ['research', 'news'],
    counts: { news: 2 },
    headings: { news: 'Updates' },
  });
  assert.equal(parsed.example, true);
  assert.deepEqual(parsed.highlights, { heading: 'Results at a glance', items: [{ value: 'up to 40%', what: 'lower p99 latency', asOf: '2026-08' }] });
  assert.deepEqual(parsed.research, { problem: 'Caches serve stale data.', featured: 'vale2024bounded', link: { label: 'Code', profile: 'github' }, approach: [] });
  assert.deepEqual(parsed.sections, ['research', 'news']);
  assert.deepEqual(parsed.counts, { experience: 5, news: 2, writing: 2 });
  assert.equal(parsed.headings.news, 'Updates');
  assert.equal(parsed.headings.work, 'Selected work');
});

test('home.yaml: 1 to 4 highlights, known sections only, each once', () => {
  const item = { value: '12/12', what: 'bugs found' };
  assert.deepEqual(issuesOf(home, { highlights: { items: [] } }), ['highlights.items too_small: needs at least 1 item']);
  assert.deepEqual(issuesOf(home, { highlights: { items: [item, item, item, item, item] } }), ['highlights.items too_big: can have at most 4 items']);
  assert.match(issuesOf(home, { sections: ['work', 'talks'] })[0], /^sections\.1 invalid_value:/);
  assert.deepEqual(issuesOf(home, { sections: ['work', 'news', 'work'] }), ["sections.2 E202: lists 'work' twice"]);
  // every section has a default anchor in site.yaml advanced.anchors
  assert.deepEqual(Object.keys(SECTION_ANCHORS), [...SECTIONS]);
});

const tidepool = { title: 'Tidepool', summary: 'Replays crash points to find lost writes.' };

test('projects: defaults', () => {
  assert.deepEqual(parseOk(project, tidepool), { ...tidepool, example: false, group: 'Projects', facts: [], links: [], compact: false, listed: true });
});

test('projects: dates, links, facts, a result string and a featured exhibit', () => {
  const parsed = parseOk(project, {
    ...tidepool,
    start: '2025-03',
    end: 'present',
    links: ['https://github.com/hangfolio', { label: 'Docs', url: '/projects/tidepool/' }, { profile: 'GitHub' }, { code: 'cargo install tidepool' }],
    facts: [{ label: 'Result', lines: ['12/12 seeded bugs found'] }, { label: 'Demo', note: 'Sample run', terminal: { label: 'out', lines: ['$ tidepool'] } }],
    result: '12/12 seeded bugs found',
    home: { order: 1, exhibit: { bars: { label: 'p99', caption: 'Lower is better.', rows: [{ label: 'before', value: 3, tone: 'faint' }] } } },
  });
  assert.equal(parsed.start, '2025-03');
  assert.equal(parsed.end, 'present');
  assert.deepEqual(parsed.links, [
    { label: 'GitHub', url: 'https://github.com/hangfolio' },
    { label: 'Docs', url: '/projects/tidepool/' },
    { profile: 'github' },
    { code: 'cargo install tidepool' },
  ]);
  assert.deepEqual(parsed.result, { tag: 'Result', parts: ['12/12 seeded bugs found'] });
  assert.deepEqual(parsed.home?.exhibit, { bars: { label: 'p99', caption: 'Lower is better.', rows: [{ label: 'before', value: 3, tone: 'faint' }] } });
  assert.deepEqual(parseOk(project, { ...tidepool, result: { parts: ['3s', '300ms'] } }).result, { tag: 'Result', parts: ['3s', '300ms'] });
  const metrics = { title: 'API latency', rows: [{ label: 'p99', before: '3s', after: '300ms' }] };
  assert.deepEqual(parseOk(project, { ...tidepool, home: { order: 2, exhibit: { metrics } } }).home?.exhibit, {
    metrics: { ...metrics, rows: [{ label: 'p99', before: '3s', after: '300ms', highlight: false }] },
  });
});

test('projects: one kind of fact, one exhibit, and the required fields', () => {
  assert.deepEqual(issuesOf(project, { ...tidepool, facts: [{ label: 'Built', text: 'A', code: 'b' }] }), [
    'facts.0 E202: needs only one of text, lines, code or note, but has text and code',
  ]);
  assert.deepEqual(issuesOf(project, { ...tidepool, facts: [{ label: 'Built' }] }), ['facts.0 E202: needs text, lines, code, note or terminal']);
  assert.deepEqual(issuesOf(project, { ...tidepool, home: { order: 1, exhibit: {} } }), [
    'home.exhibit E202: needs one of terminal, metrics, bars or install',
  ]);
  assert.deepEqual(issuesOf(project, { ...tidepool, home: { order: 1, exhibit: { install: { command: 'x' }, terminal: { label: 'x', lines: [] } } } }), [
    'home.exhibit E202: needs only one of terminal, metrics, bars or install, but has terminal and install',
  ]);
  assert.deepEqual(issuesOf(project, { title: 'x', sumary: 'y' }), [
    'summary invalid_type: Invalid input: expected string, received undefined',
    ' unrecognized_keys: Unrecognized key: "sumary"',
  ]);
});

test('projects.yaml: group ids from titles, overridable, never twice', () => {
  assert.deepEqual(parseOk(projectsGroups, {}), { groups: [] });
  const { groups } = parseOk(projectsGroups, {
    groups: [{ title: 'Developer tools' }, { title: 'Research code', id: 'code', headingId: 'research-code', link: { label: 'All', href: '/files/' } }],
  });
  assert.deepEqual(groups, [
    { title: 'Developer tools', id: 'developer-tools' },
    { title: 'Research code', id: 'code', headingId: 'research-code', link: { label: 'All', href: '/files/' } },
  ]);
  assert.deepEqual(issuesOf(projectsGroups, { groups: [{ title: 'Tools' }, { title: 'tools!' }] }), [
    "groups.1.title E303: 'tools' is already the id of group 1; give each group its own id",
  ]);
});

test('publication extras: defaults, links and equal contribution', () => {
  assert.deepEqual(parseOk(publication, {}), { example: false, featured: false, links: [], equal: [], authorNote: '*Equal contribution' });
  const parsed = parseOk(publication, {
    equal: ['Author', 'Vale'],
    place: 'Lisbon, May 13–17, 2024',
    links: ['https://github.com/hangfolio', { label: 'Talk', profile: 'youtube' }],
    data: { text: 'Traces on request.' },
    anchor: 'vale2024',
  });
  if (parsed.status === 'in-preparation') assert.fail('read as an in-preparation item');
  assert.deepEqual(parsed.links, [{ label: 'GitHub', url: 'https://github.com/hangfolio' }, { label: 'Talk', profile: 'youtube' }]);
  assert.deepEqual(parsed.data, { tag: 'Data', text: 'Traces on request.' });
});

test('publications in preparation: string authors, and the fields they need', () => {
  const parsed = parseOk(publication, {
    status: 'in-preparation',
    order: 1,
    title: 'Crash replay for key-value stores',
    authors: ['A. Author', { name: 'R. Vale', url: 'https://example.org' }],
    chip: 'Venue 2027 · in preparation',
    text: 'Replaying crash points to find lost writes.',
  });
  assert.equal(parsed.status, 'in-preparation');
  assert.equal(parsed.example, false);
  assert.deepEqual(parsed.status === 'in-preparation' && parsed.authors, [{ name: 'A. Author' }, { name: 'R. Vale', url: 'https://example.org' }]);
  assert.deepEqual(issuesOf(publication, { status: 'in-preparation', title: 'x', text: 'y' }), [
    'order invalid_type: Invalid input: expected number, received undefined',
  ]);
  assert.match(issuesOf(publication, { status: 'draft' })[0], /^status invalid_union: Invalid discriminator value/);
  // extras fields don't belong on an in-preparation item
  assert.deepEqual(issuesOf(publication, { status: 'in-preparation', order: 1, title: 'x', text: 'y', featured: true }), [
    ' unrecognized_keys: Unrecognized key: "featured"',
  ]);
});

test('experience.yaml: defaults, dates and sections', () => {
  assert.deepEqual(parseOk(experience, {}), { entries: [] });
  const { entries } = parseOk(experience, {
    entries: [
      { section: 'research', role: 'Graduate Research Assistant', org: 'Example University', start: '2025-01', end: 'present', bullets: ['Built a harness.'] },
      { section: 'education', role: 'PhD, Computer Science', org: 'Example University', start: 2025, end: 2029, expected: true },
    ],
  });
  assert.deepEqual(entries[0], {
    section: 'research',
    role: 'Graduate Research Assistant',
    org: 'Example University',
    start: '2025-01',
    end: 'present',
    bullets: ['Built a harness.'],
    expected: false,
    example: false,
  });
  assert.deepEqual([entries[1].start, entries[1].end, entries[1].expected], ['2025', '2029', true]);
});

test('experience.yaml: the checks', () => {
  const entry = { section: 'professional', role: 'Intern', org: 'Example Corp' };
  assert.match(issuesOf(experience, { entries: [{ ...entry, section: 'industry' }] })[0], /^entries\.0\.section invalid_value:/);
  assert.deepEqual(issuesOf(experience, { entries: [{ ...entry, bullets: ['a'], desc: 'b' }] }), ['entries.0 E202: needs bullets or desc, not both']);
  assert.deepEqual(issuesOf(experience, { entries: [{ ...entry, start: '2024-13' }] }), [
    "entries.0.start E204: must look like 2026, 2026-08 or 2026-08-14 (you wrote '2024-13')",
  ]);
  const image = { thumb: '/images/a-small.jpg', full: '/images/a.jpg', alt: 'A poster', width: 800, height: 600 };
  assert.deepEqual(issuesOf(experience, { entries: [{ ...entry, gallery: { images: [image, { ...image, alt: undefined, width: '800px' }] } }] }), [
    'entries.0.gallery.images.1.alt invalid_type: Invalid input: expected string, received undefined',
    'entries.0.gallery.images.1.width invalid_type: Invalid input: expected number, received string',
  ]);
});

test('news.yaml: defaults, and dates need a month', () => {
  assert.deepEqual(parseOk(news, {}), { items: [] });
  assert.deepEqual(parseOk(news, { items: [{ date: '2026-08', text: 'Released Tidepool 1.0.' }] }), {
    items: [{ date: '2026-08', text: 'Released Tidepool 1.0.', example: false }],
  });
  assert.deepEqual(issuesOf(news, { items: [{ date: 2026, text: 'x' }, { date: '2026-13-02', text: 'y' }] }), [
    'items.0.date E204: must look like 2026-08 or 2026-08-14 (you wrote 2026)',
    "items.1.date E204: must look like 2026-08 or 2026-08-14 (you wrote '2026-13-02')",
  ]);
});

test('writing: defaults, and the excerpt falls back to the description', () => {
  const parsed = parseOk(post, { title: 'What fsync actually promises', date: '2026-09-14', description: 'Durability, in one page.' });
  assert.deepEqual(parsed, {
    title: 'What fsync actually promises',
    date: new Date('2026-09-14T00:00:00Z'),
    description: 'Durability, in one page.',
    excerpt: 'Durability, in one page.',
    tags: [],
    draft: false,
    example: false,
  });
  assert.equal(parseOk(post, { ...parsed, date: '2026-09-14', excerpt: 'A teaser.' }).excerpt, 'A teaser.');
  assert.deepEqual(issuesOf(post, { title: 'x', date: '2026-09-14', description: 'y', minutes: 'five' }), [
    'minutes invalid_type: Invalid input: expected number, received string',
  ]);
});
