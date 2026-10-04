// The lenient shorthands shared by every schema (SPEC 5.1): bare URLs, string authors and
// affiliations, flexible dates, profile ids, plus the small conveniences around them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import {
  accent,
  affiliation,
  author,
  filePath,
  href,
  htmlId,
  link,
  oneOf,
  pagePath,
  profileId,
  projectLink,
  text,
  webUrl,
} from '../src/schema/common.ts';
import { guessDate } from '../src/schema/date-guess.ts';
import { partialDate, postDate } from '../src/schema/dates.ts';
import { issuesOf, parseOk } from './helpers.ts';

test('a bare URL becomes a link labelled from its host', () => {
  assert.deepEqual(parseOk(link, 'https://github.com/someone'), { label: 'GitHub', url: 'https://github.com/someone' });
  assert.deepEqual(parseOk(link, 'https://www.linkedin.com/in/someone'), { label: 'LinkedIn', url: 'https://www.linkedin.com/in/someone' });
  assert.deepEqual(parseOk(link, 'https://lab.example.org/'), { label: 'lab.example.org', url: 'https://lab.example.org/' });
  // {url} without a label gets one too; a written label is kept
  assert.deepEqual(parseOk(link, { url: 'https://orcid.org/0000-0002-1825-0097' }), { label: 'ORCID', url: 'https://orcid.org/0000-0002-1825-0097' });
  assert.deepEqual(parseOk(link, { label: 'Code', url: 'https://github.com/x' }), { label: 'Code', url: 'https://github.com/x' });
  // a path on the site is a link too
  assert.deepEqual(parseOk(link, { label: 'Paper', url: '/files/paper.pdf' }), { label: 'Paper', url: '/files/paper.pdf' });
});

test('a link written without https:// says how to fix it, at the right place', () => {
  assert.deepEqual(issuesOf(link, 'github.com/someone'), [' E202: needs https:// in front: https://github.com/someone']);
  assert.deepEqual(issuesOf(link, { label: 'Lab', url: 'www.example.org' }), ['url E202: needs https:// in front: https://www.example.org']);
  assert.deepEqual(issuesOf(link, 'javascript:alert(1)'), [" E202: must start with https://, http://, mailto: or tel: (you wrote 'javascript:alert(1)')"]);
  assert.deepEqual(issuesOf(href, '//example.org/x'), [' E202: needs https: in front: https://example.org/x']);
  assert.deepEqual(issuesOf(href, 'https://'), [" E202: must be a full address like https://example.org (you wrote 'https://')"]);
  for (const ok of ['/projects', 'files/cv.pdf', '#bibtex', 'mailto:a@example.org', 'tel:+15550100', 'http://example.org']) {
    assert.deepEqual(issuesOf(href, ok), [], ok);
  }
  assert.deepEqual(issuesOf(webUrl, '/projects'), [" E202: must be a full address starting with https:// (you wrote '/projects')"]);
  assert.deepEqual(issuesOf(webUrl, 'www.example.edu/people/x'), [' E202: needs https:// in front: https://www.example.edu/people/x']);
  assert.deepEqual(issuesOf(webUrl, 'mailto:a@example.org'), [" E202: must be a full address starting with https:// (you wrote 'mailto:a@example.org')"]);
  assert.deepEqual(issuesOf(href, 'http//example.org/kelp.pdf'), [' E202: is missing the colon after http: http://example.org/kelp.pdf']);
  assert.deepEqual(issuesOf(filePath, 'ftp://example.org/cv.pdf'), [
    " E202: must be a file path like /files/cv.pdf, or an https:// address (you wrote 'ftp://example.org/cv.pdf')",
  ]);
  assert.deepEqual(issuesOf(filePath, 'https://example.org/me.jpg'), []);
});

test('profile references and project links', () => {
  assert.deepEqual(parseOk(link, { profile: 'Google Scholar' }), { profile: 'google-scholar' });
  assert.deepEqual(parseOk(link, { label: 'Papers', profile: 'scholar' }), { label: 'Papers', profile: 'scholar' });
  assert.deepEqual(parseOk(projectLink, { code: 'cargo install tidepool' }), { code: 'cargo install tidepool' });
  assert.deepEqual(parseOk(projectLink, 'https://github.com/x'), { label: 'GitHub', url: 'https://github.com/x' });
  // both url and profile: neither form matches
  assert.match(issuesOf(link, { label: 'x', url: 'https://a.example', profile: 'github' })[0], /^ invalid_union:/);
});

test('profile ids are slugs, whatever their spelling', () => {
  assert.equal(parseOk(profileId, 'GitHub'), 'github');
  assert.equal(parseOk(profileId, 'Google Scholar'), 'google-scholar');
  assert.equal(parseOk(profileId, 'orcid'), 'orcid');
  assert.deepEqual(issuesOf(profileId, '🌊'), [" E202: needs letters or digits (you wrote '🌊')"]);
});

test('an author or an affiliation can be a plain string', () => {
  assert.deepEqual(parseOk(author, 'A. Author'), { name: 'A. Author' });
  assert.deepEqual(parseOk(author, { name: 'R. Vale', url: 'https://example.org' }), { name: 'R. Vale', url: 'https://example.org' });
  assert.deepEqual(parseOk(affiliation, 'Example University'), { name: 'Example University' });
  assert.deepEqual(parseOk(affiliation, { name: 'Example University', url: 'https://example.edu' }), {
    name: 'Example University',
    url: 'https://example.edu',
  });
  assert.deepEqual(issuesOf(affiliation, { name: 'Example University', url: 'example.edu' }), [
    'url E202: needs https:// in front: https://example.edu',
  ]);
});

test('dates: 2026, 2026-08 and 2026-08-14, kept at the precision written', () => {
  const date = partialDate();
  assert.equal(parseOk(date, 2026), '2026'); // YAML reads a bare year as a number
  assert.equal(parseOk(date, '2026'), '2026');
  assert.equal(parseOk(date, '2026-08'), '2026-08');
  assert.equal(parseOk(date, '2026-08-14'), '2026-08-14');
  assert.equal(parseOk(date, new Date('2026-08-14T00:00:00Z')), '2026-08-14'); // Astro's front-matter parser
  assert.equal(parseOk(date, '2024-02-29'), '2024-02-29');
});

test('dates: impossible or misshapen dates are E204 with the forms to use', () => {
  const date = partialDate();
  const message = (wrote: string) => [` E204: must look like 2026, 2026-08 or 2026-08-14 (you wrote ${wrote})`];
  assert.deepEqual(issuesOf(date, '2026-13'), message("'2026-13'"));
  assert.deepEqual(issuesOf(date, '2026-02-30'), message("'2026-02-30'"));
  assert.deepEqual(issuesOf(date, '2025-02-29'), message("'2025-02-29'"));
  assert.deepEqual(issuesOf(date, 'Aug 2025'), message("'Aug 2025'; did you mean 2025-08?"));
  assert.deepEqual(issuesOf(date, '2026-8'), message("'2026-8'; did you mean 2026-08?"));
  assert.deepEqual(issuesOf(date, 2026.5), message('2026.5'));
  assert.deepEqual(issuesOf(date, true), message('true'));
});

test('dates: news needs a month, and a range can end at present', () => {
  const month = partialDate({ least: 'month' });
  assert.equal(parseOk(month, '2026-08'), '2026-08');
  assert.deepEqual(issuesOf(month, 2026), [' E204: must look like 2026-08 or 2026-08-14 (you wrote 2026)']);
  const end = partialDate({ present: true });
  assert.equal(parseOk(end, 'present'), 'present');
  assert.equal(parseOk(end, '2024-08'), '2024-08');
  assert.deepEqual(issuesOf(end, 'Present'), [" E204: must look like 2026, 2026-08 or 2026-08-14, or present (you wrote 'Present'; did you mean present?)"]);
  assert.deepEqual(issuesOf(partialDate(), 'present'), [" E204: must look like 2026, 2026-08 or 2026-08-14 (you wrote 'present')"]);
});

test('dates: a required date that is missing is reported as missing, not as a bad date', () => {
  const schema = z.strictObject({ date: partialDate(), until: partialDate().optional() });
  assert.deepEqual(issuesOf(schema, {}), ['date invalid_type: is required']);
  assert.deepEqual(parseOk(schema, { date: '2026-08' }), { date: '2026-08' });
});

test('post dates: a day, optionally with a time, become a Date', () => {
  assert.equal(parseOk(postDate, '2026-09-14').toISOString(), '2026-09-14T00:00:00.000Z');
  assert.equal(parseOk(postDate, '2026-09-14T10:30:00+02:00').toISOString(), '2026-09-14T08:30:00.000Z');
  assert.equal(parseOk(postDate, '2026-09-14 10:30').toISOString(), '2026-09-14T10:30:00.000Z');
  assert.equal(parseOk(postDate, new Date('2026-09-14T00:00:00Z')).toISOString(), '2026-09-14T00:00:00.000Z');
  assert.deepEqual(issuesOf(postDate, '2026-09'), [" E204: must look like 2026-08-14 (you wrote '2026-09')"]);
  assert.deepEqual(issuesOf(postDate, '2026-02-30'), [" E204: must look like 2026-08-14 (you wrote '2026-02-30')"]);
  assert.deepEqual(issuesOf(postDate, 'Sept 3, 2024'), [" E204: must look like 2026-08-14 (you wrote 'Sept 3, 2024'; did you mean 2024-09-03?)"]);
  assert.deepEqual(issuesOf(postDate, 'Sept 2024'), [" E204: must look like 2026-08-14 (you wrote 'Sept 2024')"]);
});

test('dates: a date written another way gets a guess, unless it could mean two dates', () => {
  const cases: [string, string | undefined][] = [
    ['Sept 2024', '2024-09'],
    ['september 2024', '2024-09'],
    ['Jun. 2025', '2025-06'],
    ['3 Sept 2024', '2024-09-03'],
    ['March 1st, 2025', '2025-03-01'],
    ['09/2022', '2022-09'],
    ['2024/06', '2024-06'],
    ['2024-6-1', '2024-06-01'],
    ['31/12/2024', '2024-12-31'],
    ['12/31/2024', '2024-12-31'],
    ['03/04/2024', undefined],
    ['Summer 2024', undefined],
    ['Feb 30, 2024', undefined],
    ['now', undefined],
  ];
  for (const [written, guess] of cases) assert.equal(guessDate(written), guess, written);
  assert.equal(guessDate('now', { present: true }), 'present');
  assert.equal(guessDate(2024.5), undefined);
});

test('page paths get their leading slash; other values are refused', () => {
  assert.equal(parseOk(pagePath, 'projects'), '/projects');
  assert.equal(parseOk(pagePath, '/writing/'), '/writing/');
  assert.deepEqual(issuesOf(pagePath, 'https://example.org/qr'), [
    " E202: must be a path on your site like /projects (you wrote 'https://example.org/qr')",
  ]);
  assert.deepEqual(issuesOf(pagePath, '/my card'), [
    " E202: must be a plain path like /projects, without spaces, ? or # (you wrote '/my card')",
  ]);
});

test('colours: one hex colour or {light, dark}, with or without #', () => {
  assert.deepEqual(parseOk(accent, '#2C5AA0'), { light: '#2c5aa0' });
  assert.deepEqual(parseOk(accent, '2c5'), { light: '#22cc55' });
  assert.deepEqual(parseOk(accent, { light: '#2c5aa0', dark: '#8FB2EA' }), { light: '#2c5aa0', dark: '#8fb2ea' });
  assert.deepEqual(issuesOf(accent, 'blue'), [` E202: must be a hex colour like "#2c5aa0", in quotes (you wrote 'blue')`]);
  assert.deepEqual(issuesOf(accent, { light: 'blue' }), [`light E202: must be a hex colour like "#2c5aa0", in quotes (you wrote 'blue')`]);
});

test('text, ids and fixed choices', () => {
  assert.deepEqual(issuesOf(text, ''), [" too_small: can't be empty; delete the line instead"]);
  assert.deepEqual(issuesOf(htmlId, 'my id'), [" E202: must be letters, digits, - and _ only (you wrote 'my id')"]);
  const choice = oneOf(['research', 'projects'] as const);
  assert.equal(parseOk(choice, 'projects'), 'projects');
  // reported like a zod enum, so the validator can suggest the nearest value
  const result = choice.safeParse('reserch');
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.issues.map((issue) => [issue.code, (issue as { values?: string[] }).values]), [
    ['invalid_value', ['research', 'projects']],
  ]);
});
