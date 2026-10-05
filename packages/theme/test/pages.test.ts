// M4: the interior pages' logic, without rendering: page paths and the files they become, the
// route table, which pages exist (nav), project groups and numbering, experience sections, the
// writing helpers, the contact rows and the booking modes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingHost, bookingMode, calConfig } from '../src/lib/booking.ts';
import { contactRows, displayUrl } from '../src/lib/contact.ts';
import { experienceSections } from '../src/lib/experience.ts';
import type { Job } from '../src/lib/home.ts';
import { availablePages, navItems, pagePath } from '../src/lib/nav.ts';
import { childPath, pageUrl, redirectFile, routeShape, samePage } from '../src/lib/paths.ts';
import { hasPage, listedProjects, plainText, projectGroups } from '../src/lib/projects.ts';
import { pageRoutes } from '../src/lib/routes.ts';
import { byline, postMinutes, publishedPosts, readingMinutes } from '../src/lib/writing.ts';
import { experience } from '../src/schema/experience.ts';
import { project, projectsGroups } from '../src/schema/project.ts';
import { site as siteSchema, type SiteInput } from '../src/schema/site.ts';
import { entryId } from '../src/validate/redirects.ts';
import { parseOk } from './helpers.ts';

const site = (input: Partial<SiteInput> = {}) => parseOk(siteSchema, { name: 'Wren Halloway', email: 'wren@halloway.test', ...input });

test('page paths: the same page in four spellings, its shape, its address and a child page', () => {
  for (const path of ['/writing/', '/writing', '/writing.html', '/writing/index.html']) assert.equal(samePage(path), '/writing');
  assert.deepEqual(routeShape('/projects'), { route: '/projects', dir: false });
  assert.deepEqual(routeShape('/writing/'), { route: '/writing', dir: true });
  assert.deepEqual(routeShape('/notes/index.html'), { route: '/notes', dir: true });
  assert.equal(pageUrl('/projects'), '/projects');
  assert.equal(pageUrl('/projects.html'), '/projects');
  assert.equal(pageUrl('/writing/'), '/writing/');
  assert.equal(pageUrl('/projects', 'directory'), '/projects/');
  assert.equal(childPath('/projects', 'tidepool'), '/projects/tidepool/');
  assert.equal(childPath('/work/', 'tidepool'), '/work/tidepool/');
});

test('a redirect writes exactly the file its `from` names', () => {
  assert.equal(redirectFile('/about.html'), '/about.html');
  assert.equal(redirectFile('/about/'), '/about/index.html');
  assert.equal(redirectFile('/about/index.html'), '/about/index.html');
  assert.equal(redirectFile('about'), '/about.html');
  assert.equal(redirectFile('/about', 'directory'), '/about/index.html');
  assert.equal(redirectFile('/old/feed.xml'), '/old/feed.xml');
  assert.equal(redirectFile('/v1.2/notes'), '/v1.2/notes.html');
});

test('routes: every page that is on, content pages through [...page], children as directories', () => {
  const routes = pageRoutes(site({ booking: { link: 'https://example.org/book' }, redirects: [{ from: '/about.html', to: '/' }, { from: '/about/', to: '/' }] }));
  assert.deepEqual(routes, [
    { pattern: '/projects/[...page]', entry: 'projects.astro', dir: false },
    { pattern: '/projects/[id]', entry: 'project.astro', dir: true },
    { pattern: '/experience/[...page]', entry: 'experience.astro', dir: false },
    { pattern: '/writing/[...page]', entry: 'writing.astro', dir: true },
    { pattern: '/writing/[slug]', entry: 'post.astro', dir: true },
    { pattern: '/contact', entry: 'contact.astro', dir: false },
    { pattern: '/meet', entry: 'meet.astro', dir: false },
    { pattern: '/404', entry: '404.astro' },
    { pattern: '/about.html', entry: 'redirect.ts' },
    { pattern: '/about/index.html', entry: 'redirect.ts' },
  ]);
});

test('routes: pages turned off, moved paths, the writing path, no booking, and a redirect public/ already has', () => {
  const routes = pageRoutes(
    site({
      pages: { projects: false, experience: { path: '/work-experience' }, contact: { path: '/about-me/' }, notFound: false },
      advanced: { writingPath: '/notes' },
      redirects: [{ from: '/cv', to: '/files/cv.pdf' }, { from: '/old/', to: '/' }],
    }),
    (file) => file === 'old/index.html',
  );
  assert.deepEqual(routes, [
    { pattern: '/work-experience/[...page]', entry: 'experience.astro', dir: false },
    { pattern: '/notes/[...page]', entry: 'writing.astro', dir: true },
    { pattern: '/notes/[slug]', entry: 'post.astro', dir: true },
    { pattern: '/about-me', entry: 'contact.astro', dir: true },
    { pattern: '/cv.html', entry: 'redirect.ts' },
  ]);
  // The card page is deferred: no route, whatever pages.card says.
  assert.ok(pageRoutes(site({ pages: { card: true } })).every((route) => !route.pattern.includes('card')));
});

test('which pages exist: content pages with content, CV, booking while open, contact while on', () => {
  const base = site({ cv: '/files/cv.pdf', booking: { calcom: 'wren/30min' } });
  assert.deepEqual([...availablePages(base)], ['cv', 'booking', 'contact']);
  assert.deepEqual([...availablePages(base, { research: true, projects: true, experience: true, writing: true })], [
    'research', 'projects', 'experience', 'writing', 'cv', 'booking', 'contact',
  ]);
  const off = site({ pages: { projects: false, contact: false, meet: false }, booking: { link: 'https://example.org/b' } });
  assert.deepEqual([...availablePages(off, { projects: true })], []);
  // Booking paused with keepPageWhenOff: the page stays, but no nav item or calls to action.
  assert.deepEqual([...availablePages(site({ booking: { keepPageWhenOff: true } }))], ['contact']);
});

test('nav: default order and labels, the booking label, and the page addresses', () => {
  const s = site({ cv: '/files/cv.pdf', booking: { link: 'https://example.org/b', label: 'Book a call' }, pages: { experience: { path: '/work-experience' } } });
  const items = navItems(s, availablePages(s, { research: true, projects: true, experience: true, writing: true }));
  assert.deepEqual(items.map((item) => `${item.label} ${item.href}`), [
    'Research /#research',
    'Projects /projects',
    'Experience /work-experience',
    'Writing /writing/',
    'CV /files/cv.pdf',
    'Book a call /meet',
    'Contact /contact',
  ]);
  const chosen = site({ nav: ['writing', 'contact', 'projects'] });
  assert.deepEqual(navItems(chosen, availablePages(chosen, { writing: true })).map((item) => item.key), ['writing', 'contact']);
  assert.equal(pagePath(site({ advanced: { urlFormat: 'directory' } }), 'contact'), '/contact/');
  assert.equal(pagePath(site({ pages: { contact: false } }), 'contact'), undefined);
});

const projects = (entries: Record<string, Record<string, unknown>>) =>
  Object.entries(entries).map(([id, data]) => ({ id, data: parseOk(project, { summary: 'S.', ...data }), body: '' }));

test('projects: listed ones by order then file order; groups from projects.yaml, then first use', () => {
  const entries = projects({
    a: { title: 'A', group: 'Tools' },
    b: { title: 'B', group: 'Research', order: 2 },
    c: { title: 'C', group: 'Tools', compact: true },
    d: { title: 'D', group: 'Tools', compact: true, order: 1 },
    e: { title: 'E', group: 'Libraries', listed: false },
    f: { title: 'F', group: 'Café & Co', compact: true },
  });
  assert.deepEqual(listedProjects(entries).map((entry) => entry.id), ['d', 'b', 'a', 'c', 'f']);
  const settings = parseOk(projectsGroups, { groups: [{ title: 'Research', headingId: 'research-h', link: { label: 'Papers', href: '/publications' } }, { title: 'Unused' }] }).groups;
  const groups = projectGroups(entries, settings);
  assert.deepEqual(
    groups.map((group) => ({ ...group, runs: group.runs.map((run) => `${run.compact ? 'compact' : 'full'}@${run.start}:${run.entries.map((entry) => entry.id).join('')}`) })),
    [
      { title: 'Research', id: 'research', headingId: 'research-h', link: { label: 'Papers', href: '/publications' }, runs: ['full@1:b'] },
      { title: 'Tools', id: 'tools', headingId: 'tools-h', link: undefined, runs: ['compact@2:d', 'full@3:a', 'compact@4:c'] },
      { title: 'Café & Co', id: 'cafe-co', headingId: 'cafe-co-h', link: undefined, runs: ['compact@5:f'] },
    ],
  );
  // A group named like another group's id gets a number, so ids stay unique.
  const clash = projectGroups(projects({ a: { title: 'A', group: 'Tools' }, b: { title: 'B', group: 'Other' } }), parseOk(projectsGroups, { groups: [{ title: 'Other', id: 'tools' }] }).groups);
  assert.deepEqual(clash.map((group) => group.id), ['tools', 'tools-2']);
  assert.deepEqual(projectGroups([], settings), []);
  // projects.yaml names a group as its projects do, give or take case and spaces; an unused group takes no id.
  const loose = projectGroups(
    projects({ a: { title: 'A', group: 'Developer  Tools' }, b: { title: 'B', group: 'developer tools' } }),
    parseOk(projectsGroups, { groups: [{ title: 'Talks' }, { title: 'developer tools', link: { label: 'GitHub', href: 'https://github.com/x' } }] }).groups,
  );
  assert.deepEqual(loose.map((group) => [group.title, group.id, group.link?.label, group.runs[0].entries.map((entry) => entry.id).join('')]), [['developer tools', 'developer-tools', 'GitHub', 'ab']]);
});

test("a content file's id is Astro's slug of its name (for the redirect check)", () => {
  assert.equal(entryId('cache-lied'), 'cache-lied');
  assert.equal(entryId('My First Post'), 'my-first-post');
  assert.equal(entryId('Café_Notes (v2)'), 'café_notes-v2');
});

test('projects: a body earns a page; summaries as plain text for the meta description', () => {
  assert.equal(hasPage({ body: '\n\n' }), false);
  assert.equal(hasPage({}), false);
  assert.equal(hasPage({ body: 'Notes.' }), true);
  assert.equal(plainText('Counts *kelp* with [drones](/projects) & `opencv` <fast>.'), 'Counts kelp with drones & opencv <fast>.');
});

test('experience: sections in their order with fixed ids; programs join education', () => {
  const entries = parseOk(experience, {
    entries: [
      { section: 'earlier', role: 'Freelancer', org: 'Self', desc: 'Web tools.' },
      { section: 'research', role: 'RA', org: 'Lab' },
      { section: 'professional', role: 'Intern', org: 'Co' },
      { section: 'programs', role: 'Participant', org: 'School' },
      { section: 'education', role: 'PhD', org: 'Uni' },
    ],
  }).entries as Job[];
  assert.deepEqual(
    experienceSections(entries).map((s) => `${s.id} ${s.heading}: ${s.entries.map((e) => e.role).join(', ')}`),
    ['professional Professional experience: Intern', 'research-experience Research experience: RA', 'education Education & programs: Participant, PhD', 'earlier Earlier experience: Freelancer'],
  );
  assert.equal(experienceSections(entries.filter((e) => e.section !== 'programs')).find((s) => s.id === 'education')?.heading, 'Education');
  assert.deepEqual(experienceSections([]), []);
});

test('writing: published posts newest first, reading time, the minutes pin and the byline', () => {
  const post = (id: string, date: string, draft = false) => ({ id, data: { date: new Date(date), draft } });
  assert.deepEqual(publishedPosts([post('a', '2024-01-01'), post('b', '2026-01-01'), post('c', '2025-01-01', true), post('d', '2024-01-01')]).map((p) => p.id), ['b', 'a', 'd']);
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('word '.repeat(699)), 3);
  assert.equal(readingMinutes('word '.repeat(701)), 4);
  assert.equal(postMinutes({ body: 'word '.repeat(2000), data: { minutes: 6 } }), 6);
  assert.equal(postMinutes({ body: 'word '.repeat(2000), data: {} }), 10);
  assert.equal(byline(site({ role: 'PhD student', affiliation: 'Example University' })), 'Wren Halloway, PhD student at Example University');
  assert.equal(byline(site({ role: 'Engineer' })), 'Wren Halloway, Engineer');
  assert.equal(byline(site({ affiliation: { name: 'Example Lab' } })), 'Wren Halloway, Example Lab');
  assert.equal(byline(site()), 'Wren Halloway');
});

test('contact rows: location, the links marked contact, then booking', () => {
  assert.equal(displayUrl('https://www.github.com/wren/'), 'github.com/wren');
  assert.equal(displayUrl('mailto:lab@x.test?subject=Hi'), 'lab@x.test');
  const s = site({
    location: 'Harbor Point',
    locationLong: 'Harbor Point, Northlake',
    links: ['https://github.com/wren', { url: 'https://example.org/cv', label: 'Notes', contact: false }, { url: 'mailto:lab@x.test', label: 'Lab' }],
    booking: { calcom: 'wren/30min' },
  });
  assert.deepEqual(contactRows(s, '/meet'), [
    { label: 'Location', text: 'Harbor Point, Northlake' },
    { label: 'GitHub', text: 'github.com/wren', href: 'https://github.com/wren', external: true },
    { label: 'Lab', text: 'lab@x.test', href: 'mailto:lab@x.test', external: false },
    { label: 'Book a call', text: 'Pick a time', href: '/meet' },
  ]);
  assert.deepEqual(contactRows(site()), []);
});

test('booking: the mode, the link host and the Cal.com settings from the accent tokens', () => {
  assert.equal(bookingMode(site()), undefined);
  assert.equal(bookingMode(site({ booking: { calcom: 'https://cal.com/wren/30min' } })), 'calcom');
  assert.equal(bookingMode(site({ booking: { link: 'https://example.org/b' } })), 'link');
  assert.equal(bookingMode(site({ booking: { keepPageWhenOff: true } })), 'off');
  assert.equal(bookingHost('https://www.example.org/book/wren'), 'example.org');
  assert.deepEqual(calConfig('wren/30min', { light: '#2c5aa0', dark: '#8fb2ea' }), {
    calLink: 'wren/30min',
    ui: { layout: 'month_view', hideEventTypeDetails: false, cssVarsPerTheme: { light: { 'cal-brand': '#2c5aa0' }, dark: { 'cal-brand': '#8fb2ea' } } },
  });
});
