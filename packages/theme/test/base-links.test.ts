import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseLinks } from '../src/lib/base-links.ts';

// Runs the plugin's visitor over one element, the way Sätteri calls it, with a stand-in context.
function rewrite(base: string, properties: Record<string, unknown>) {
  const node = { type: 'element', tagName: 'a', properties: { ...properties }, children: [] };
  const ctx = { setProperty: (_: unknown, key: string, value: unknown) => (node.properties[key] = value) };
  baseLinks(base).element.visit(node as never, ctx as never);
  return node.properties;
}

test('root-relative links and images get the base', () => {
  assert.deepEqual(rewrite('/hangfolio', { href: '/projects' }), { href: '/hangfolio/projects' });
  assert.deepEqual(rewrite('/hangfolio/', { src: '/images/a.png' }), { src: '/hangfolio/images/a.png' });
  assert.deepEqual(rewrite('/hangfolio', { href: '/writing//x/' }), { href: '/hangfolio/writing/x/' });
  assert.deepEqual(rewrite('/hangfolio', { href: '/hangfolios' }), { href: '/hangfolio/hangfolios' });
});

test('values that already carry the base are left alone', () => {
  for (const href of ['/hangfolio', '/hangfolio/', '/hangfolio/projects', '/hangfolio#x', '/hangfolio?q=1']) {
    assert.deepEqual(rewrite('/hangfolio', { href }), { href });
  }
});

test('relative, absolute, fragment, mailto and protocol-relative values are untouched', () => {
  for (const href of ['projects', '../x', 'https://example.org/', '#top', 'mailto:a@example.org', '//cdn.example.org/x']) {
    assert.deepEqual(rewrite('/hangfolio', { href }), { href });
  }
});

test('at base / nothing changes except // collapsing', () => {
  assert.deepEqual(rewrite('/', { href: '/projects' }), { href: '/projects' });
  assert.deepEqual(rewrite('/', { href: '/a//b' }), { href: '/a/b' });
});

test('the plugin only visits a and img', () => {
  assert.deepEqual(baseLinks('/').element.filter, ['a', 'img']);
});
