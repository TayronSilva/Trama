'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getStore, getUnifiedStore } from '../lib/store';
import { createClient } from '../lib/supabase/server';

function refresh() {
  revalidatePath('/create');
  revalidatePath('/publish');
  revalidatePath('/calendar');
}

function fail(path, message) {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function contextPath(formData) {
  return formData.get('from') === 'publish' ? '/publish' : '/create';
}

// Verifica sessao Supabase e retorna o userId, ou lança erro se nao autenticado.
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Nao autenticado.');
  }
  return user.id;
}

// Protecao CSRF: valida que a requisicao vem da mesma origem (header Origin ou Referer).
async function assertCsrfSafe() {
  const h = await headers();
  const origin = h.get('origin');
  const referer = h.get('referer');
  const allowed = origin || referer;
  if (!allowed) {
    throw new Error('Requicao bloqueada: origem nao identificada (CSRF).');
  }
  try {
    const url = new URL(allowed);
    const host = url.hostname;
    if (
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      !host.endsWith('.vercel.app') &&
      !host.endsWith('.trama.app')
    ) {
      throw new Error('Requicao bloqueada: origem nao permitida (CSRF).');
    }
  } catch {
    throw new Error('Requicao bloqueada: origem invalida (CSRF).');
  }
}

export async function createIdeaAction(formData) {
  let error = '';
  try {
    await requireUser();
    await assertCsrfSafe();
    const store = await getUnifiedStore();
    await store.createIdeas({
      content: formData.get('content'),
      channels: formData.getAll('channels'),
      tags: formData.get('tags'),
    });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail('/create', error);
  refresh();
  redirect('/create?ok=criada');
}

async function editorIdentity() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle();
  return {
    userId: user.id,
    name: profile?.name || user.email?.split('@')[0] || user.id,
  };
}

export async function updateIdeaAction(formData) {
  const id = formData.get('id')?.toString();
  const from = contextPath(formData);
  const patch = { content: formData.get('content') };
  if (formData.has('tags')) patch.tags = formData.get('tags');
  if (formData.has('channels')) {
    patch.channels = formData.getAll('channels');
  }
  let error = '';

  try {
    const editor = await editorIdentity();
    if (!editor) throw new Error('Nao autenticado.');
    await assertCsrfSafe();

    const store = await getUnifiedStore();
    const previous = await store.getIdea(id);

    await store.updateIdea(id, patch);

    const next = await store.getIdea(id);
    if (store.createIdeaEdit) {
      await store.createIdeaEdit({
        ideaId: id,
        editorId: editor.userId,
        editorName: editor.name,
        previous,
        next,
      });
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail(from, error);
  refresh();
  redirect(`${from}?ok=editada`);
}

export async function getIdeaEditsAction(ideaId) {
  const editor = await editorIdentity();
  if (!editor) return [];
  const store = await getUnifiedStore();
  return store.listIdeaEdits(ideaId);
}

export async function deleteIdeaAction(formData) {
  const id = formData.get('id')?.toString();
  const from = contextPath(formData);
  let error = '';

  try {
    await requireUser();
    await assertCsrfSafe();
    const store = await getUnifiedStore();
    await store.deleteIdea(id);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail(from, error);
  refresh();
  redirect(`${from}?ok=excluida`);
}

export async function duplicateIdeaAction(formData) {
  const id = formData.get('id')?.toString();
  let copy;

  try {
    await requireUser();
    await assertCsrfSafe();
    const store = await getUnifiedStore();
    copy = await store.duplicateIdea(id);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Tente novamente.';
    fail(contextPath(formData), message);
  }

  refresh();
  redirect(`/create?ok=duplicada#ideia-${copy.id}`);
}

export async function scheduleIdeaAction(formData) {
  const id = formData.get('id')?.toString();
  const scheduledAt = String(formData.get('scheduledAt') ?? '');
  let error = '';

  try {
    await requireUser();
    await assertCsrfSafe();
    const store = await getUnifiedStore();
    await store.scheduleIdea(id, { scheduledAt });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail('/create', error);
  refresh();
  redirect(`/create?ok=agendado&data=${scheduledAt.slice(0, 10)}`);
}

export async function unscheduleIdeaAction(formData) {
  const id = formData.get('id')?.toString();
  const from = formData.get('from') === 'publish' ? '/publish' : '/create';
  let error = '';

  try {
    await requireUser();
    await assertCsrfSafe();
    const store = await getUnifiedStore();
    await store.unscheduleIdea(id);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail(from, error);
  refresh();
  redirect(`${from}?ok=removido`);
}

export async function publishIdeaAction(formData) {
  const id = formData.get('id')?.toString();
  let error = '';

  try {
    await requireUser();
    await assertCsrfSafe();
    const store = await getUnifiedStore();
    await store.markPublished(id);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail('/publish', error);
  refresh();
  redirect('/publish?ok=publicado');
}

export async function adaptIdeaAction({ content, channel }) {
  const { adaptToChannel } = await import('../lib/ai.js');
  try {
    return await adaptToChannel(content, channel);
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error ? cause.message : 'Erro ao adaptar o texto.',
    };
  }
}

export async function hooksIdeaAction({ content }) {
  const { threeHooks } = await import('../lib/ai.js');
  try {
    return await threeHooks(content);
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : 'Erro ao gerar aberturas.',
    };
  }
}

export async function getAiStatus() {
  const { getAiConfig } = await import('../lib/ai.js');
  return getAiConfig();
}

export async function getWorkspaceActivityAction() {
  await requireUser();
  const store = await getUnifiedStore();
  return store.listActivities();
}
