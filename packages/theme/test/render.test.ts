// Render tests: the home page components turned into HTML through Astro's container API (see
// render.ts), at base /hangfolio so every internal link must carry it. Icons are shortened to
// <svg class="…"/> to keep the expected markup readable.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createRenderer } from './render.ts';

type Renderer = Awaited<ReturnType<typeof createRenderer>>;

const icons = (html: string) => html.replace(/<svg( class="[^"]*")?[^>]*>.*?<\/svg>/g, (_, cls = '') => `<svg${cls}/>`);

const FULL = {
  tagline: 'I make *slow* builds explain themselves.',
  role: 'Postdoc',
  affiliation: { name: 'Institute of Example Studies', url: 'https://example.org' },
  pronouns: 'they/them',
  location: 'Harbor Point',
  avatar: '/images/me.jpg',
  cv: '/files/cv.pdf',
  links: ['https://github.com/hangfolio', { url: 'mailto:lab@x.test', label: 'Lab' }, { url: 'https://bsky.app/', hero: false }],
  availability: {
    headline: 'Open to internships · Summer 2027.',
    detail: 'Back to the PhD after.',
    contact: "I'm looking for a **Summer 2027** internship.",
    emailSubject: 'Summer 2027',
    until: '2099-12',
  },
  booking: { link: 'https://example.org/book', label: 'Book a call' },
  advanced: { labels: { now: 'Currently:', src: 'source ·' } },
};

describe('render: a full site at base /hangfolio', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: FULL, base: '/hangfolio' });
  });
  after(() => r?.close());

  test('Hero: photo, whoami, tagline, intro, Now line, availability box, calls to action and profiles', async () => {
    const html = icons(await r.render('Hero', { home: { intro: 'Advised by [Dr. Ada](https://example.org/ada); see [my CV](/files/cv.pdf).', now: 'a `fsync` paper.' } }));
    assert.equal(
      html,
      '<section class="hero" aria-labelledby="name">' +
        '<div class="hero-id"><img class="avatar" src="/hangfolio/images/me.jpg" alt="Portrait of Wren Halloway" width="72" height="72" fetchpriority="high">' +
        '<div class="id-text"><h1 id="name">Wren Halloway</h1><p class="whoami">they/them · Harbor Point</p></div></div>' +
        '<p class="lede">I make <em>slow</em> builds explain themselves.</p>' +
        '<div class="intro">' +
        '<p class="muted">Advised by <a href="https://example.org/ada">Dr. Ada</a>; see <a href="/hangfolio/files/cv.pdf">my CV</a>.</p>' +
        '<p class="now"><span class="strong">Currently:</span> a <code>fsync</code> paper.</p>' +
        '<p class="status box"><span class="dot" aria-hidden="true"></span><span><strong>Open to internships · Summer 2027.</strong> <span class="muted">Back to the PhD after.</span></span></p>' +
        '</div>' +
        '<div class="actions"><div class="cta">' +
        '<a href="/hangfolio/files/cv.pdf" class="btn"><svg/><span>Résumé</span><span class="pdf">PDF</span></a>' +
        '<a href="mailto:wren@halloway.test?subject=Summer%202027">Email</a>' +
        '<a href="/hangfolio/meet">Book a call</a>' +
        '</div>' +
        '<ul class="prof" aria-label="Profiles"><li><a class="soft" href="https://github.com/hangfolio">GitHub<svg class="ext"/></a></li><li><a class="soft" href="mailto:lab@x.test">Lab</a></li></ul>' +
        '</div></section>',
    );
  });

  test('Hero: without home.yaml the intro is role and affiliation; a past `until` hides the box and the subject', async () => {
    const html = await r.render('Hero', { now: new Date('2100-01-01T00:00:00Z') });
    assert.match(html, /<div class="intro"><p class="muted">Postdoc · <a href="https:\/\/example\.org">Institute of Example Studies<\/a><\/p><\/div>/);
    assert.doesNotMatch(html, /status|class="now"/);
    assert.match(html, /<a href="mailto:wren@halloway\.test">Email<\/a>/);
  });

  test('AvailabilityCallout: box, rule with `contact`, and rule plus a slot', async () => {
    const availability = r.site.availability;
    assert.equal(
      await r.render('AvailabilityCallout', { availability, variant: 'rule' }),
      `<p class="status rule"><span class="dot" aria-hidden="true"></span><span>I'm looking for a <strong>Summer 2027</strong> internship.</span></p>`,
    );
    assert.equal(
      await r.render('AvailabilityCallout', { availability: { headline: 'Open.' }, variant: 'rule' }, { default: 'Email me.' }),
      '<p class="status rule"><span class="dot" aria-hidden="true"></span><span><strong>Open.</strong> Email me.</span></p>',
    );
    assert.equal(
      await r.render('AvailabilityCallout', { availability: { headline: 'Open.' } }),
      '<p class="status box"><span class="dot" aria-hidden="true"></span><span><strong>Open.</strong></span></p>',
    );
  });

  test('ResultsStrip: prefix and arrow spans, source links through the base, one column per item', async () => {
    const items = [
      { value: 'up to 40%', what: 'lower p99 latency', source: '[Paper](/files/p.pdf), EXC ’24' },
      { value: '3s → 300ms', what: 'API latency' },
      { value: '12/12', what: 'bugs found', source: '[Shoal](#work)' },
    ];
    assert.equal(
      await r.render('ResultsStrip', { id: 'results', heading: 'Results at a glance', items }),
      '<section class="block tight-gap" aria-labelledby="results" data-section="highlights">' +
        '<div class="sec-head"><h2 id="results" class="eyebrow">Results at a glance</h2></div>' +
        '<ul class="proof" style="--cols: 3">' +
        '<li><span class="big nowrap"><span class="pre">up to </span>40%</span><span class="what">lower p99 latency</span><span class="src">source · <a href="/hangfolio/files/p.pdf">Paper</a>, EXC ’24</span></li>' +
        '<li><span class="big nowrap">3s<span class="arrow"> → </span>300ms</span><span class="what">API latency</span></li>' +
        '<li><span class="big">12/12</span><span class="what">bugs found</span><span class="src">source · <a href="#work">Shoal</a></span></li>' +
        '</ul></section>',
    );
  });

  test('SectionHead and DateRange (dates, or `when` text instead)', async () => {
    assert.equal(
      await r.render('SectionHead', { id: 'work', heading: 'Selected work', link: { label: 'All projects', href: '/projects' } }),
      '<div class="sec-head"><h2 id="work" class="eyebrow">Selected work</h2><a href="/hangfolio/projects">All projects</a></div>',
    );
    assert.equal(await r.render('DateRange', { start: '2024-06', end: '2024-08' }), '<span class="range"><span>Jun</span> <span>– Aug 2024</span></span>');
    assert.equal(await r.render('DateRange', { start: '2025-01', end: '2029-05', expected: true }), '<span class="range"><span>Jan 2025</span> <span>– May 2029</span> <span>(expected)</span></span>');
    assert.equal(await r.render('DateRange', {}), '');
    assert.equal(await r.render('DateRange', { start: '2024-01', when: ['Spring 2025'] }), '<span><span class="nowrap">Spring 2025</span></span>');
    assert.equal(await r.render('DateRange', { start: '2024-01', when: [] }), '<span class="range"><span>Jan 2024</span></span>');
  });

  test('WorkItem featured: number and dates in the margin, result line, exhibit and links', async () => {
    const view = {
      id: 'shoal',
      variant: 'featured',
      number: '01',
      margin: { range: ['Feb 2025', '– present'] },
      title: 'Shoal',
      kicker: 'CLI · Rust',
      summary: 'Explains *slow* builds.',
      result: { tag: 'Result', parts: ['**62%** faster', '0 regressions'], muted: '40 nodes' },
      exhibit: { install: { command: 'cargo install shoal' } },
      facts: [],
      links: [{ label: 'Case study', href: '/projects/shoal/' }, { label: 'Code', href: 'https://example.org/shoal' }, { code: 'cargo install shoal' }],
    };
    assert.equal(
      await r.render('WorkItem', { view }),
      '<li class="hang featured">' +
        '<div class="m"><span class="n">01</span><span class="range"><span>Feb 2025</span> <span>– present</span></span></div>' +
        '<div class="work">' +
        '<div class="title-row"><h3>Shoal</h3><span class="kicker">CLI · Rust</span></div>' +
        '<p>Explains <em>slow</em> builds.</p>' +
        '<p class="result"><span class="tag">Result</span><span><strong>62%</strong> faster · 0 regressions</span><span class="muted">40 nodes</span></p>' +
        '<div class="well terminal install" role="group" aria-label="Install"><div class="pre-wrap"><span class="c" aria-hidden="true">$ </span>cargo install shoal</div></div>' +
        '<div class="links"><a href="/hangfolio/projects/shoal/">Case study</a><a href="https://example.org/shoal">Code</a><code class="inline-code">cargo install shoal</code></div>' +
        '</div></li>',
    );
  });

  test('WorkItem featured with a footnote: margin text, and the footnote instead of links', async () => {
    const view = { id: 'tern', variant: 'featured', number: '02', margin: { text: 'In prep.' }, title: 'Tern', summary: 'Batches fsync.', facts: [], links: [{ label: 'x', href: '/x' }], footnote: ['Under submission', 'No public link yet'] };
    assert.equal(
      await r.render('WorkItem', { view }),
      '<li class="hang featured"><div class="m"><span class="n">02</span><span>In prep.</span></div>' +
        '<div class="work"><div class="title-row"><h3>Tern</h3></div><p>Batches fsync.</p>' +
        '<div class="links mono faint"><span>Under submission</span><span>No public link yet</span></div></div></li>',
    );
  });

  test('WorkItem full: the facts list (text, lines, code, note with a terminal)', async () => {
    const view = {
      id: 'quay',
      variant: 'full',
      number: '05',
      margin: { range: [] },
      title: 'Quay',
      summary: 'Mirrors registries.',
      facts: [
        { label: 'Problem', text: 'Builds need the **network**.' },
        { label: 'Result', lines: ['9 min → 70s', '0 failures'] },
        { label: 'Install', code: 'go install quay' },
        { label: 'Source', note: 'From source.', terminal: { label: 'Build Quay', lines: ['$ make'] } },
        { label: 'Status', note: 'Archived.' },
      ],
      links: [],
    };
    assert.equal(
      await r.render('WorkItem', { view }),
      '<li class="hang full"><div class="m"><span class="n">05</span></div>' +
        '<div class="work"><div class="title-row"><h3>Quay</h3></div><p>Mirrors registries.</p>' +
        '<dl class="facts">' +
        '<div><dt>Problem</dt><dd>Builds need the <strong>network</strong>.</dd></div>' +
        '<div><dt>Result</dt><dd class="nums"><span>9 min → 70s</span><span>0 failures</span></dd></div>' +
        '<div><dt>Install</dt><dd><code class="inline-code">go install quay</code></dd></div>' +
        '<div><dt>Source</dt><dd class="install"><span>From source.</span><div class="well terminal" role="group" aria-label="Build Quay"><div class="pre-wrap"><span class="c" aria-hidden="true">$ </span>make</div></div></dd></div>' +
        '<div><dt>Status</dt><dd>Archived.</dd></div>' +
        '</dl></div></li>',
    );
  });

  test('WorkItem compact: title, summary and links only', async () => {
    const view = { id: 'kelp', variant: 'compact', number: '07', margin: { range: ['2022'] }, title: 'Kelp', kicker: 'Python', summary: 'Log helpers.', facts: [], links: [{ label: 'GitHub', href: 'https://github.com/hangfolio' }] };
    assert.equal(
      await r.render('WorkItem', { view }),
      '<li class="hang compact"><div class="m"><span class="n">07</span><span class="range"><span>2022</span></span></div>' +
        '<div class="work"><div class="title-row"><h3>Kelp</h3><span class="kicker">Python</span></div><p>Log helpers.</p>' +
        '<div class="links"><a href="https://github.com/hangfolio">GitHub</a></div></div></li>',
    );
  });

  test('ExhibitTerminal: prompts, comments (spaces kept only when they run), severity badges, blank lines; text is escaped', async () => {
    const lines = ['$ shoal explain <target>', '# 2 misses', '#   cause    count', '[CRITICAL] a', '[HIGH] b', '[MEDIUM] c', '[LOW] d', '', 'done  in 0.8s'];
    assert.equal(
      await r.render('ExhibitTerminal', { label: 'Sample output', lines }),
      '<div class="well terminal" role="group" aria-label="Sample output">' +
        '<div class="pre-wrap"><span class="c" aria-hidden="true">$ </span>shoal explain &lt;target&gt;</div>' +
        '<div class="c"># 2 misses</div>' +
        '<div class="c pre-wrap">#   cause    count</div>' +
        '<div class="pre-wrap"><span class="sev critical">[CRITICAL]</span> a</div>' +
        '<div class="pre-wrap"><span class="sev high">[HIGH]</span> b</div>' +
        '<div class="pre-wrap"><span class="sev medium">[MEDIUM]</span> c</div>' +
        '<div class="pre-wrap"><span class="sev low">[LOW]</span> d</div>' +
        '<div class="pre-wrap" aria-hidden="true"> </div>' +
        '<div class="pre-wrap">done  in 0.8s</div>' +
        '</div>',
    );
  });

  test('ExhibitMetrics: before → after rows, highlighted afters, and the footer', async () => {
    const metrics = {
      title: 'ablation',
      rows: [{ label: 'hit rate', before: '0.41', after: '0.78', highlight: true }, { label: 'fsyncs', before: '1.00', after: '0.12', highlight: false }],
      footer: '0 regressions',
      footerMuted: '(30 runs)',
    };
    const arrow = '<span class="c" aria-hidden="true">→</span><span class="visually-hidden">to</span>';
    assert.equal(
      await r.render('ExhibitMetrics', metrics),
      '<div class="well metrics" role="group" aria-label="ablation"><div class="c"># ablation</div><dl>' +
        `<dt>hit rate</dt><dd><span class="muted">0.41</span> ${arrow} <span class="hi">0.78</span></dd>` +
        `<dt>fsyncs</dt><dd><span class="muted">1.00</span> ${arrow} <span>0.12</span></dd>` +
        '</dl><div>0 regressions <span class="muted">(30 runs)</span></div></div>',
    );
    assert.doesNotMatch(await r.render('ExhibitMetrics', { title: 't', rows: metrics.rows }), /<\/dl><div>/);
  });

  test('ExhibitBars: widths value / max to 0.1%, tones, units, column widths, a label with every value, and the caption', async () => {
    const bars = {
      label: 'Queue delay',
      rows: [{ label: 'Peak', value: 12.7, unit: 'ms', tone: 'accent' }, { label: 'Calm', value: 4.2, unit: 'ms', tone: 'faint' }],
      caption: '**~3×** longer at peak',
    };
    assert.equal(
      await r.render('ExhibitBars', bars),
      '<figure class="well bars"><div class="bar-rows" role="img" aria-label="Queue delay: Peak 12.7 ms, Calm 4.2 ms" style="--label: 4ch; --value: 7ch">' +
        '<div class="bar-row"><span>Peak</span><span class="track"><span class="fill" style="width: 100%"></span></span><span class="val">12.7 ms</span></div>' +
        '<div class="bar-row"><span>Calm</span><span class="track"><span class="fill low" style="width: 33.1%"></span></span><span class="val">4.2 ms</span></div>' +
        '</div><figcaption><strong>~3×</strong> longer at peak</figcaption></figure>',
    );
  });

  test('Exhibit picks the one exhibit given', async () => {
    assert.match(await r.render('Exhibit', { exhibit: { terminal: { label: 'Out', lines: ['ok'] } } }), /^<div class="well terminal" role="group" aria-label="Out">/);
    assert.match(await r.render('Exhibit', { exhibit: { metrics: { title: 'm', rows: [{ label: 'a', before: '1', after: '2' }] } } }), /^<div class="well metrics"/);
    assert.match(await r.render('Exhibit', { exhibit: { bars: { label: 'b', rows: [{ label: 'a', value: 1, tone: 'accent' }], caption: 'c' } } }), /^<figure class="well bars">/);
    assert.match(await r.render('Exhibit', { exhibit: { install: { command: 'npm i x' } } }), /^<div class="well terminal install"/);
  });
});

describe('render: a site with only a name and an email, at base /', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: {} });
  });
  after(() => r?.close());

  test('Hero: the monogram, the name, and Email as the button; nothing else', async () => {
    assert.equal(
      await r.render('Hero', {}),
      '<section class="hero" aria-labelledby="name"><div class="hero-id"><span class="monogram" aria-hidden="true">WH</span>' +
        '<div class="id-text"><h1 id="name">Wren Halloway</h1></div></div>' +
        '<div class="actions"><div class="cta"><a href="mailto:wren@halloway.test" class="btn">Email</a></div></div></section>',
    );
  });
});

describe('render: the demo site', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: { booking: { calcom: 'rowan/30min' } }, demo: true });
  });
  after(() => r?.close());

  test('Hero: booking goes to the booking page (its stand-in), never to Cal.com with the fictional name', async () => {
    const html = await r.render('Hero', {});
    assert.doesNotMatch(html, /cal\.com/);
    assert.match(html, /<a href="\/meet">Book a 1:1<\/a>/);
  });
});
