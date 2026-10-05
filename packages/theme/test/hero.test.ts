// What the home page's hero and results strip show (lib/hero.ts, lib/results.ts), from parsed
// site.yaml and home.yaml data.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bookingHref, currentAvailability, heroActions, introHtml, isPdf, mailto, whoami } from '../src/lib/hero.ts';
import { highlightValue, resultColumns } from '../src/lib/results.ts';
import { site as siteSchema, type SiteInput } from '../src/schema/site.ts';
import { parseOk } from './helpers.ts';

const site = (extra: Partial<SiteInput> = {}) => parseOk(siteSchema, { name: 'Wren Halloway', email: 'wren@halloway.test', ...extra });
const availability = { headline: 'Open to internships.', emailSubject: 'Summer 2027 internship' };

describe('hero', () => {
  test('whoami is pronouns · location, as far as either is set', () => {
    assert.equal(whoami(site({ pronouns: 'they/them', location: 'Harbor Point' })), 'they/them · Harbor Point');
    assert.equal(whoami(site({ location: 'Harbor Point' })), 'Harbor Point');
    assert.equal(whoami(site({ pronouns: 'she/her' })), 'she/her');
    assert.equal(whoami(site()), '');
  });

  test('the intro is home.yaml intro, else role and affiliation (linked when it has a url), else nothing', () => {
    const full = site({ role: 'Postdoc', affiliation: { name: 'Institute of Example Studies', url: 'https://example.org' } });
    assert.equal(introHtml(full, { intro: 'Advised by [Dr. Ada](/people/ada).' }, '/hangfolio'), 'Advised by <a href="/hangfolio/people/ada">Dr. Ada</a>.');
    assert.equal(introHtml(full, undefined, '/'), 'Postdoc · <a href="https://example.org">Institute of Example Studies</a>');
    assert.equal(introHtml(full, { intro: undefined }, '/'), 'Postdoc · <a href="https://example.org">Institute of Example Studies</a>');
    assert.equal(introHtml(site({ role: 'R&D <lead>' }), undefined, '/'), 'R&amp;D &lt;lead&gt;');
    assert.equal(introHtml(site({ affiliation: 'Harbor Institute' }), undefined, '/'), 'Harbor Institute');
    assert.equal(introHtml(site(), undefined, '/'), undefined);
  });

  test('availability applies until the end of the day, month or year in `until` (UTC)', () => {
    const at = (until: string | undefined, now: string) =>
      currentAvailability(site({ availability: { ...availability, ...(until && { until }) } }), new Date(now))?.headline;
    assert.equal(at(undefined, '2099-01-01T00:00:00Z'), 'Open to internships.');
    assert.equal(at('2027-06-01', '2027-06-01T23:59:59Z'), 'Open to internships.');
    assert.equal(at('2027-06-01', '2027-06-02T00:00:00Z'), undefined);
    assert.equal(at('2027-06', '2027-06-30T23:59:59Z'), 'Open to internships.');
    assert.equal(at('2027-06', '2027-07-01T00:00:00Z'), undefined);
    assert.equal(at('2027-12', '2027-12-31T12:00:00Z'), 'Open to internships.');
    assert.equal(at('2027-12', '2028-01-01T00:00:00Z'), undefined);
    assert.equal(at('2027', '2027-12-31T23:59:59Z'), 'Open to internships.');
    assert.equal(at('2027', '2028-01-01T00:00:00Z'), undefined);
    assert.equal(currentAvailability(site()), undefined);
  });

  test('mailto encodes the subject; PDFs are spotted by extension', () => {
    assert.equal(mailto('a@b.test'), 'mailto:a@b.test');
    assert.equal(mailto('a@b.test', 'Summer 2027 internship & more?'), 'mailto:a@b.test?subject=Summer%202027%20internship%20%26%20more%3F');
    assert.ok(isPdf('/files/cv.pdf'));
    assert.ok(isPdf('https://example.org/CV.PDF?v=2#page=1'));
    assert.ok(!isPdf('https://docs.example.org/cv'));
    assert.ok(!isPdf('/files/cv.pdf.html'));
  });

  test('booking goes to the booking page once it exists, else the link, else Cal.com outside demo mode', () => {
    const calcom = site({ booking: { calcom: 'wren/30min' } });
    const link = site({ booking: { link: 'https://example.org/book' } });
    const moved = site({ booking: { calcom: 'wren/30min', path: '/book' } });
    const off = site({ booking: { calcom: 'wren/30min' }, pages: { meet: false } });
    assert.equal(bookingHref(calcom, true, false), '/meet');
    assert.equal(bookingHref(moved, true, false), '/book');
    assert.equal(bookingHref(link, true, false), '/meet');
    assert.equal(bookingHref(link, false, false), 'https://example.org/book');
    assert.equal(bookingHref(calcom, false, false), 'https://cal.com/wren/30min');
    assert.equal(bookingHref(calcom, false, true), undefined);
    assert.equal(bookingHref(off, true, false), 'https://cal.com/wren/30min');
    assert.equal(bookingHref(site(), true, false), undefined);
  });

  test('the calls to action and profile links', () => {
    const full = site({
      cv: '/files/cv.pdf',
      availability,
      booking: { link: 'https://example.org/book', label: 'Book a call' },
      links: ['https://github.com/hangfolio', { url: 'mailto:lab@x.test', label: 'Lab' }, { url: 'https://bsky.app/', hero: false }],
    });
    assert.deepEqual(heroActions(full, { bookingPage: false, demo: false, now: new Date('2026-10-04T00:00:00Z') }), {
      resume: { href: '/files/cv.pdf', pdf: true },
      email: 'mailto:wren@halloway.test?subject=Summer%202027%20internship',
      booking: { label: 'Book a call', href: 'https://example.org/book' },
      profiles: [
        { label: 'GitHub', href: 'https://github.com/hangfolio', external: true },
        { label: 'Lab', href: 'mailto:lab@x.test', external: false },
      ],
    });
    const expired = site({ cv: 'https://docs.example.org/cv', availability: { ...availability, until: '2020' } });
    assert.deepEqual(heroActions(expired, { bookingPage: true, demo: false }), {
      resume: { href: 'https://docs.example.org/cv', pdf: false },
      email: 'mailto:wren@halloway.test',
      booking: undefined,
      profiles: [],
    });
  });
});

describe('results strip', () => {
  test('a leading "up to " is the prefix, and each " → " splits the value', () => {
    assert.deepEqual(highlightValue('up to 40%'), { pre: 'up to ', parts: ['40%'], nowrap: true });
    assert.deepEqual(highlightValue('Up to 3×'), { pre: 'Up to ', parts: ['3×'], nowrap: true });
    assert.deepEqual(highlightValue('3s → 300ms'), { parts: ['3s', '300ms'], nowrap: true });
    assert.deepEqual(highlightValue('up to 9 → 2'), { pre: 'up to ', parts: ['9', '2'], nowrap: true });
    assert.deepEqual(highlightValue('12/12'), { parts: ['12/12'], nowrap: false });
    assert.deepEqual(highlightValue('3s→300ms'), { parts: ['3s→300ms'], nowrap: false });
    assert.deepEqual(highlightValue('setup to 5'), { parts: ['setup to 5'], nowrap: false });
  });

  test('one column per item on wide screens, at most 4', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(resultColumns), [1, 2, 3, 4, 4]);
  });
});
