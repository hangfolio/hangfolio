// M6 render tests: the <head> that layouts/Base.astro writes, at base /hangfolio. A post (a page
// with `article`) gets its BlogPosting and the contact page its ContactPage without passing them,
// a node the page passes itself wins, and the home page carries the profile names and the Google
// verification meta.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createRenderer } from './render.ts';

type Renderer = Awaited<ReturnType<typeof createRenderer>>;
const HOME = 'https://u.github.io/hangfolio/';

const graphOf = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1])['@graph'] as Record<string, unknown>[];
const headOf = (html: string) => html.slice(0, html.indexOf('</head>'));

describe('render: the Base head at base /hangfolio', () => {
  let r: Renderer;
  before(async () => {
    r = await createRenderer({
      site: {
        name: 'Wren Halloway',
        role: 'Postdoc',
        affiliation: 'Institute of Example Studies',
        pages: { contact: { path: '/get-in-touch' } },
        advanced: { googleVerification: { meta: 'Tq3-token' } },
      },
      base: '/hangfolio',
    });
  });
  after(() => r?.close());

  const base = (props: Record<string, unknown>) => r.render('../layouts/Base', props);

  test('the home page: profile names, the verification meta, the manifest and sitemap links, the generator', async () => {
    const head = headOf(await base({ title: 'Wren Halloway | Postdoc @ Institute of Example Studies', path: '/', ogType: 'profile' }));
    assert.match(head, /<link rel="canonical" href="https:\/\/u\.github\.io\/hangfolio\/"><meta name="google-site-verification" content="Tq3-token">/);
    assert.match(head, /<meta property="og:type" content="profile"><meta property="profile:first_name" content="Wren"><meta property="profile:last_name" content="Halloway">/);
    assert.match(head, /<link rel="manifest" href="\/hangfolio\/manifest\.webmanifest"><link rel="sitemap" href="\/hangfolio\/sitemap\.xml">/);
    assert.match(head, /<meta name="generator" content="hangfolio 0\.0\.0 \(Astro v[\d.]+\)">/);
    assert.deepEqual(graphOf(head).map((node) => node['@id']), [`${HOME}#website`, `${HOME}#person`]);
  });

  test('another page: no verification meta and no profile names', async () => {
    const head = headOf(await base({ title: 'Projects — Wren Halloway', path: '/projects' }));
    assert.doesNotMatch(head, /google-site-verification|profile:first_name/);
  });

  test('a post gets its BlogPosting, its headline the title without the suffix', async () => {
    const html = await base({
      title: 'Why the log lied — Wren Halloway',
      description: 'A short post.',
      path: '/writing/log-lied/',
      ogType: 'article',
      article: { published: new Date('2026-08-20T00:00:00Z'), modified: new Date('2026-09-01T00:00:00Z'), tags: ['logs'] },
    });
    const post = graphOf(html)[2];
    assert.deepEqual(post, {
      '@type': 'BlogPosting',
      '@id': `${HOME}writing/log-lied/#article`,
      headline: 'Why the log lied',
      description: 'A short post.',
      datePublished: '2026-08-20',
      dateModified: '2026-09-01',
      author: { '@id': `${HOME}#person` },
      publisher: { '@id': `${HOME}#person` },
      mainEntityOfPage: `${HOME}writing/log-lied/`,
      keywords: 'logs',
      inLanguage: 'en-US',
    });
    assert.match(headOf(html), /<meta property="article:published_time" content="2026-08-20T00:00:00.000Z">/);
    const pinned = graphOf(await base({ title: 'X — Wren Halloway', path: '/writing/x/', article: { published: new Date('2026-08-20T00:00:00Z'), headline: 'The real headline' } }))[2];
    assert.equal(pinned.headline, 'The real headline');
  });

  test('the contact page, at its configured path, gets its ContactPage; a node the page passes wins', async () => {
    const nodes = graphOf(await base({ title: 'Contact — Wren Halloway', path: '/get-in-touch' }));
    assert.deepEqual(nodes[2], {
      '@type': 'ContactPage',
      '@id': `${HOME}get-in-touch#webpage`,
      url: `${HOME}get-in-touch`,
      name: 'Contact — Wren Halloway',
      isPartOf: { '@id': `${HOME}#website` },
      about: { '@id': `${HOME}#person` },
    });
    const own = { '@type': 'ContactPage', '@id': `${HOME}get-in-touch#webpage`, name: 'Mine' };
    assert.deepEqual(graphOf(await base({ title: 'Contact', path: '/get-in-touch', schema: [own] })).slice(2), [own]);
  });
});
