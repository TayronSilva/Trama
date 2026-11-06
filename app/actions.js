'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '../lib/store';

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

export async function createIdeaAction(formData) {
  let error = '';
  try {
    getStore().createIdeas({
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

export async function updateIdeaAction(formData) {
  const id = Number(formData.get('id'));
  const from = contextPath(formData);
  const patch = { content: formData.get('content') };
  if (formData.has('tags')) patch.tags = formData.get('tags');
  let error = '';

  try {
    getStore().updateIdea(id, patch);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail(from, error);
  refresh();
  redirect(`${from}?ok=editada`);
}

export async function deleteIdeaAction(formData) {
  const id = Number(formData.get('id'));
  const from = contextPath(formData);
  let error = '';

  try {
    getStore().deleteIdea(id);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail(from, error);
  refresh();
  redirect(`${from}?ok=excluida`);
}

export async function duplicateIdeaAction(formData) {
  const id = Number(formData.get('id'));
  let copy;

  try {
    copy = getStore().duplicateIdea(id);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Tente novamente.';
    fail(contextPath(formData), message);
  }

  refresh();
  redirect(`/create?ok=duplicada#ideia-${copy.id}`);
}

export async function scheduleIdeaAction(formData) {
  const id = Number(formData.get('id'));
  const scheduledAt = String(formData.get('scheduledAt') ?? '');
  let error = '';

  try {
    getStore().scheduleIdea(id, { scheduledAt });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail('/create', error);
  refresh();
  redirect(`/create?ok=agendado&data=${scheduledAt.slice(0, 10)}`);
}

export async function unscheduleIdeaAction(formData) {
  const id = Number(formData.get('id'));
  const from = formData.get('from') === 'publish' ? '/publish' : '/create';
  let error = '';

  try {
    getStore().unscheduleIdea(id);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail(from, error);
  refresh();
  redirect(`${from}?ok=removido`);
}

export async function publishIdeaAction(formData) {
  const id = Number(formData.get('id'));
  let error = '';

  try {
    getStore().markPublished(id);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Tente novamente.';
  }

  if (error) fail('/publish', error);
  refresh();
  redirect('/publish?ok=publicado');
}
