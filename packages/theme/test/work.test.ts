// What a project shows as a WorkItem (lib/work.ts) and how its exhibit is read (lib/exhibits.ts).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { barColumns, barRows, barsLabel, barWidth, terminalLines, valueText } from '../src/lib/exhibits.ts';
import { featuredProjects, resolveLinks, workView } from '../src/lib/work.ts';
import { project } from '../src/schema/project.ts';
import { site as siteSchema } from '../src/schema/site.ts';
import { parseOk } from './helpers.ts';

const site = parseOk(siteSchema, {
  name: 'Wren Halloway',
  email: 'wren@halloway.test',
  links: ['https://github.com/hangfolio', { url: 'https://hangfolio.github.io/', label: 'Notes' }],
});
const entry = (id: string, data: Record<string, unknown>) => ({ id, data: parseOk(project, { title: id, summary: `About ${id}.`, ...data }) });

describe('work items', () => {
  test('featured projects are those with a home block, by home.order, then file order', () => {
    const entries = [
      entry('a', { home: { order: 2 } }),
      entry('b', {}),
      entry('c', { home: { order: 1 } }),
      entry('d', { home: { order: 2 } }),
    ];
    assert.deepEqual(featuredProjects(entries).map((e) => e.id), ['c', 'a', 'd']);
    assert.deepEqual(featuredProjects([entry('b', {})]), []);
  });

  test('links: a URL, a command, and a profile by id (its label unless one is given); a missing profile is left out', () => {
    const links = parseOk(project, {
      title: 'x',
      summary: 'x',
      links: ['https://example.org/x', { label: 'Paper', url: '/files/p.pdf' }, { code: 'cargo install x' }, { profile: 'github' }, { label: 'Write-up', profile: 'Notes' }, { profile: 'gone' }],
    }).links;
    assert.deepEqual(resolveLinks(links, site), [
      { label: 'example.org', href: 'https://example.org/x' },
      { label: 'Paper', href: '/files/p.pdf' },
      { code: 'cargo install x' },
      { label: 'GitHub', href: 'https://github.com/hangfolio' },
      { label: 'Write-up', href: 'https://hangfolio.github.io/' },
    ]);
  });

  test('featured uses the home block: title, summary, result, links, footnote and exhibit', () => {
    const shoal = entry('shoal', {
      title: 'Shoal, a build tracer',
      kicker: 'CLI · Rust',
      start: '2025-02',
      end: 'present',
      result: 'from the front matter',
      facts: [{ label: 'Problem', text: 'Slow builds.' }],
      links: [{ label: 'Code', url: 'https://example.org/shoal' }],
      home: {
        order: 1,
        title: 'Shoal',
        summary: 'Explains slow builds.',
        result: { parts: ['62% faster', '0 regressions'], muted: '40 nodes' },
        footnote: ['In preparation'],
        exhibit: { install: { command: 'cargo install shoal' } },
      },
    });
    assert.deepEqual(workView(shoal, 'featured', { n: 1, site }), {
      id: 'shoal',
      variant: 'featured',
      number: '01',
      margin: { range: ['Feb 2025', '– present'] },
      title: 'Shoal',
      kicker: 'CLI · Rust',
      summary: 'Explains slow builds.',
      result: { tag: 'Result', parts: ['62% faster', '0 regressions'], muted: '40 nodes' },
      exhibit: { install: { command: 'cargo install shoal' } },
      facts: [],
      links: [{ label: 'Code', href: 'https://example.org/shoal' }],
      footnote: ['In preparation'],
    });

    // Without overrides in home, the project's own values are used.
    const plain = workView(entry('quay', { start: '2021', end: '2022', result: 'Shipped', home: { order: 1 } }), 'featured', { n: 12, site });
    assert.equal(plain.number, '12');
    assert.equal(plain.title, 'quay');
    assert.equal(plain.summary, 'About quay.');
    assert.deepEqual(plain.margin, { range: ['2021', '– 2022'] });
    assert.deepEqual(plain.result, { tag: 'Result', parts: ['Shipped'] });
    assert.equal(plain.exhibit, undefined);
    assert.equal(plain.footnote, undefined);
  });

  test('full shows the facts and ignores the home block; compact drops the result; margin text wins over dates', () => {
    const data = {
      title: 'Tern',
      start: '2024-06',
      end: '2024-08',
      margin: 'EXC ’24',
      result: 'Faster',
      facts: [{ label: 'Result', lines: ['3×', '0 losses'] }],
      home: { order: 1, title: 'Batched fsync', exhibit: { install: { command: 'x' } } },
    };
    const full = workView(entry('tern', data), 'full', { n: 5, site });
    assert.equal(full.title, 'Tern');
    assert.deepEqual(full.margin, { text: 'EXC ’24' });
    assert.deepEqual(full.facts, [{ label: 'Result', lines: ['3×', '0 losses'] }]);
    assert.deepEqual(full.result, { tag: 'Result', parts: ['Faster'] });
    assert.equal(full.exhibit, undefined);

    const compact = workView(entry('tern', { ...data, margin: undefined }), 'compact', { n: 7, site });
    assert.deepEqual(compact.margin, { range: ['Jun', '– Aug 2024'] });
    assert.equal(compact.result, undefined);
    assert.deepEqual(compact.facts, []);
    assert.deepEqual(workView(entry('none', {}), 'compact', { n: 1, site }).margin, { range: [] });
  });
});

describe('exhibits', () => {
  test('terminal lines: prompt, comment, severity badges, blank and plain text', () => {
    assert.deepEqual(
      terminalLines(['$ shoal explain', '# 4 misses', '[CRITICAL] a', '[HIGH] b', '[MEDIUM] c', '[LOW] d', '', '  ', 'done', '[INFO] e', '[critical] f', '$no space', '#tag']),
      [
        { kind: 'prompt', text: 'shoal explain' },
        { kind: 'comment', text: '# 4 misses' },
        { kind: 'severity', severity: 'CRITICAL', text: 'a' },
        { kind: 'severity', severity: 'HIGH', text: 'b' },
        { kind: 'severity', severity: 'MEDIUM', text: 'c' },
        { kind: 'severity', severity: 'LOW', text: 'd' },
        { kind: 'blank' },
        { kind: 'blank' },
        { kind: 'text', text: 'done' },
        { kind: 'text', text: '[INFO] e' },
        { kind: 'text', text: '[critical] f' },
        { kind: 'text', text: '$no space' },
        { kind: 'text', text: '#tag' },
      ],
    );
  });

  test('values with units: a space before a word, none before a symbol', () => {
    assert.equal(valueText(8.6, 'GB'), '8.6 GB');
    assert.equal(valueText(300, 'ms'), '300 ms');
    assert.equal(valueText(45, '%'), '45%');
    assert.equal(valueText(3, '×'), '3×');
    assert.equal(valueText(21, '°C'), '21°C');
    assert.equal(valueText(7), '7');
  });

  test('bar widths are value / max, rounded to 0.1%', () => {
    assert.equal(barWidth(12.7, 12.7), '100%');
    assert.equal(barWidth(4.2, 12.7), '33.1%');
    assert.equal(barWidth(6, 412), '1.5%');
    assert.equal(barWidth(1, 3), '33.3%');
    assert.equal(barWidth(2, 3), '66.7%');
    assert.equal(barWidth(0, 5), '0%');
    assert.equal(barWidth(0, 0), '0%');
  });

  test('bar rows and the label that carries every value', () => {
    const bars = parseOk(project, {
      title: 'x',
      summary: 'x',
      home: {
        order: 1,
        exhibit: {
          bars: {
            label: 'Queue delay:',
            rows: [{ label: 'Peak', value: 12.7, unit: 'ms', tone: 'accent' }, { label: 'Calm', value: 4.2, unit: 'ms', tone: 'faint' }],
            caption: '**~3×** longer at peak',
          },
        },
      },
    }).home!.exhibit!.bars!;
    assert.deepEqual(barRows(bars), [
      { label: 'Peak', value: '12.7 ms', width: '100%', tone: 'accent' },
      { label: 'Calm', value: '4.2 ms', width: '33.1%', tone: 'faint' },
    ]);
    assert.equal(barsLabel(bars), 'Queue delay: Peak 12.7 ms, Calm 4.2 ms');
    assert.equal(barsLabel({ ...bars, label: 'Delay' }), 'Delay: Peak 12.7 ms, Calm 4.2 ms');
    // The longest label and value in characters (code points, so "é" counts once)
    assert.deepEqual(barColumns(barRows(bars)), { label: 4, value: 7 });
    assert.deepEqual(barColumns([{ label: 'Caché', value: '3×', width: '100%', tone: 'accent' }]), { label: 5, value: 2 });
    assert.deepEqual(barColumns([]), { label: 0, value: 0 });
  });
});
