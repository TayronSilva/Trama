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
  const channels = Array.isArray(idea.channels) ? idea.channels : [idea.channels];
  if (channels.length === 0) return;

  const channelIds = channels.filter(Boolean);
  if (channelIds.length === 0) return;

  const narrowest = channelIds
    .map((id) => channelById(id))
    .filter(Boolean)
    .reduce((current, channel) =>
      !current || channel.limit < current.limit ? channel : current,
    null,
  );

  if (!narrowest) return;

  const length = countCharacters(idea.content);
  if (length > narrowest.limit) {
    throw new Error(
      `O texto tem ${length} caracteres e excede o limite de ${narrowest.limit} do ${narrowest.name} (canal mais restritivo).`,
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
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      channels TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'idea'
        CHECK (status IN ('idea', 'scheduled', 'published')),
      scheduled_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ideas_user_id_status
      ON ideas (user_id, status);
    CREATE INDEX IF NOT EXISTS ideas_status_schedule
      ON ideas (status, scheduled_at);
    CREATE TABLE IF NOT EXISTS idea_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL,
      editor_id TEXT NOT NULL,
      editor_name TEXT,
      previous_content TEXT,
      new_content TEXT,
      previous_tags TEXT,
      new_tags TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idea_edits_idea_id
      ON idea_edits (idea_id);
  `);

  if (existing) {
    const hasUserId = db
      .prepare('PRAGMA table_info(ideas)')
      .all()
      .some((column) => column.name === 'user_id');
    if (!hasUserId) {
      db.exec("ALTER TABLE ideas ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
      db.exec(
        `UPDATE ideas SET user_id = '' WHERE user_id IS NULL OR user_id = ''`,
      );
    }
  }

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

export function openStore(path, { seed = true, userId = '' } = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');

  migrate(db, path);

  const uf = `WHERE user_id = ?`;

  const statements = {
    insert: db.prepare(
      `INSERT INTO ideas (user_id, content, channels, tags, status, scheduled_at, created_at)
       VALUES (?, ?, ?, ?, 'idea', NULL, ?)`,
    ),
    byId: db.prepare(`SELECT * FROM ideas ${uf} AND id = ?`),
    list: db.prepare(
      `SELECT * FROM ideas ${uf} ORDER BY created_at DESC, id DESC`,
    ),
    listByStatus: db.prepare(
      `SELECT * FROM ideas ${uf} AND status = ? ORDER BY created_at DESC, id DESC`,
    ),
    scheduled: db.prepare(
      `SELECT * FROM ideas ${uf} AND status = 'scheduled'
       ORDER BY scheduled_at ASC, id ASC`,
    ),
    scheduledBetween: db.prepare(
      `SELECT * FROM ideas ${uf} AND status = 'scheduled'
       AND scheduled_at >= ? AND scheduled_at <= ?
       ORDER BY scheduled_at ASC, id ASC`,
    ),
    update: db.prepare(
      `UPDATE ideas SET content = ?, tags = ?, channels = ? ${uf} AND id = ?`,
    ),
    schedule: db.prepare(
      `UPDATE ideas SET status = 'scheduled', scheduled_at = ?
       ${uf} AND id = ?`,
    ),
    unschedule: db.prepare(
      `UPDATE ideas SET status = 'idea', scheduled_at = NULL
       ${uf} AND id = ?`,
    ),
    publish: db.prepare(
      `UPDATE ideas SET status = 'published', published_at = ?
       ${uf} AND id = ?`,
    ),
    remove: db.prepare(`DELETE FROM ideas ${uf} AND id = ?`),
    insertEdit: db.prepare(
      `INSERT INTO idea_edits (idea_id, editor_id, editor_name, previous_content, new_content, previous_tags, new_tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    listEdits: db.prepare(
      `SELECT * FROM idea_edits WHERE idea_id = ? ORDER BY created_at DESC, id DESC`,
    ),
    countAll: db.prepare(`SELECT COUNT(*) AS total FROM ideas ${uf}`),
    countByStatus: db.prepare(
      'SELECT status, COUNT(*) AS total FROM ideas WHERE user_id = ? GROUP BY status',
    ),
  };

  function insertIdea(userId, content, channel, tags) {
    const channelsArray = Array.isArray(channel) ? channel : [channel];
    const result = statements.insert.run(
      userId,
      cleanContent(content),
      JSON.stringify(channelsArray),
      JSON.stringify(tags),
      new Date().toISOString(),
    );
    return rowToIdea(
      statements.byId.get(userId, Number(result.lastInsertRowid)),
    );
  }

  const store = {
    createIdea({ content, channels, tags }) {
      const normalizedChannels = normalizeChannels(channels);
      return insertIdea(
        userId,
        cleanContent(content),
        normalizedChannels,
        normalizeTags(tags),
      );
    },

    createIdeas({ content, channels, tags }) {
      const clean = cleanContent(content);
      const normalizedChannels = normalizeChannels(channels);
      const normalizedTags = normalizeTags(tags);
      return [insertIdea(userId, clean, normalizedChannels, normalizedTags)];
    },

    getIdea(id) {
      return rowToIdea(statements.byId.get(userId, Number(id)));
    },

    listIdeas() {
      return statements.list.all(userId).map(rowToIdea);
    },

    listByStatus(status) {
      return statements.listByStatus.all(userId, status).map(rowToIdea);
    },

    listScheduled() {
      return statements.scheduled.all(userId).map(rowToIdea);
    },

    listScheduledBetween(start, end) {
      return statements.scheduledBetween
        .all(userId, `${start}T00:00`, `${end}T23:59`)
        .map(rowToIdea);
    },

    updateIdea(id, { content, tags, channels } = {}) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Publicação não encontrada.');

      const nextTags = tags === undefined ? idea.tags : normalizeTags(tags);
      const nextChannels =
        channels === undefined
          ? idea.channels
          : normalizeChannels(channels);
      statements.update.run(
        cleanContent(content),
        JSON.stringify(nextTags),
        JSON.stringify(nextChannels),
        userId,
        Number(id),
      );
      return store.getIdea(id);
    },

    deleteIdea(id) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Publicação não encontrada.');
      statements.remove.run(userId, Number(id));
      return idea;
    },

    duplicateIdea(id) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Publicação não encontrada.');

      const result = statements.insert.run(
        userId,
        idea.content,
        JSON.stringify(idea.channels),
        JSON.stringify(idea.tags),
        new Date().toISOString(),
      );
      return rowToIdea(
        statements.byId.get(userId, Number(result.lastInsertRowid)),
      );
    },

    scheduleIdea(id, { scheduledAt }) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Ideia não encontrada.');
      if (!parseLocalDateTime(scheduledAt)) {
        throw new Error('Escolha uma data e um horário válidos.');
      }
      assertChannelLimit(idea);

      statements.schedule.run(scheduledAt, userId, Number(id));
      return store.getIdea(id);
    },

    unscheduleIdea(id) {
      if (!store.getIdea(id)) throw new Error('Ideia não encontrada.');
      statements.unschedule.run(userId, Number(id));
      return store.getIdea(id);
    },

    markPublished(id) {
      const idea = store.getIdea(id);
      if (!idea) throw new Error('Ideia não encontrada.');
      assertChannelLimit(idea);

      statements.publish.run(new Date().toISOString(), userId, Number(id));
      return store.getIdea(id);
    },

    counts() {
      const counts = { ideas: 0, scheduled: 0, published: 0 };
      for (const row of statements.countByStatus.all(userId)) {
        if (row.status === 'idea') counts.ideas = row.total;
        if (row.status === 'scheduled') counts.scheduled = row.total;
        if (row.status === 'published') counts.published = row.total;
      }
      return counts;
    },

    count() {
      return statements.countAll.get(userId).total;
    },

    createIdeaEdit({ ideaId, editorId, editorName, previous, next }) {
      statements.insertEdit.run(
        Number(ideaId),
        editorId,
        editorName ?? null,
        previous?.content ?? null,
        next?.content ?? null,
        previous?.tags ? JSON.stringify(previous.tags) : null,
        next?.tags ? JSON.stringify(next.tags) : null,
        new Date().toISOString(),
      );
    },

    listIdeaEdits(ideaId) {
      return statements.listEdits.all(Number(ideaId)).map((row) => ({
        id: row.id,
        ideaId: row.idea_id,
        editorId: row.editor_id,
        editorName: row.editor_name,
        previousContent: row.previous_content,
        newContent: row.new_content,
        previousTags: parseJsonArray(row.previous_tags),
        newTags: parseJsonArray(row.new_tags),
        createdAt: row.created_at,
      }));
    },

    close() {
      db.close();
    },
  };

  if (seed) seedIfEmpty(store);
  return store;
}

const globalStores = globalThis;

// Garante que o mapa de stores exista no globalThis
if (!globalStores.__tramaStores) {
  globalStores.__tramaStores = new Map();
}

export function getStore(userId = '') {
  const stores = globalStores.__tramaStores;

  // Retorna o store existente para este userId, se ja houver
  if (stores.has(userId)) {
    return stores.get(userId);
  }

  const path = process.env.TRAMA_DB || 'data/trama.db';
  let store;
  try {
    store = openStore(path, { seed: false, userId });
  } catch {
    // Banco SQLite em arquivo nao e gravavel (ex.: Vercel serverless, fs somente-leitura).
    // Cai para banco em memoria para nao quebrar a renderizacao do servidor.
    store = openStore(':memory:', { seed: false, userId });
  }

  stores.set(userId, store);
  return store;
}
