// Render tests for the interior pages' components, through Astro's container API (render.ts), at
// base /hangfolio so every internal link must carry it: the jump links, the experience roles with
// their margin and photos, the contact rows and status line, the post footer, and the MDX
// components <Note> and <Terminal>.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { contactRows } from '../src/lib/contact.ts';
import { experience } from '../src/schema/experience.ts';
import { parseOk } from './helpers.ts';
import { createRenderer } from './render.ts';

type Renderer = Awaited<ReturnType<typeof createRenderer>>;

const SITE = {
  role: 'Postdoc in distributed systems',
  affiliation: 'Institute of Example Studies',
  location: 'Harbor Point',
  links: ['https://github.com/hangfolio', { url: 'mailto:lab@x.test', label: 'Lab' }],
  availability: { headline: 'Open to internships.', contact: 'Looking for a **Summer 2027** internship. [Book a call](/meet).' },
  booking: { link: 'https://example.org/book' },
};
const ARROW = /<svg class="ext"[^>]*>.*?<\/svg>/g;

describe('render: interior page components at base /hangfolio', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: SITE, base: '/hangfolio' });
  });
  after(() => r?.close());

  test('JumpNav: in-page links in mono, named for screen readers', async () => {
    assert.equal(
      await r.render('JumpNav', { label: 'Project groups', items: [{ label: 'Tools', href: '#tools' }, { label: 'Research', href: '#research' }] }),
      '<nav class="jump" aria-label="Project groups"><ul class="links mono"><li><a href="#tools">Tools</a></li><li><a href="#research">Research</a></li></ul></nav>',
    );
  });

  test('RoleList: dates or terms and the place in the margin; role, org, bullets, desc and photos', async () => {
    const { entries } = parseOk(experience, {
      entries: [
        { section: 'professional', role: 'Intern', org: 'Example Co.', location: 'Remote', start: '2024-06', end: '2024-08', bullets: ['Cut CI time with **caching**.', 'See [notes](/writing/).'] },
        { section: 'teaching', role: 'TA', org: 'Institute', when: ['Fall 2024', 'Spring 2025'], bullets: ['Labs.'] },
        { section: 'earlier', role: 'Freelancer', org: 'Self', start: 2019, end: 2021, desc: 'Small *web* tools.' },
        {
          section: 'programs', role: 'Participant', org: 'Summer School', start: '2025-07',
          gallery: { caption: 'The *school*', images: [{ thumb: '/images/a-thumb.png', full: '/images/a.png', alt: 'The hall', width: 240, height: 320 }] },
        },
      ],
    });
    assert.equal(
      await r.render('RoleList', { entries }),
      '<ol class="roles">' +
        '<li class="hang"><div class="m"><span class="range"><span>Jun</span> <span>– Aug 2024</span></span><span class="where">Remote</span></div>' +
        '<div class="role"><h3>Intern <span class="org">· Example Co.</span></h3><ul class="bullets"><li>Cut CI time with <strong>caching</strong>.</li><li>See <a href="/hangfolio/writing/">notes</a>.</li></ul></div></li>' +
        '<li class="hang"><div class="m"><span><span class="nowrap">Fall 2024,</span> <span class="nowrap">Spring 2025</span></span></div>' +
        '<div class="role"><h3>TA <span class="org">· Institute</span></h3><ul class="bullets"><li>Labs.</li></ul></div></li>' +
        '<li class="hang"><div class="m"><span class="range"><span>2019</span> <span>– 2021</span></span></div>' +
        '<div class="role"><h3>Freelancer <span class="org">· Self</span></h3><p class="desc">Small <em>web</em> tools.</p></div></li>' +
        '<li class="hang"><div class="m"><span class="range"><span>Jul 2025</span></span></div>' +
        '<div class="role"><h3>Participant <span class="org">· Summer School</span></h3>' +
        '<figure class="gallery"><div class="shots"><a href="/hangfolio/images/a.png"><img src="/hangfolio/images/a-thumb.png" alt="The hall" width="240" height="320" loading="lazy" decoding="async"></a></div>' +
        '<figcaption>The <em>school</em></figcaption></figure></div></li>' +
        '</ol>',
    );
  });

  test('ContactRows: label in the margin; links under the base, an arrow only for links that leave the site', async () => {
    const html = (await r.render('ContactRows', { rows: contactRows(r.site, '/meet') })).replace(ARROW, '<svg/>');
    assert.equal(
      html,
      '<dl class="rows">' +
        '<div class="hang row"><dt class="m label">Location</dt><dd>Harbor Point</dd></div>' +
        '<div class="hang row"><dt class="m label">GitHub</dt><dd><a href="https://github.com/hangfolio">github.com/hangfolio<svg/></a></dd></div>' +
        '<div class="hang row"><dt class="m label">Lab</dt><dd><a href="mailto:lab@x.test">lab@x.test</a></dd></div>' +
        '<div class="hang row"><dt class="m label">Book a call</dt><dd><a href="/hangfolio/meet">Pick a time</a></dd></div>' +
        '</dl>',
    );
  });

  test('AvailabilityCallout, rule: the contact text as inline Markdown, links under the base', async () => {
    assert.equal(
      await r.render('AvailabilityCallout', { availability: r.site.availability, variant: 'rule' }),
      '<p class="status rule"><span class="dot" aria-hidden="true"></span><span>Looking for a <strong>Summer 2027</strong> internship. <a href="/hangfolio/meet">Book a call</a>.</span></p>',
    );
  });

  test('PostFooter: the byline from site.yaml, the address, and the way back to every post', async () => {
    assert.equal(
      await r.render('PostFooter', { index: '/writing/' }),
      '<footer class="post-foot"><p>Written by Wren Halloway, Postdoc in distributed systems at Institute of Example Studies. ' +
        'Questions or corrections: <a href="mailto:wren@halloway.test">wren@halloway.test</a>.</p>' +
        '<p><a href="/hangfolio/writing/">← All writing</a></p></footer>',
    );
    assert.doesNotMatch(await r.render('PostFooter', {}), /All writing/);
  });

  test('Note and Terminal, the MDX components', async () => {
    assert.equal(
      await r.render('Note', {}, { default: '<p>Traces sit next to the log.</p>' }),
      '<aside class="note"><p class="eyebrow">Note</p><div class="note-body"><p>Traces sit next to the log.</p></div></aside>',
    );
    assert.match(await r.render('Note', { title: 'Tip' }, { default: 'x' }), /^<aside class="note"><p class="eyebrow">Tip<\/p>/);
    assert.equal(
      await r.render('Terminal', { label: 'A trace', lines: ['$ shoal explain', '# 2 misses', '[HIGH] key leak'] }),
      '<div class="well terminal" role="group" aria-label="A trace"><div class="pre-wrap"><span class="c" aria-hidden="true">$ </span>shoal explain</div>' +
        '<div class="c"># 2 misses</div><div class="pre-wrap"><span class="sev high">[HIGH]</span> key leak</div></div>',
    );
  });
});
