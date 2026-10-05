// Render tests for the publications components, through Astro's container API (render.ts), at
// base /hangfolio so every internal link must carry it: PublicationEntry with its BibtexBlock,
// InPrepList, and the home page's ResearchBlock with more than one featured paper.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { paperView } from '../src/lib/bib-page.ts';
import { parseBib } from '../src/lib/bib.ts';
import { citationView } from '../src/lib/citation.ts';
import { publication } from '../src/schema/publication.ts';
import { parseOk } from './helpers.ts';
import { createRenderer } from './render.ts';

type Renderer = Awaited<ReturnType<typeof createRenderer>>;

const [drift, quay] = parseBib(String.raw`@inproceedings{halloway2024drift,
  title     = {Drift in \textit{Remote} Caches},
  author    = {Okonkwo, Adaeze and Halloway, W. and Lindqvist, Bj{\"o}rn},
  booktitle = {Proceedings of the Example Symposium (EXS '24)},
  year      = {2024},
  doi       = {10.5555/exs24.0042},
  pdf       = {drift.pdf},
  abbr      = {EXS ’24},
  keywords  = {caches}
}
@article{halloway2022quay,
title={Offline package mirrors & more},
author={Halloway, Wren},
journal={Journal of Example Engineering},
year={2022}
}`);

// The script the BibTeX block brings is served by Vite here; the page build inlines it.
const noScript = (html: string) => html.replace(/<script\b[^>]*><\/script>/g, '');

describe('render: publications at base /hangfolio', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({ site: { links: [{ url: 'https://example.org/notes', label: 'Notes' }] }, base: '/hangfolio' });
  });
  after(() => r?.close());

  test('BibtexBlock: the text as given, escaped; a hidden Copy button; a live region', async () => {
    assert.equal(
      noScript(await r.render('BibtexBlock', { id: 'bibtex-x', text: '@misc{x,\n  title = {A & <B>}\n}', label: 'BibTeX entry for “A”' })),
      '<div class="part" id="bibtex-x" data-bibtex><div class="sec-head"><h4 class="eyebrow">BibTeX</h4>' +
        '<button type="button" class="copy" hidden><span class="lbl">Copy</span><span class="visually-hidden"> BibTeX</span></button></div>' +
        '<pre class="bib" role="region" tabindex="0" aria-label="BibTeX entry for “A”"><code>@misc{x,\n  title = {A &amp; &lt;B&gt;}\n}</code></pre>' +
        '<p class="visually-hidden" role="status" aria-live="polite"></p></div>',
    );
  });

  test('PublicationEntry: margin, title, authors, note, venue and place, DOI, data, links, summary and BibTeX', async () => {
    const extras = parseOk(publication, {
      equal: ['Okonkwo', 'Halloway'],
      authorNote: '*Co-first authors',
      place: 'Kestrel Harbour',
      anchor: 'exs24',
      bibtexAnchor: 'bibtex',
      data: { text: '9,400 phones in [six countries](/files/countries.pdf)' },
      links: [{ label: 'Talk', profile: 'notes' }],
    });
    const html = noScript(await r.render('PublicationEntry', { view: paperView(drift, extras, r.site) }, { default: '<p>We measured drift.</p>' }));
    assert.equal(
      html,
      '<article class="hang" id="exs24" aria-labelledby="exs24-title"><div class="m"><span class="n">2024</span><span>EXS ’24</span></div><div class="paper"><div class="cite">' +
        '<h3 id="exs24-title" class="ptitle">Drift in <i>Remote</i> Caches</h3>' +
        '<p class="authors">Adaeze Okonkwo*, <span class="me">W. Halloway</span>*, Björn Lindqvist</p>' +
        '<p class="note">*Co-first authors</p>' +
        '<p class="venue-line"><em class="venue">Proceedings of the Example Symposium (EXS \'24)</em>, Kestrel Harbour</p>' +
        '<p class="doi"><a href="https://doi.org/10.5555/exs24.0042">doi:10.5555/exs24.0042</a></p></div>' +
        '<p class="result"><span class="tag">Data</span><span>9,400 phones in <a href="/hangfolio/files/countries.pdf">six countries</a></span></p>' +
        '<div class="links mono"><a href="/hangfolio/files/drift.pdf">[PDF]</a><a href="https://example.org/notes">[Talk]</a><a href="#bibtex">[BibTeX]</a></div>' +
        '<div class="part"><div class="sec-head"><h4 class="eyebrow">Summary</h4></div><div class="prose summary"><p>We measured drift.</p></div></div>' +
        '<div class="part" id="bibtex" data-bibtex><div class="sec-head"><h4 class="eyebrow">BibTeX</h4>' +
        '<button type="button" class="copy" hidden><span class="lbl">Copy</span><span class="visually-hidden"> BibTeX</span></button></div>' +
        '<pre class="bib" role="region" tabindex="0" aria-label="BibTeX entry for the EXS ’24 paper"><code>@inproceedings{halloway2024drift,\n' +
        '  title     = {Drift in \\textit{Remote} Caches},\n' +
        '  author    = {Okonkwo, Adaeze and Halloway, W. and Lindqvist, Bj{\\&quot;o}rn},\n' +
        '  booktitle = {Proceedings of the Example Symposium (EXS &#39;24)},\n' +
        '  year      = {2024},\n' +
        '  doi       = {10.5555/exs24.0042},\n' +
        '  pdf       = {drift.pdf},\n' +
        '  abbr      = {EXS ’24}\n' +
        '}</code></pre><p class="visually-hidden" role="status" aria-live="polite"></p></div></div></article>',
    );
  });

  test('PublicationEntry: no extras, no summary; text escaped', async () => {
    const html = noScript(await r.render('PublicationEntry', { view: paperView(quay, undefined, r.site) }));
    assert.match(html, /^<article class="hang" id="halloway2022quay" aria-labelledby="halloway2022quay-title"><div class="m"><span class="n">2022<\/span><\/div>/);
    assert.match(html, /<h3 id="halloway2022quay-title" class="ptitle">Offline package mirrors &amp; more<\/h3><p class="authors"><span class="me">Wren Halloway<\/span><\/p><p class="venue-line"><em class="venue">Journal of Example Engineering<\/em><\/p><\/div>/);
    assert.match(html, /<div class="links mono"><a href="#bibtex-halloway2022quay">\[BibTeX\]<\/a><\/div><div class="part" id="bibtex-halloway2022quay" data-bibtex>/);
    assert.doesNotMatch(html, /Summary|class="doi"|class="note"|class="result"/);
  });

  test('InPrepList: numbered, margin, chip, authors, Markdown text, and the aside', async () => {
    const items = [
      { id: 'a', number: '01', margin: 'Go · Java', title: 'Reordering layer', chip: 'Venue 2027 · in preparation', authors: [{ name: 'Wren Halloway', me: true }, { name: 'Ada Advisor', url: '/people/ada', me: false }], text: 'See [the data](/files/x.pdf).' },
      { id: 'b', number: '02', title: 'Second', authors: [], text: 'Plain & simple.' },
    ];
    assert.equal(
      await r.render('InPrepList', { items, aside: 'No *public* link yet.' }),
      '<ol class="prep">' +
        '<li class="hang"><div class="m"><span class="n">01</span><span>Go · Java</span></div><div class="item"><div class="title-row"><h3>Reordering layer</h3><span class="chip">Venue 2027 · in preparation</span></div>' +
        '<p class="authors"><span class="me">Wren Halloway</span>, <a href="/hangfolio/people/ada">Ada Advisor</a></p><p>See <a href="/hangfolio/files/x.pdf">the data</a>.</p></div></li>' +
        '<li class="hang"><div class="m"><span class="n">02</span></div><div class="item"><div class="title-row"><h3>Second</h3></div><p>Plain &amp; simple.</p></div></li>' +
        '</ol><p class="aside">No <em>public</em> link yet.</p>',
    );
    assert.doesNotMatch(await r.render('InPrepList', { items }), /class="aside"/);
  });

  test('ResearchBlock: several featured papers; the first is #publication under "Publications"', async () => {
    const papers = [citationView(drift, undefined, r.site), citationView(quay, undefined, r.site)].map((view) => ({ ...view, links: [...view.links, { label: 'BibTeX', href: '/publications#bibtex-x' }] }));
    const html = await r.render('ResearchBlock', { id: 'research', research: { approach: [] }, link: { label: 'Publications', href: '/publications' }, papers });
    assert.match(html, /<a href="\/hangfolio\/publications">Publications<\/a><\/div><div class="hang pub" id="publication"><div class="m"><span>2024<\/span><\/div><div class="pub-body"><h3 class="eyebrow faint">Publications<\/h3><p>Adaeze Okonkwo/);
    assert.match(html, /<div class="hang pub"><div class="m"><span>2022<\/span><\/div><div class="pub-body"><p><span class="me">Wren Halloway<\/span>\. /);
    assert.equal([...html.matchAll(/<a href="\/hangfolio\/publications#bibtex-x">\[BibTeX\]<\/a>/g)].length, 2);
  });
});
