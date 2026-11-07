'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export async function signInAction(formData) {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { ok: false, error: 'Preencha o e-mail e a senha.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
    };
  }

  revalidatePath('/', 'layout');
  redirect('/create');
}

export async function signUpAction(formData) {
  const name = formData.get('name')?.toString().trim();
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!name || !email || !password) {
    return { ok: false, error: 'Preencha todos os campos.' };
  }

  if (password.length < 6) {
    return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }

  // Cores de avatar consistentes e vibrantes
  const COLORS = ['#e11d48', '#0a66c2', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  const avatar_color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        avatar_color,
      },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data?.session) {
    revalidatePath('/', 'layout');
    redirect('/create');
  }

  return {
    ok: true,
    message: 'Conta criada com sucesso! Faça login para continuar.',
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function getProfileAndWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Busca perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Busca workspaces do usuário
  const { data: members } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, slug)')
    .eq('user_id', user.id);

  const currentWorkspace = members?.[0]?.workspace ?? null;
  const role = members?.[0]?.role ?? 'member';

  // Busca membros do workspace ativo
  let teamMembers = [];
  if (currentWorkspace?.id) {
    const { data: team } = await supabase
      .from('workspace_members')
      .select('role, user:profiles(id, name, email, avatar_color)')
      .eq('workspace_id', currentWorkspace.id);
    teamMembers = team ?? [];
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: profile?.name || user.email.split('@')[0],
      avatar_color: profile?.avatar_color || '#e11d48',
    },
    workspace: currentWorkspace,
    role,
    teamMembers,
  };
}

export async function createWorkspaceAction({ name }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Informe um nome para o espaço de trabalho.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Usuário não autenticado.' };
  }

  const slug =
    trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'espaco';

  const { data: ws, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: trimmed,
      slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      created_by: user.id,
    })
    .select()
    .single();

  if (wsError || !ws) {
    return { ok: false, error: 'Erro ao criar espaço: ' + (wsError?.message || '') };
  }

  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: 'owner',
  });

  if (memberError) {
    return { ok: false, error: 'Erro ao vincular membro: ' + memberError.message };
  }

  revalidatePath('/', 'layout');
  return { ok: true, workspace: ws };
}

export async function inviteMemberAction({ email, role = 'member' }) {
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  // Pega o workspace atual
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { ok: false, error: 'Apenas administradores podem convidar membros.' };
  }

  // Cria o convite
  const { error } = await supabase.from('workspace_invites').insert({
    workspace_id: member.workspace_id,
    email: email.trim().toLowerCase(),
    invited_by: user.id,
    role,
  });

  if (error) {
    return { ok: false, error: 'Erro ao gerar convite: ' + error.message };
  }

  // Notifica o usuário convidado se ele já possuir conta
  const { data: invitedProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (invitedProfile?.id) {
    await supabase.from('notifications').insert({
      user_id: invitedProfile.id,
      workspace_id: member.workspace_id,
      type: 'invite',
      title: 'Convite para equipe',
      message: 'Você foi convidado para colaborar em um espaço de trabalho no Trama.',
      link: '/create',
    });
  }

  return { ok: true, message: `Convite enviado para ${email}.` };
}

export async function getPendingInvites() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: invites, error } = await supabase
    .from('workspace_invites')
    .select('*, workspace:workspaces(name, slug), inviter:profiles!invited_by(name, email)')
    .eq('email', user.email)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) return [];
  return invites ?? [];
}

export async function acceptInvite(inviteId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  // Busca o convite pendente para este email
  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('email', user.email)
    .is('accepted_at', null)
    .single();

  if (inviteError || !invite) {
    return { ok: false, error: 'Convite não encontrado ou já aceito.' };
  }

  // Adiciona usuário ao workspace como membro
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: user.id,
    role: invite.role || 'member',
  });

  if (memberError) {
    return { ok: false, error: memberError.message };
  }

  // Marca convite como aceito
  const { error: updateError } = await supabase
    .from('workspace_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Cria notificação de boas-vindas no workspace
  await supabase.from('notifications').insert({
    user_id: user.id,
    workspace_id: invite.workspace_id,
    type: 'invite',
    title: 'Bem-vindo ao workspace',
    message: `Você entrou no espaço ${invite.workspace?.name || 'do Trama'}.`,
    link: '/create',
  });

  revalidatePath('/', 'layout');
  return { ok: true, workspace_id: invite.workspace_id };
}

export async function getNotificationsAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(15);

  return notifications ?? [];
}

export async function markNotificationReadAction(notificationId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Nao autenticado.' };
  }
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);

  return { ok: true };
}

export async function getUserChannelHandles() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Nao autenticado.', handles: {} };
  }

  const { data, error } = await supabase
    .from('user_channel_handles')
    .select('channel_id, handle')
    .eq('user_id', user.id);

  if (error) {
    return { ok: false, error: error.message, handles: {} };
  }

  const handles = {};
  (data ?? []).forEach((row) => {
    handles[row.channel_id] = row.handle;
  });

  return { ok: true, handles };
}

export async function saveUserChannelHandle({ channelId, handle }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Nao autenticado.' };
  }

  const trimmed = String(handle ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Informe um handle valido.' };
  }

  // Upsert: insere se nao existir, atualiza se ja existir
  const { error } = await supabase.from('user_channel_handles').upsert(
    {
      user_id: user.id,
      channel_id: channelId,
      handle: trimmed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id, channel_id' }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
