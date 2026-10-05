// Render tests for the home page's lower sections, through Astro's container API (render.ts), at
// base /hangfolio so every internal link must carry it: Hang, the research section with its
// featured paper (Citation), the experience and education lists, news, posts, and the contact
// section with BigMail.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { parseBib } from '../src/lib/bib.ts';
import { citationView } from '../src/lib/citation.ts';
import { publication } from '../src/schema/publication.ts';
import { parseOk } from './helpers.ts';
import { createRenderer } from './render.ts';

type Renderer = Awaited<ReturnType<typeof createRenderer>>;

const SITE = {
  cv: '/files/cv.pdf',
  nameVariants: ['Halloway, W.'],
  links: [{ url: 'https://example.org/notes', label: 'Notes' }],
  availability: { headline: 'Open to internships.', emailSubject: 'Summer 2027', until: '2099-12' },
  booking: { link: 'https://example.org/book', label: 'Book a call' },
  advanced: { locale: 'en_GB' },
};

const [paper] = parseBib(String.raw`@inproceedings{halloway2024drift,
  title     = {Drift in \textit{Remote} Caches},
  author    = {Okonkwo, Adaeze and Halloway, W. and Lindqvist, Bj{\"o}rn and others},
  booktitle = {Proceedings of the Example Symposium (EXS '24)},
  year      = {2024},
  doi       = {10.5555/exs24.0042},
  pdf       = {drift.pdf}
}`);

describe('render: home sections at base /hangfolio', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: SITE, base: '/hangfolio' });
  });
  after(() => r?.close());

  test('Hang: a label in the margin, or the m slot; any element, class and id', async () => {
    assert.equal(await r.render('Hang', { label: 'Problem' }, { default: '<p>Text</p>' }), '<div class="hang"><div class="m label">Problem</div><p>Text</p></div>');
    assert.equal(
      await r.render('Hang', { as: 'li', class: 'pub', id: 'publication' }, { m: '<span>2024</span>', default: '<p>Body</p>' }),
      '<li class="hang pub" id="publication"><div class="m"><span>2024</span></div><p>Body</p></li>',
    );
  });

  test('Citation: owner underlined, * marks, title in quotes, venue in italics, place, note and bracketed links', async () => {
    const extras = parseOk(publication, { equal: ['Okonkwo', 'Halloway'], place: 'Kestrel Harbour', links: [{ label: 'Talk', profile: 'notes' }] });
    assert.equal(
      await r.render('Citation', { view: citationView(paper, extras, r.site) }),
      '<p>Adaeze Okonkwo*, <span class="me">W. Halloway</span>*, Björn Lindqvist, et al. ' +
        '<span class="ptitle">“Drift in <i>Remote</i> Caches.”</span> <em class="venue">Proceedings of the Example Symposium (EXS \'24)</em>, Kestrel Harbour. ' +
        '<span class="note">*Equal contribution</span></p>' +
        '<div class="links mono"><a href="/hangfolio/files/drift.pdf">[PDF]</a><a href="https://doi.org/10.5555/exs24.0042">[DOI]</a><a href="https://example.org/notes">[Talk]</a></div>',
    );
  });

  test('Citation: no venue, place or links; the title alone ends the sentence', async () => {
    const view = { authors: [{ name: 'Wren Halloway', me: true, equal: false }], title: 'A note.', links: [] };
    assert.equal(await r.render('Citation', { view }), '<p><span class="me">Wren Halloway</span>. <span class="ptitle">“A note.”</span></p>');
    const placeOnly = { authors: [], title: 'Untitled?', place: 'Online', links: [] };
    assert.equal(await r.render('Citation', { view: placeOnly }), '<p><span class="ptitle">“Untitled?”</span> Online.</p>');
  });

  test('ResearchBlock: problem, numbered approach with chips, status, featured paper and teaching', async () => {
    const research = {
      heading: 'Research',
      problem: 'Caches serve *stale* data.',
      approach: [
        { title: 'Tracing', chip: 'Rust', text: 'Explain every miss; see [the data](/files/d.pdf).' },
        { title: 'Audits', text: 'Count stale hits.' },
      ],
      status: 'One paper out.',
      featured: 'halloway2024drift',
      teaching: 'TA, Operating Systems.',
    };
    const view = citationView(paper, undefined, r.site);
    const html = await r.render('ResearchBlock', { id: 'research', research, link: { label: 'Publications', href: '/publications' }, paper: view });
    assert.equal(
      html,
      '<section id="research" class="block" aria-labelledby="research-h" data-section="research">' +
        '<div class="sec-head"><h2 id="research-h" class="eyebrow">Research</h2><a href="/hangfolio/publications">Publications</a></div>' +
        '<div class="research">' +
        '<div class="hang"><div class="m label">Problem</div><p class="essay">Caches serve <em>stale</em> data.</p></div>' +
        '<div class="hang"><div class="m label">Approach</div><ol class="approach">' +
        '<li><span class="num">01</span><div><div class="title-row tight"><h3>Tracing</h3><span class="chip">Rust</span></div><p>Explain every miss; see <a href="/hangfolio/files/d.pdf">the data</a>.</p></div></li>' +
        '<li><span class="num">02</span><div><div class="title-row tight"><h3>Audits</h3></div><p>Count stale hits.</p></div></li>' +
        '</ol></div>' +
        '<div class="hang"><div class="m label">Status</div><p class="essay">One paper out.</p></div>' +
        '</div>' +
        '<div class="hang pub" id="publication"><div class="m"><span>2024</span></div><div class="pub-body"><h3 class="eyebrow faint">Publication</h3>' +
        '<p>Adaeze Okonkwo, <span class="me">W. Halloway</span>, Björn Lindqvist, et al. <span class="ptitle">“Drift in <i>Remote</i> Caches.”</span> <em class="venue">Proceedings of the Example Symposium (EXS \'24)</em>.</p>' +
        '<div class="links mono"><a href="/hangfolio/files/drift.pdf">[PDF]</a><a href="https://doi.org/10.5555/exs24.0042">[DOI]</a></div>' +
        '</div></div>' +
        '<div class="hang"><div class="m label">Teaching</div><p class="small-text">TA, Operating Systems.</p></div>' +
        '</section>',
    );
  });

  test('ResearchBlock: only teaching; no link, no paper, no research wrapper; the default heading', async () => {
    const html = await r.render('ResearchBlock', { id: 'papers', research: { approach: [], teaching: 'TA.' } });
    assert.equal(
      html,
      '<section id="papers" class="block" aria-labelledby="papers-h" data-section="research"><div class="sec-head"><h2 id="papers-h" class="eyebrow">Research</h2></div>' +
        '<div class="hang"><div class="m label">Teaching</div><p class="small-text">TA.</p></div></section>',
    );
  });

  test('ExperienceList: dates or `when` in the margin, role, short org, home line', async () => {
    const jobs = [
      { section: 'research', role: 'Research Assistant', org: 'Institute of Example Studies', short: 'Example Studies', location: 'Saltmarsh Bay', start: '2023-09', end: 'present', home: 'Tracing & batching.' },
      { section: 'teaching', role: 'TA', org: 'Institute', when: ['Fall 2024', 'Spring 2025'], home: 'Labs.' },
      { section: 'professional', role: 'Intern', org: 'Lantern', start: '2024-06', end: '2024-08', home: 'Toolchains.' },
    ];
    assert.equal(
      await r.render('ExperienceList', { jobs }),
      '<ol class="jobs">' +
        '<li class="hang"><div class="m"><span class="range"><span>Sept 2023</span> <span>– present</span></span></div><div><h3>Research Assistant <span class="org">· Example Studies</span></h3><p>Tracing &amp; batching.</p></div></li>' +
        '<li class="hang"><div class="m"><span><span class="nowrap">Fall 2024,</span> <span class="nowrap">Spring 2025</span></span></div><div><h3>TA <span class="org">· Institute</span></h3><p>Labs.</p></div></li>' +
        '<li class="hang"><div class="m"><span class="range"><span>Jun</span> <span>– Aug 2024</span></span></div><div><h3>Intern <span class="org">· Lantern</span></h3><p>Toolchains.</p></div></li>' +
        '</ol>',
    );
  });

  test('EducationList: under a margin label with the anchor, or on its own', async () => {
    const entries = [
      { section: 'education', role: 'PhD', org: 'Institute', homeLine: { text: 'PhD, Institute', years: '2023 – 2028 (expected)' } },
      { section: 'programs', role: 'Participant', org: 'School', homeLine: { text: 'Summer School', years: '2025' } },
    ];
    const lines = '<ul class="edu-lines"><li><span>PhD, Institute</span><span class="yr">2023 – 2028 (expected)</span></li><li><span>Summer School</span><span class="yr">2025</span></li></ul>';
    assert.equal(await r.render('EducationList', { entries, label: 'Education', id: 'education' }), `<div class="hang edu" id="education"><div class="m label">Education</div>${lines}</div>`);
    assert.equal(await r.render('EducationList', { entries }), lines);
  });

  test('NewsList: the month in the margin (a day is not shown), the text as inline Markdown', async () => {
    const items = [
      { date: '2026-09-14', text: 'Wrote [a post](/writing/x/).' },
      { date: '2026-06', text: 'Released **Shoal**.' },
    ];
    assert.equal(
      await r.render('NewsList', { items }),
      '<ul class="news">' +
        '<li class="hang"><div class="m"><time datetime="2026-09-14">Sept 2026</time></div><p>Wrote <a href="/hangfolio/writing/x/">a post</a>.</p></li>' +
        '<li class="hang"><div class="m"><time datetime="2026-06">Jun 2026</time></div><p>Released <strong>Shoal</strong>.</p></li>' +
        '</ul>',
    );
  });

  test('PostList: date and title, each title linking to the post under the base', async () => {
    const posts = [{ id: 'cache-lied', data: { title: 'Why our cache lied', date: new Date('2026-09-14T00:00:00Z') } }];
    assert.equal(
      await r.render('PostList', { posts }),
      '<ul class="posts"><li><time datetime="2026-09-14">14 Sept 2026</time><a href="/hangfolio/writing/cache-lied/">Why our cache lied</a></li></ul>',
    );
  });

  test('HomeContact and BigMail: the address with the availability subject, Résumé (PDF) and booking', async () => {
    assert.equal(
      await r.render('HomeContact', { id: 'contact', heading: 'Get in touch' }),
      '<section class="block contact" aria-labelledby="contact" data-section="contact">' +
        '<div class="sec-head"><h2 id="contact" class="eyebrow">Get in touch</h2></div>' +
        '<a href="mailto:wren@halloway.test?subject=Summer%202027" class="mail">wren@halloway.test</a>' +
        '<div class="links"><a href="/hangfolio/files/cv.pdf">Résumé (PDF)</a><a href="/hangfolio/meet">Book a call</a></div>' +
        '</section>',
    );
    const later = await r.render('HomeContact', { id: 'hello', heading: 'Say hello', now: new Date('2100-06-01T00:00:00Z') });
    assert.match(later, /<a href="mailto:wren@halloway\.test" class="mail">/);
    assert.equal(await r.render('BigMail', {}), '<a href="mailto:wren@halloway.test" class="mail">wren@halloway.test</a>');
  });
});

describe('render: contact for a site with only a name and an email', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: { cv: '/files/cv.docx' } });
  });
  after(() => r?.close());

  test('a CV that is not a PDF is just Résumé; no booking link', async () => {
    const html = await r.render('HomeContact', { id: 'contact', heading: 'Get in touch' });
    assert.match(html, /<div class="links"><a href="\/files\/cv\.docx">Résumé<\/a><\/div><\/section>$/);
  });
});
