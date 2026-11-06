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

  // Gera uma cor de avatar aleatória e elegante
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

  // Se o usuário foi criado e a sessão iniciada automaticamente
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

  // Busca workspace do usuário
  const { data: members } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, slug)')
    .eq('user_id', user.id);

  const currentWorkspace = members?.[0]?.workspace ?? null;
  const role = members?.[0]?.role ?? 'member';

  // Busca todos os membros do workspace ativo
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
  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: member.workspace_id,
      email: email.trim().toLowerCase(),
      invited_by: user.id,
      role,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: 'Erro ao gerar convite: ' + error.message };
  }

  // Verifica se o convidado já possui conta no sistema para disparar notificação
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
      message: `Você foi convidado para participar de um espaço de trabalho no Trama.`,
      link: '/create',
    });
  }

  return { ok: true, message: `Convite enviado para ${email}.` };
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
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  return { ok: true };
}

