import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dateWithOffset, parseLocalDateTime } from './dates.js';
import { CHANNELS, channelById, countCharacters } from './channels.js';
import { normalizeTags } from './tags.js';

export { normalizeTags };

const CHANNELS_BY_ID = new Map(CHANNELS.map((channel) => [channel.id, channel]));

function normalizeChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error('Escolha pelo menos um canal.');
  }

  const unique = [...new Set(channels)];
  for (const channel of unique) {
    if (!CHANNELS_BY_ID.has(channel)) {
      throw new Error(`Canal inválido: ${channel}.`);
    }
  }

  return CHANNELS.filter((channel) => unique.includes(channel.id)).map(
    (channel) => channel.id,
  );
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToIdea(row) {
  if (!row) return null;
  return {
    id: row.id,
    content: row.content,
    channels: parseJsonArray(row.channels),
    tags: normalizeTags(parseJsonArray(row.tags)),
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

function cleanContent(content) {
  const value = String(content ?? '').trim();
  if (!value) throw new Error('Escreva o conteúdo da ideia.');
  return value;
}

function assertChannelLimit(idea) {
  const channelId = idea.channels[0];
  if (!channelId) return;

  const channel = channelById(channelId);
  const length = countCharacters(idea.content);
  if (length > channel.limit) {
    throw new Error(
      `O texto tem ${length} caracteres e excede o limite de ${channel.limit} do ${channel.name}.`,
    );
  }
}

function backupDatabase(db, path) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(dirname(path), `backup-${stamp}.db`);
  const escapedPath = backupPath.replace(/'/g, "''");

  try {
    db.exec(`VACUUM INTO '${escapedPath}'`);
  } catch {
    // The fallback keeps a copy of the database and its WAL files together.
    copyFileSync(path, backupPath);
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(`${path}${suffix}`)) {
        copyFileSync(`${path}${suffix}`, `${backupPath}${suffix}`);
      }
    }
  }
  return backupPath;
}

function splitLegacyChannels(db) {
  const rows = db
    .prepare(
      `SELECT id, content, channels, tags, status, scheduled_at,
              published_at, created_at FROM ideas`,
    )
    .all();
  const update = db.prepare('UPDATE ideas SET channels = ? WHERE id = ?');
  const insert = db.prepare(
    `INSERT INTO ideas
       (content, channels, tags, status, scheduled_at, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const channels = parseJsonArray(row.channels);
      const unique = [...new Set(channels)].filter(Boolean);
      if (unique.length === 0) continue;

      if (unique.length === 1) {
        if (channels.length !== 1) {
          update.run(JSON.stringify(unique), row.id);
        }
        continue;
      }

      update.run(JSON.stringify([unique[0]]), row.id);
      for (const channel of unique.slice(1)) {
        insert.run(
          row.content,
          JSON.stringify([channel]),
          row.tags ?? '[]',
          row.status,
          row.scheduled_at,
          row.published_at,
          row.created_at,
        );
      }
    }
    db.exec('COMMIT');
  } catch (cause) {
    db.exec('ROLLBACK');
    throw cause;
  }
}

function migrate(db, path) {
  const existing = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ideas'")
    .get();

  let hasTags = false;
  let legacyRows = [];
  if (existing) {
    hasTags = db
      .prepare('PRAGMA table_info(ideas)')
      .all()
      .some((column) => column.name === 'tags');
    legacyRows = db
      .prepare('SELECT id, channels FROM ideas')
      .all()
      .filter((row) => parseJsonArray(row.channels).length > 1);
  }

  const needsBackup = existing && (!hasTags || legacyRows.length > 0);
  if (needsBackup && path !== ':memory:') {
    backupDatabase(db, path);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      channels TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'idea'
        CHECK (status IN ('idea', 'scheduled', 'published')),
      scheduled_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ideas_status_schedule
      ON ideas (status, scheduled_at);
  `);

  if (existing && !hasTags) {
    db.exec("ALTER TABLE ideas ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  }

  if (legacyRows.length > 0) {
    splitLegacyChannels(db);
  }
}

function seedIfEmpty(store) {
  if (store.count() > 0) return;

  const seeds = [
    {
      content: 'Bastidores: como montamos o calendário editorial deste mês.',
      channels: ['instagram', 'linkedin'],
    },
    {
      content: 'Cinco perguntas para fazer antes de trocar de ferramenta.',
      channels: ['linkedin', 'x'],
    },
    {
      content: 'Antes e depois do canto de trabalho — ideia de carrossel.',
      channels: ['instagram', 'tiktok'],
    },
    {
      content:
        'Checklist de lançamento: o que publicar na semana que antecede o lançamento.',
      channels: ['linkedin'],
      scheduledAt: dateWithOffset(2, 9, 30),
    },
    {
      content: 'Qual ferramenta mudou a sua forma de trabalhar este ano?',
      channels: ['x', 'instagram'],
      scheduledAt: dateWithOffset(5, 18, 15),
    },
  ];

  for (const seed of seeds) {
    const ideas = store.createIdeas({
      content: seed.content,
      channels: seed.channels,
    });
    if (seed.scheduledAt) {
      for (const idea of ideas) {
        store.scheduleIdea(idea.id, { scheduledAt: seed.scheduledAt });
      }
    }
  }
}

export function openStore(path, { seed = true } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');

  migrate(db, path);

  const statements = {
    insert: db.prepare(
      `INSERT INTO ideas (content, channels, tags, status, scheduled_at, created_at)
       VALUES (?, ?, ?, 'idea', NULL, ?)`,
    ),
    byId: db.prepare('SELECT * FROM ideas WHERE id = ?'),
    list: db.prepare('SELECT * FROM ideas ORDER BY created_at DESC, id DESC'),
    listByStatus: db.prepare(
      'SELECT * FROM ideas WHERE status = ? ORDER BY created_at DESC, id DESC',
    ),
    scheduled: db.prepare(
      `SELECT * FROM ideas WHERE status = 'scheduled'
       ORDER BY scheduled_at ASC, id ASC`,
    ),
    scheduledBetween: db.prepare(
      `SELECT * FROM ideas WHERE status = 'scheduled'
       AND scheduled_at >= ? AND scheduled_at <= ?
       ORDER BY scheduled_at ASC, id ASC`,
    ),
    update: db.prepare('UPDATE ideas SET content = ?, tags = ? WHERE id = ?'),
    schedule: db.prepare(
      `UPDATE ideas SET status = 'scheduled', scheduled_at = ?
       WHERE id = ?`,
    ),
    unschedule: db.prepare(
      `UPDATE ideas SET status = 'idea', scheduled_at = NULL WHERE id = ?`,
    ),
    publish: db.prepare(
      `UPDATE ideas SET status = 'published', published_at = ? WHERE id = ?`,
    ),
    remove: db.prepare('DELETE FROM ideas WHERE id = ?'),
    countAll: db.prepare('SELECT COUNT(*) AS total FROM ideas'),
    countByStatus: db.prepare(
      'SELECT status, COUNT(*) AS total FROM ideas GROUP BY status',
    ),
  };

  function insertIdea(content, channel, tags) {
    const result = statements.insert.run(
      content,
      JSON.stringify([channel]),
      JSON.stringify(tags),
      new Date().toISOString(),
    );
    return rowToIdea(statements.byId.get(Number(result.lastInsertRowid)));
  }

  const store = {
    createIdea({ content, channels, tags }) {
      const normalizedChannels = normalizeChannels(channels);
      if (normalizedChannels.length !== 1) {
        throw new Error('Cada publicação pertence a um único canal.');
      }
      return insertIdea(
        cleanContent(content),
        normalizedChannels[0],
        normalizeTags(tags),
      );
    },

    createIdeas({ content, channels, tags }) {
      const clean = cleanContent(content);
      const normalizedChannels = normalizeChannels(channels);
      const normalizedTags = normalizeTags(tags);
      return normalizedChannels.map((channel) =>
        insertIdea(clean, channel, normalizedTags),
      );
    },

    getIdea(id) {
      return rowToIdea(statements.byId.get(Number(id)));
    },

    listIdeas() {
      return statements.list.all().map(rowToIdea);
    },

    listByStatus(status) {
      return statements.listByStatus.all(status).map(rowToIdea);
    },

    listScheduled() {
      return statements.scheduled.all().map(rowToIdea);
    },

    listScheduledBetween(start, end) {
      return statements.scheduledBetween
        .all(`${start}T00:00`, `${end}T23:59`)
        .map(rowToIdea);
    },

    updateIdea(id, { content, tags } = {}) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Publicação não encontrada.');

      const nextTags = tags === undefined ? idea.tags : normalizeTags(tags);
      statements.update.run(
        cleanContent(content),
        JSON.stringify(nextTags),
        Number(id),
      );
      return store.getIdea(id);
    },

    deleteIdea(id) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Publicação não encontrada.');
      statements.remove.run(Number(id));
      return idea;
    },

    duplicateIdea(id) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Publicação não encontrada.');

      const result = statements.insert.run(
        idea.content,
        JSON.stringify(idea.channels),
        JSON.stringify(idea.tags),
        new Date().toISOString(),
      );
      return rowToIdea(statements.byId.get(Number(result.lastInsertRowid)));
    },

    scheduleIdea(id, { scheduledAt }) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Ideia não encontrada.');
      if (!parseLocalDateTime(scheduledAt)) {
        throw new Error('Escolha uma data e um horário válidos.');
      }
      assertChannelLimit(idea);

      statements.schedule.run(scheduledAt, Number(id));
      return store.getIdea(id);
    },

    unscheduleIdea(id) {
      if (!store.getIdea(id)) throw new Error('Ideia não encontrada.');
      statements.unschedule.run(Number(id));
      return store.getIdea(id);
    },

    markPublished(id) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Ideia não encontrada.');
      assertChannelLimit(idea);

      statements.publish.run(new Date().toISOString(), Number(id));
      return store.getIdea(id);
    },

    counts() {
      const counts = { ideas: 0, scheduled: 0, published: 0 };
      for (const row of statements.countByStatus.all()) {
        if (row.status === 'idea') counts.ideas = row.total;
        if (row.status === 'scheduled') counts.scheduled = row.total;
        if (row.status === 'published') counts.published = row.total;
      }
      return counts;
    },

    count() {
      return statements.countAll.get().total;
    },

    close() {
      db.close();
    },
  };

  if (seed) seedIfEmpty(store);
  return store;
}

const globalStores = globalThis;

export function getStore() {
  if (!globalStores.__tramaStore) {
    const path = process.env.TRAMA_DB || 'data/trama.db';
    try {
      globalStores.__tramaStore = openStore(path, { seed: false });
    } catch {
      // Banco SQLite em arquivo nao e gravavel (ex.: Vercel serverless, fs somente-leitura).
      // Cai para banco em memoria para nao quebrar a renderizacao do servidor.
      globalStores.__tramaStore = openStore(':memory:', { seed: false });
    }
  }
  return globalStores.__tramaStore;
}
