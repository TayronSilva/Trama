import { channelById, countCharacters } from './channels.js';
import { normalizeTags } from './tags.js';

function cleanContent(content) {
  const text = String(content ?? '').trim();
  if (!text) throw new Error('Conteúdo não pode ficar vazio.');
  return text;
}

function normalizeChannels(channels) {
  const list = Array.isArray(channels)
    ? channels
    : typeof channels === 'string'
      ? channels.split(',')
      : [];
  const valid = list
    .map((c) => String(c ?? '').trim().toLowerCase())
    .filter((c) => ['instagram', 'linkedin', 'x', 'tiktok'].includes(c));
  const unique = [...new Set(valid)];
  if (unique.length === 0) {
    throw new Error('Escolha pelo menos um canal.');
  }
  return unique;
}

function assertChannelLimit(idea) {
  const channels = Array.isArray(idea.channels) ? idea.channels : [idea.channels];
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

function isValidIsoDateTime(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function rowToIdea(row) {
  if (!row) return null;
  const rawChannels = Array.isArray(row.channels)
    ? row.channels
    : (typeof row.channels === 'string' ? JSON.parse(row.channels || '[]') : []);
  const channels = rawChannels.length > 0
    ? rawChannels
    : (row.channel ? [row.channel] : ['geral']);

  const rawTags = Array.isArray(row.tags)
    ? row.tags
    : (typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : []);

  const status = row.status === 'draft' ? 'idea' : row.status;
  return {
    id: String(row.id),
    content: row.content,
    channels,
    tags: rawTags,
    status,
    scheduledAt: row.scheduled_for || row.scheduled_at || null,
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
  };
}

export function createSupabaseStore({ supabase, workspaceId, user, adminClient }) {
  const client = supabase;

  async function recordActivity(action, targetTitle, targetId) {
    try {
      await client.from('notifications').insert({
        workspace_id: workspaceId,
        user_id: user?.id || null,
        type: 'idea_edit',
        title: action,
        message: (targetTitle || '').slice(0, 80),
        link: targetId ? String(targetId) : null,
        created_at: new Date().toISOString(),
      });
    } catch {
      // non-blocking
    }
  }

  return {
    async createIdeas({ content, channels, tags }) {
      const clean = cleanContent(content);
      const normalizedChannels = normalizeChannels(channels);
      const normalizedTags = normalizeTags(tags);
      assertChannelLimit({ content: clean, channels: normalizedChannels });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const primaryChannel = normalizedChannels[0] || 'geral';

      const { data, error } = await client
        .from('ideas')
        .insert({
          id,
          workspace_id: workspaceId,
          content: clean,
          channels: normalizedChannels,
          channel: primaryChannel,
          tags: normalizedTags,
          status: 'draft',
          created_by: user?.id || null,
          created_by_name: user?.name || user?.email?.split('@')[0] || 'Equipe',
          created_at: now,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await recordActivity('create', clean, id);
      return [rowToIdea(data)];
    },

    async createIdea(payload) {
      const [first] = await this.createIdeas(payload);
      return first;
    },

    async getIdea(id) {
      const { data, error } = await client
        .from('ideas')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('id', String(id))
        .maybeSingle();

      if (error || !data) return null;
      return rowToIdea(data);
    },

    async listIdeas() {
      const { data, error } = await client
        .from('ideas')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(rowToIdea);
    },

    async listByStatus(status) {
      const dbStatus = status === 'idea' ? 'draft' : status;
      const { data, error } = await client
        .from('ideas')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', dbStatus)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(rowToIdea);
    },

    async listScheduled() {
      const { data, error } = await client
        .from('ideas')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      if (error) return [];
      return (data || []).map(rowToIdea);
    },

    async listScheduledBetween(start, end) {
      const startTime = `${start}T00:00`;
      const endTime = `${end}T23:59`;
      const { data, error } = await client
        .from('ideas')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'scheduled')
        .gte('scheduled_for', startTime)
        .lte('scheduled_for', endTime)
        .order('scheduled_for', { ascending: true });

      if (error) return [];
      return (data || []).map(rowToIdea);
    },

    async updateIdea(id, { content, tags, channels } = {}) {
      const existing = await this.getIdea(id);
      if (!existing) throw new Error('Publicação não encontrada.');

      const clean = content !== undefined ? cleanContent(content) : existing.content;
      const nextTags = tags !== undefined ? normalizeTags(tags) : existing.tags;
      const nextChannels = channels !== undefined ? normalizeChannels(channels) : existing.channels;

      assertChannelLimit({ content: clean, channels: nextChannels });

      const patch = {
        content: clean,
        tags: nextTags,
        channels: nextChannels,
        channel: nextChannels[0] || 'geral',
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
        updated_by_name: user?.name || user?.email?.split('@')[0] || null,
      };

      const { data, error } = await client
        .from('ideas')
        .update(patch)
        .eq('workspace_id', workspaceId)
        .eq('id', String(id))
        .select()
        .single();

      if (error) throw new Error(error.message);

      await recordActivity('update', clean, id);
      return rowToIdea(data);
    },

    async deleteIdea(id) {
      const existing = await this.getIdea(id);
      if (!existing) throw new Error('Publicação não encontrada.');

      const { error } = await client
        .from('ideas')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('id', String(id));

      if (error) throw new Error(error.message);

      await recordActivity('delete', existing.content, id);
      return existing;
    },

    async duplicateIdea(id) {
      const original = await this.getIdea(id);
      if (!original) throw new Error('Publicação não encontrada.');

      const newId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { data, error } = await client
        .from('ideas')
        .insert({
          id: newId,
          workspace_id: workspaceId,
          content: original.content,
          channels: original.channels,
          channel: original.channels[0] || 'geral',
          tags: original.tags,
          status: 'draft',
          created_by: user?.id || null,
          created_by_name: user?.name || user?.email?.split('@')[0] || 'Equipe',
          created_at: now,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      await recordActivity('duplicate', original.content, newId);
      return rowToIdea(data);
    },

    async scheduleIdea(id, { scheduledAt }) {
      if (!isValidIsoDateTime(scheduledAt)) {
        throw new Error('Informe uma data e hora válidas.');
      }
      const existing = await this.getIdea(id);
      if (!existing) throw new Error('Publicação não encontrada.');
      assertChannelLimit(existing);

      const { data, error } = await client
        .from('ideas')
        .update({
          status: 'scheduled',
          scheduled_for: scheduledAt,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        })
        .eq('workspace_id', workspaceId)
        .eq('id', String(id))
        .select()
        .single();

      if (error) throw new Error(error.message);

      await recordActivity('schedule', existing.content, id);
      return rowToIdea(data);
    },

    async unscheduleIdea(id) {
      const existing = await this.getIdea(id);
      if (!existing) throw new Error('Ideia não encontrada.');

      const { data, error } = await client
        .from('ideas')
        .update({
          status: 'draft',
          scheduled_for: null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        })
        .eq('workspace_id', workspaceId)
        .eq('id', String(id))
        .select()
        .single();

      if (error) throw new Error(error.message);

      await recordActivity('unschedule', existing.content, id);
      return rowToIdea(data);
    },

    async markPublished(id) {
      const existing = await this.getIdea(id);
      if (!existing) throw new Error('Publicação não encontrada.');
      assertChannelLimit(existing);

      const now = new Date().toISOString();
      const { data, error } = await client
        .from('ideas')
        .update({
          status: 'published',
          published_at: now,
          updated_at: now,
          updated_by: user?.id || null,
        })
        .eq('workspace_id', workspaceId)
        .eq('id', String(id))
        .select()
        .single();

      if (error) throw new Error(error.message);

      await recordActivity('publish', existing.content, id);
      return rowToIdea(data);
    },

    async counts() {
      const all = await this.listIdeas();
      const ideas = all.filter((i) => i.status === 'idea').length;
      const scheduled = all.filter((i) => i.status === 'scheduled').length;
      const published = all.filter((i) => i.status === 'published').length;
      return { total: all.length, ideas, scheduled, published };
    },

    async createIdeaEdit({ ideaId, editorId, editorName, previous, next }) {
      try {
        await client.from('notifications').insert({
          workspace_id: workspaceId,
          user_id: user?.id || null,
          type: 'idea_edit',
          title: 'update',
          message: next?.content || previous?.content || '',
          link: String(ideaId),
          created_at: new Date().toISOString(),
        });
      } catch {
        // non-blocking
      }
    },

    async listIdeaEdits(ideaId) {
      const queryClient = adminClient || client;
      const { data, error } = await queryClient
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('type', 'idea_edit')
        .eq('link', String(ideaId))
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map((row) => ({
        id: row.id,
        editorId: row.user_id,
        editorName: user?.name || user?.email?.split('@')[0],
        previousContent: null,
        newContent: row.message,
        createdAt: row.created_at,
      }));
    },

    async listActivities() {
      const queryClient = adminClient || client;
      const { data, error } = await queryClient
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('type', 'idea_edit')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return [];
      return (data || []).map((row) => ({
        id: row.id,
        action: row.title,
        targetType: 'idea',
        targetId: row.link,
        targetTitle: row.message,
        createdAt: row.created_at,
      }));
    },
  };
}

