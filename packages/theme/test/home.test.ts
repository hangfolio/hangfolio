// How the home page is put together (lib/home.ts, SPEC 5.4): which jobs, education lines, news
// and posts show, which sections appear in which order, and where the education lines go.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homeEducation, homeJobs, homeNews, homePosts, planSections, showsResearch, type Section } from '../src/lib/home.ts';
import { navItems, availablePages } from '../src/lib/nav.ts';
import { postPath } from '../src/lib/site.ts';
import { experience } from '../src/schema/experience.ts';
import { home as homeSchema } from '../src/schema/home.ts';
import { SECTION_ANCHORS } from '../src/schema/site-parts.ts';
import { site as siteSchema } from '../src/schema/site.ts';
import { parseOk } from './helpers.ts';

const { entries } = parseOk(experience, {
  entries: [
    { section: 'education', role: 'PhD', org: 'Institute', homeLine: { text: 'PhD, Institute', years: '2023 – 2028' } },
    { section: 'research', role: 'RA', org: 'Institute', home: 'Tracing.' },
    { section: 'professional', role: 'Engineer', org: 'Example Systems Ltd.', short: 'Example Systems', home: 'CI.' },
    { section: 'professional', role: 'Intern', org: 'Lantern' },
    { section: 'teaching', role: 'TA', org: 'Institute', when: ['Fall 2024'], home: 'Labs.' },
    { section: 'programs', role: 'Participant', org: 'Summer School', homeLine: { text: 'Summer School', years: '2025' } },
    { section: 'education', role: 'BSc', org: 'Polytechnic' },
  ],
});

test('jobs: entries with a home line, in file order across sections, at most counts.experience', () => {
  assert.deepEqual(homeJobs(entries, 5).map((e) => e.role), ['RA', 'Engineer', 'TA']);
  assert.deepEqual(homeJobs(entries, 2).map((e) => e.role), ['RA', 'Engineer']);
  assert.deepEqual(homeJobs(entries, 0), []);
});

test('education lines: education and programs entries with a homeLine, all of them, in file order', () => {
  assert.deepEqual(homeEducation(entries).map((e) => e.homeLine?.text), ['PhD, Institute', 'Summer School']);
});

test('news: the first counts.news items, as the file orders them', () => {
  const items = ['2026-08', '2026-06', '2025-01'].map((date) => ({ date, text: date, example: false }));
  assert.deepEqual(homeNews(items, 2).map((i) => i.date), ['2026-08', '2026-06']);
});

test('posts: newest first, drafts left out, ties in file order, at most counts.writing', () => {
  const post = (id: string, date: string, draft = false) => ({ id, data: { date: new Date(date), draft } });
  const posts = [post('old', '2024-03-20'), post('draft', '2026-10-01', true), post('a', '2026-09-14'), post('b', '2026-09-14'), post('mid', '2025-11-02')];
  assert.deepEqual(homePosts(posts, 3).map((p) => p.id), ['a', 'b', 'mid']);
  assert.deepEqual(homePosts(posts, 10).map((p) => p.id), ['a', 'b', 'mid', 'old']);
});

test("a post's page is /{writingPath}/{file name}/", () => {
  const site = parseOk(siteSchema, { name: 'A B', email: 'a@b.test' });
  assert.equal(postPath(site, 'what-fsync-promises'), '/writing/what-fsync-promises/');
  const notes = parseOk(siteSchema, { name: 'A B', email: 'a@b.test', advanced: { writingPath: 'notes/' } });
  assert.equal(postPath(notes, 'x'), '/notes/x/');
});

const ALL = Object.fromEntries(Object.keys(SECTION_ANCHORS).map((s) => [s, true])) as Record<Section, boolean>;
const DEFAULT = homeSchema.parse({}).sections;

test('sections: in `sections` order, ids from advanced.anchors; education joins experience right after it', () => {
  assert.deepEqual(planSections(DEFAULT, SECTION_ANCHORS, ALL), [
    { section: 'highlights', id: 'results' },
    { section: 'work', id: 'work' },
    { section: 'research', id: 'research' },
    { section: 'experience', id: 'exp', education: 'education' },
    { section: 'news', id: 'news' },
    { section: 'writing', id: 'writing' },
    { section: 'contact', id: 'contact' },
  ]);
});

test('sections with nothing to show are left out, and so are those not listed', () => {
  const shows = { ...ALL, highlights: false, work: false, news: false };
  const plan = planSections(['contact', 'news', 'work', 'writing'], { ...SECTION_ANCHORS, contact: 'hello' }, shows);
  assert.deepEqual(plan, [
    { section: 'contact', id: 'hello' },
    { section: 'writing', id: 'writing' },
  ]);
});

test('education gets its own section when it is not right after experience, or experience has nothing', () => {
  const apart = planSections(['experience', 'news', 'education'], SECTION_ANCHORS, ALL);
  assert.deepEqual(apart, [
    { section: 'experience', id: 'exp' },
    { section: 'news', id: 'news' },
    { section: 'education', id: 'education' },
  ]);
  const before = planSections(['education', 'experience'], SECTION_ANCHORS, ALL);
  assert.deepEqual(before.map((s) => s.section), ['education', 'experience']);
  const noJobs = planSections(['experience', 'education'], SECTION_ANCHORS, { ...ALL, experience: false });
  assert.deepEqual(noJobs, [{ section: 'education', id: 'education' }]);
  const noLines = planSections(['experience', 'education'], SECTION_ANCHORS, { ...ALL, education: false });
  assert.deepEqual(noLines, [{ section: 'experience', id: 'exp' }]);
});

test('research shows when its block has content and its section is listed; then the nav has Research', () => {
  const site = parseOk(siteSchema, { name: 'A B', email: 'a@b.test', advanced: { anchors: { research: 'papers' } } });
  assert.equal(showsResearch(undefined), false);
  assert.equal(showsResearch(homeSchema.parse({})), false);
  assert.equal(showsResearch(homeSchema.parse({ research: {} })), false);
  assert.equal(showsResearch(homeSchema.parse({ research: { teaching: 'TA' } })), true);
  assert.equal(showsResearch(homeSchema.parse({ research: { featured: 'x' } })), true);
  assert.equal(showsResearch(homeSchema.parse({ research: { problem: 'P' }, sections: ['work'] })), false);
  const contact = { key: 'contact', label: 'Contact', href: '/contact' };
  assert.deepEqual(navItems(site, availablePages(site, { research: true })), [{ key: 'research', label: 'Research', href: '/#papers' }, contact]);
  assert.deepEqual(navItems(site, availablePages(site)), [contact]);
});
