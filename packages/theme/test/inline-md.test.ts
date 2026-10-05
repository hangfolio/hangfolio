// Inline Markdown in YAML text fields (SPEC 5.1): links, bold, em and code; everything else is
// text, escaped; site-relative links get the base path.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { escapeHtml, inlineMd } from '../src/lib/inline-md.ts';

const md = (text: string, base = '/') => inlineMd(text, base);

describe('inlineMd', () => {
  test('plain text is escaped and otherwise kept exactly', () => {
    assert.equal(md('Fish & chips <b>not bold</b> "quoted" it’s EXC ’24'), 'Fish &amp; chips &lt;b&gt;not bold&lt;/b&gt; &quot;quoted&quot; it’s EXC ’24');
    assert.equal(md(''), '');
    assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  test('bold, em and code', () => {
    assert.equal(md('a **Summer 2027** internship'), 'a <strong>Summer 2027</strong> internship');
    assert.equal(md('tell you *why* it is'), 'tell you <em>why</em> it is');
    assert.equal(md('a paper on `fsync` batching'), 'a paper on <code>fsync</code> batching');
    assert.equal(md('**bold with *em* inside**'), '<strong>bold with <em>em</em> inside</strong>');
    assert.equal(md('*em with **bold** inside*'), '<em>em with <strong>bold</strong> inside</em>');
    assert.equal(md('a*b*c'), 'a<em>b</em>c');
  });

  test('code is literal: no marks, HTML escaped, one padding space trimmed, longer fences', () => {
    assert.equal(md('`**not bold** <x>`'), '<code>**not bold** &lt;x&gt;</code>');
    assert.equal(md('`` a ` b ``'), '<code>a ` b</code>');
    assert.equal(md('**a `*` b**'), '<strong>a <code>*</code> b</strong>');
  });

  test('marks that do not pair stay as text', () => {
    assert.equal(md('5 * 3 * 2'), '5 * 3 * 2');
    assert.equal(md('a ** b'), 'a ** b');
    assert.equal(md('*open only'), '*open only');
    assert.equal(md('**open only'), '**open only');
    assert.equal(md('`unclosed'), '`unclosed');
    assert.equal(md('[no link] here'), '[no link] here');
    assert.equal(md('[spaced](a b)'), '[spaced](a b)');
    assert.equal(md('snake_case_name'), 'snake_case_name');
  });

  test('a backslash keeps a mark as text', () => {
    assert.equal(md('\\*not em\\*'), '*not em*');
    assert.equal(md('\\[not a link](x)'), '[not a link](x)');
    assert.equal(md('C:\\path'), 'C:\\path');
  });

  test('links: external unchanged, site-relative with the base, fragments unchanged', () => {
    assert.equal(md('[Example](https://example.org/a?b=1&c=2)'), '<a href="https://example.org/a?b=1&amp;c=2">Example</a>');
    assert.equal(md('[CV](/files/cv.pdf)', '/hangfolio'), '<a href="/hangfolio/files/cv.pdf">CV</a>');
    assert.equal(md('[CV](files/cv.pdf)', '/hangfolio/'), '<a href="/hangfolio/files/cv.pdf">CV</a>');
    assert.equal(md('[CV](/files/cv.pdf)', '/'), '<a href="/files/cv.pdf">CV</a>');
    assert.equal(md('[up](#research)', '/hangfolio'), '<a href="#research">up</a>');
    assert.equal(md('[mail](mailto:a@b.test)'), '<a href="mailto:a@b.test">mail</a>');
  });

  test('a link that already has the base is not prefixed twice (W601 reports it)', () => {
    assert.equal(md('[P](/hangfolio/projects)', '/hangfolio'), '<a href="/hangfolio/projects">P</a>');
    assert.equal(md('[P](/hangfolios)', '/hangfolio'), '<a href="/hangfolio/hangfolios">P</a>');
  });

  test('link text can hold marks; destinations can hold balanced parentheses', () => {
    assert.equal(md('[**Tidepool** `v1`](/projects/tidepool/)'), '<a href="/projects/tidepool/"><strong>Tidepool</strong> <code>v1</code></a>');
    assert.equal(md('[Wiki](https://example.org/A_(b))'), '<a href="https://example.org/A_(b)">Wiki</a>');
    assert.equal(md('[a [b] c](/x)'), '<a href="/x">a [b] c</a>');
    assert.equal(md('**[bold link](/x)**'), '<strong><a href="/x">bold link</a></strong>');
  });

  test('links that would run code keep their text and lose the link', () => {
    assert.equal(md('[click](javascript:alert(1))'), 'click');
    assert.equal(md('[x](JavaScript:void(0))'), 'x');
    assert.equal(md('[x](data:text/html,hi)'), 'x');
  });

  test('a quote in a link target cannot leave the attribute', () => {
    assert.equal(md('[x](https://example.org/"onmouseover=")'), '<a href="https://example.org/&quot;onmouseover=&quot;">x</a>');
  });
});
