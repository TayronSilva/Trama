import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeTags, openStore } from '../lib/store.js';

function withStore(run) {
  const dir = mkdtempSync(join(tmpdir(), 'trama-'));
  const store = openStore(join(dir, 'trama.db'), { seed: false });
  try {
    run(store);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeLegacyDb(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      channels TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea'
        CHECK (status IN ('idea', 'scheduled', 'published')),
      scheduled_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const insert = db.prepare(
    `INSERT INTO ideas (content, channels, status, scheduled_at, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  insert.run(
    'Legado multi',
    '["instagram","linkedin"]',
    'scheduled',
    '2026-11-20T14:30',
    null,
    '2026-11-01T10:00:00.000Z',
  );
  insert.run(
    'Legado publicado',
    '["x","tiktok"]',
    'published',
    '2026-11-10T09:00',
    '2026-11-10T09:05:00.000Z',
    '2026-10-01T08:00:00.000Z',
  );
  db.close();
}

test('createIdea trims content, keeps one channel and normalizes tags', () => {
  withStore((store) => {
    const idea = store.createIdea({
      content: '  Uma ideia sobre consistência editorial.  ',
      channels: ['instagram'],
      tags: ' lançamento, bastidores, lançamento, ',
    });

    assert.equal(idea.content, 'Uma ideia sobre consistência editorial.');
    assert.equal(idea.status, 'idea');
    assert.deepEqual(idea.channels, ['instagram']);
    assert.deepEqual(idea.tags, ['lançamento', 'bastidores']);
    assert.equal(store.listIdeas().length, 1);
  });
});

test('createIdea rejects invalid input and more than one channel', () => {
  withStore((store) => {
    assert.throws(
      () => store.createIdea({ content: '   ', channels: ['x'] }),
      /conteúdo/i,
    );
    assert.throws(
      () => store.createIdea({ content: 'Ideia válida', channels: ['orkut'] }),
      /canal/i,
    );
    assert.throws(
      () => store.createIdea({ content: 'Ideia válida', channels: [] }),
      /canal/i,
    );
    assert.throws(
      () =>
        store.createIdea({
          content: 'Ideia válida',
          channels: ['x', 'linkedin'],
        }),
      /único canal/i,
    );
  });
});

test('createIdeas creates one independent record per channel', () => {
  withStore((store) => {
    const created = store.createIdeas({
      content: 'Mesmo texto para três canais.',
      channels: ['instagram', 'linkedin', 'x'],
      tags: 'editorial, novembro',
    });

    assert.equal(created.length, 3);
    assert.deepEqual(
      created.map((idea) => idea.channels),
      [['instagram'], ['linkedin'], ['x']],
    );
    for (const idea of created) {
      assert.equal(idea.content, 'Mesmo texto para três canais.');
      assert.deepEqual(idea.tags, ['editorial', 'novembro']);
      assert.equal(idea.status, 'idea');
    }
    assert.equal(store.listIdeas().length, 3);
  });
});

test('normalizeTags trims, drops empty values and removes duplicates', () => {
  assert.deepEqual(normalizeTags(' a, b ,, a '), ['a', 'b']);
  assert.deepEqual(normalizeTags([' x ', 'x', '', null]), ['x']);
  assert.deepEqual(normalizeTags(undefined), []);
});

test('updateIdea saves content and tags without touching the schedule', () => {
  withStore((store) => {
    const idea = store.createIdea({
      content: 'Texto original',
      channels: ['linkedin'],
      tags: 'antiga',
    });
    store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });

    const updated = store.updateIdea(idea.id, {
      content: '  Texto revisado  ',
      tags: 'nova, revisado, nova',
    });

    assert.equal(updated.content, 'Texto revisado');
    assert.deepEqual(updated.tags, ['nova', 'revisado']);
    assert.equal(updated.status, 'scheduled');
    assert.equal(updated.scheduledAt, '2026-11-20T14:30');

    const contentOnly = store.updateIdea(idea.id, { content: 'Só o texto' });
    assert.deepEqual(contentOnly.tags, ['nova', 'revisado']);
  });
});

test('updateIdea rejects empty content and missing records', () => {
  withStore((store) => {
    const idea = store.createIdea({ content: 'Texto', channels: ['x'] });

    assert.throws(
      () => store.updateIdea(idea.id, { content: '   ' }),
      /conteúdo/i,
    );
    assert.throws(
      () => store.updateIdea(9999, { content: 'Texto' }),
      /não encontrada/i,
    );
  });
});

test('deleteIdea removes the record from every listing', () => {
  withStore((store) => {
    const idea = store.createIdea({ content: 'Vai sair', channels: ['x'] });
    store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });

    const removed = store.deleteIdea(idea.id);
    assert.equal(removed.id, idea.id);
    assert.equal(store.getIdea(idea.id), null);
    assert.equal(store.listIdeas().length, 0);
    assert.equal(store.listScheduled().length, 0);
    assert.equal(
      store.listScheduledBetween('2026-11-01', '2026-11-30').length,
      0,
    );
    assert.throws(() => store.deleteIdea(idea.id), /não encontrada/i);
  });
});

test('duplicateIdea creates an unscheduled idea at the top of the library', () => {
  withStore((store) => {
    const idea = store.createIdea({
      content: 'Original',
      channels: ['linkedin'],
      tags: 'duplicar',
    });
    store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });

    const copy = store.duplicateIdea(idea.id);

    assert.notEqual(copy.id, idea.id);
    assert.equal(copy.content, 'Original');
    assert.deepEqual(copy.tags, ['duplicar']);
    assert.deepEqual(copy.channels, ['linkedin']);
    assert.equal(copy.status, 'idea');
    assert.equal(copy.scheduledAt, null);
    assert.equal(copy.publishedAt, null);
    assert.equal(store.listIdeas()[0].id, copy.id);

    const original = store.getIdea(idea.id);
    assert.equal(original.status, 'scheduled');
    assert.equal(original.scheduledAt, '2026-11-20T14:30');
  });
});

test('scheduling and publishing remain independent per channel', () => {
  withStore((store) => {
    const [first, second, third] = store.createIdeas({
      content: 'Três canais',
      channels: ['instagram', 'linkedin', 'x'],
    });
    for (const idea of [first, second, third]) {
      store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });
    }
    assert.equal(store.listScheduled().length, 3);

    store.unscheduleIdea(second.id);
    assert.equal(store.getIdea(second.id).status, 'idea');
    assert.equal(store.getIdea(first.id).status, 'scheduled');
    assert.equal(store.getIdea(third.id).status, 'scheduled');

    store.markPublished(third.id);
    assert.equal(store.getIdea(third.id).status, 'published');
    assert.equal(store.getIdea(first.id).status, 'scheduled');
    assert.equal(store.listScheduled().length, 1);
  });
});

test('scheduleIdea validates the date and the channel limit', () => {
  withStore((store) => {
    const idea = store.createIdea({ content: 'Texto', channels: ['x'] });

    assert.throws(
      () => store.scheduleIdea(idea.id, { scheduledAt: 'amanhã' }),
      /data/i,
    );

    const long = store.createIdea({
      content: 'a'.repeat(281),
      channels: ['x'],
    });
    assert.throws(
      () =>
        store.scheduleIdea(long.id, { scheduledAt: '2026-11-20T14:30' }),
      /limite.*X/i,
    );

    const fits = store.createIdea({
      content: 'a'.repeat(280),
      channels: ['x'],
    });
    const scheduled = store.scheduleIdea(fits.id, {
      scheduledAt: '2026-11-20T14:30',
    });
    assert.equal(scheduled.status, 'scheduled');
  });
});

test('markPublished blocks content above the channel limit', () => {
  withStore((store) => {
    const idea = store.createIdea({
      content: 'a'.repeat(280),
      channels: ['x'],
    });
    store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });
    store.updateIdea(idea.id, { content: 'a'.repeat(281) });

    assert.equal(store.getIdea(idea.id).status, 'scheduled');
    assert.throws(() => store.markPublished(idea.id), /limite.*X/i);
  });
});

test('listScheduledBetween returns only the requested month, in time order', () => {
  withStore((store) => {
    for (const [content, date] of [
      ['Novembro cedo', '2026-11-03T09:00'],
      ['Novembro tarde', '2026-11-28T18:30'],
      ['Dezembro', '2026-12-01T10:00'],
    ]) {
      const idea = store.createIdea({ content, channels: ['linkedin'] });
      store.scheduleIdea(idea.id, { scheduledAt: date });
    }

    const items = store.listScheduledBetween('2026-11-01', '2026-11-30');
    assert.deepEqual(
      items.map((item) => item.content),
      ['Novembro cedo', 'Novembro tarde'],
    );
  });
});

test('unscheduleIdea returns the post to the library and publish marks it done', () => {
  withStore((store) => {
    const idea = store.createIdea({ content: 'Texto', channels: ['x'] });
    store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });

    const unscheduled = store.unscheduleIdea(idea.id);
    assert.equal(unscheduled.status, 'idea');
    assert.equal(unscheduled.scheduledAt, null);

    store.scheduleIdea(idea.id, { scheduledAt: '2026-11-20T14:30' });
    const published = store.markPublished(idea.id);
    assert.equal(published.status, 'published');
    assert.ok(published.publishedAt);
    assert.equal(store.listScheduled().length, 0);
  });
});

test('counts summarizes each state', () => {
  withStore((store) => {
    store.createIdea({ content: 'Uma', channels: ['x'] });
    const second = store.createIdea({ content: 'Duas', channels: ['x'] });
    store.scheduleIdea(second.id, { scheduledAt: '2026-11-20T14:30' });

    assert.deepEqual(store.counts(), { ideas: 1, scheduled: 1, published: 0 });
  });
});

test('migrates legacy multi-channel rows once, with backup and timestamps intact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trama-legacy-'));
  const path = join(dir, 'trama.db');
  writeLegacyDb(path);

  let store = openStore(path, { seed: false });
  try {
    const ideas = store.listIdeas();
    assert.equal(ideas.length, 4);

    const scheduled = ideas.filter((idea) => idea.content === 'Legado multi');
    assert.equal(scheduled.length, 2);
    assert.deepEqual(
      scheduled.map((idea) => idea.channels[0]).sort(),
      ['instagram', 'linkedin'],
    );
    for (const idea of scheduled) {
      assert.equal(idea.status, 'scheduled');
      assert.equal(idea.scheduledAt, '2026-11-20T14:30');
      assert.equal(idea.publishedAt, null);
      assert.equal(idea.createdAt, '2026-11-01T10:00:00.000Z');
      assert.deepEqual(idea.tags, []);
    }

    const published = ideas.filter((idea) => idea.content === 'Legado publicado');
    assert.equal(published.length, 2);
    assert.deepEqual(
      published.map((idea) => idea.channels[0]).sort(),
      ['tiktok', 'x'],
    );
    for (const idea of published) {
      assert.equal(idea.status, 'published');
      assert.equal(idea.scheduledAt, '2026-11-10T09:00');
      assert.equal(idea.publishedAt, '2026-11-10T09:05:00.000Z');
      assert.equal(idea.createdAt, '2026-10-01T08:00:00.000Z');
    }

    assert.equal(
      readdirSync(dir).filter((name) => name.startsWith('backup-')).length,
      1,
    );

    store.close();
    store = openStore(path, { seed: false });
    assert.equal(store.listIdeas().length, 4);
    assert.equal(
      readdirSync(dir).filter((name) => name.startsWith('backup-')).length,
      1,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
