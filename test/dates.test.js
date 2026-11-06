import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthGrid,
  formatDateShort,
  formatDateTime,
  formatLongDate,
  monthBounds,
  monthLabel,
  parseMonthParam,
  shiftMonth,
  tomorrowAt,
} from '../lib/dates.js';

test('parseMonthParam accepts a valid month and falls back to the current one', () => {
  assert.deepEqual(parseMonthParam('2026-11', new Date(2026, 5, 2)), {
    year: 2026,
    month: 11,
  });
  assert.deepEqual(parseMonthParam('2026-13', new Date(2026, 5, 2)), {
    year: 2026,
    month: 6,
  });
  assert.deepEqual(parseMonthParam(undefined, new Date(2026, 5, 2)), {
    year: 2026,
    month: 6,
  });
});

test('monthBounds handles leap years and the last day', () => {
  assert.deepEqual(monthBounds(2024, 2), {
    start: '2024-02-01',
    end: '2024-02-29',
  });
  assert.deepEqual(monthBounds(2026, 11), {
    start: '2026-11-01',
    end: '2026-11-30',
  });
});

test('buildMonthGrid starts on Monday and always returns six weeks', () => {
  const grid = buildMonthGrid(2026, 11, new Date(2026, 10, 6));
  assert.equal(grid.length, 42);
  assert.equal(grid[0].date, '2026-10-26');
  assert.equal(grid[6].date, '2026-11-01');
  assert.equal(grid[6].inMonth, true);
  assert.equal(grid[41].date, '2026-12-06');
  assert.equal(grid.find((day) => day.date === '2026-11-06').isToday, true);
  assert.equal(grid.filter((day) => day.inMonth).length, 30);
});

test('shiftMonth crosses years in both directions', () => {
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test('human date helpers stay in Brazilian Portuguese', () => {
  assert.equal(monthLabel(2026, 11), 'novembro de 2026');
  assert.equal(formatDateTime('2026-11-20T14:30'), '20 nov, 14:30');
  assert.equal(formatDateShort('2026-11-20'), '20 nov');
  assert.equal(formatLongDate('2026-11-20'), 'sexta-feira, 20 de novembro');
});

test('tomorrowAt builds a local datetime input value', () => {
  assert.equal(tomorrowAt(9, 30, new Date(2026, 10, 6, 16, 45)), '2026-11-07T09:30');
});
