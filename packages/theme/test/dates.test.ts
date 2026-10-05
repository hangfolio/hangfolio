// The DateRange rule (SPEC 5.7) and month labels, read in UTC.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateRange, monthYear } from '../src/lib/dates.ts';

test('monthYear: short month and year in the locale; a year alone stays a year; days are not shown', () => {
  assert.equal(monthYear('2026-08'), 'Aug 2026');
  assert.equal(monthYear('2026-01-01'), 'Jan 2026');
  assert.equal(monthYear('2026-12-31'), 'Dec 2026');
  assert.equal(monthYear('2024'), '2024');
  assert.equal(monthYear('2026-03', 'fr-FR'), 'mars 2026');
});

test('different years: both dates in full', () => {
  assert.deepEqual(dateRange('2023-10', '2024-03'), ['Oct 2023', '– Mar 2024']);
  assert.deepEqual(dateRange('2022', '2024'), ['2022', '– 2024']);
  assert.deepEqual(dateRange('2022', '2024-08'), ['2022', '– Aug 2024']);
});

test('the same year drops the start year; the same month is one date', () => {
  assert.deepEqual(dateRange('2024-06', '2024-08'), ['Jun', '– Aug 2024']);
  assert.deepEqual(dateRange('2024-06-03', '2024-08-20'), ['Jun', '– Aug 2024']);
  assert.deepEqual(dateRange('2024-06', '2024-06'), ['Jun 2024']);
  assert.deepEqual(dateRange('2024', '2024'), ['2024']);
  assert.deepEqual(dateRange('2024', '2024-08'), ['2024', '– Aug 2024']);
});

test('present stays literal', () => {
  assert.deepEqual(dateRange('2025-01', 'present'), ['Jan 2025', '– present']);
  assert.deepEqual(dateRange('2025', 'present'), ['2025', '– present']);
});

test('one date alone, neither, and expected', () => {
  assert.deepEqual(dateRange('2025-03', undefined), ['Mar 2025']);
  assert.deepEqual(dateRange(undefined, '2025-03'), ['Mar 2025']);
  assert.deepEqual(dateRange(undefined, undefined), []);
  assert.deepEqual(dateRange('2025-01', '2029-05', { expected: true }), ['Jan 2025', '– May 2029', '(expected)']);
  assert.deepEqual(dateRange(undefined, undefined, { expected: true }), []);
});

test('months are read in UTC, whatever the build machine’s time zone', () => {
  const before = process.env.TZ;
  process.env.TZ = 'Pacific/Kiritimati';
  try {
    assert.deepEqual(dateRange('2024-01', '2024-12'), ['Jan', '– Dec 2024']);
  } finally {
    process.env.TZ = before;
  }
});
