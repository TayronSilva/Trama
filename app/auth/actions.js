'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createAdminClient,
  createClient,
} from '../../lib/supabase/server';

const ACTIVE_WORKSPACE_COOKIE = 'trama_active_workspace';
const ACTIVE_WORKSPACE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
};

async function fetchWorkspaceName(workspaceId) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/workspaces?select=name&id=eq.${encodeURIComponent(workspaceId)}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      },
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data?.[0]?.name || null;
  } catch {
    return null;
  }
}

async function adminInsertWorkspaceMember({ workspaceId, userId, role }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Servidor sem credenciais de admin.');
  }
  const r = await fetch(`${supabaseUrl}/rest/v1/workspace_members`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      user_id: userId,
      role,
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `Erro ${r.status} ao inserir membro.`);
  }
  return r;
}

async function getActiveMembership(supabase, userId) {
  const { data: members } = await supabase
    .from('workspace_members')
    .select('role, workspace_id, workspace:workspaces(id, name, slug)')
    .eq('user_id', userId);

  const memberships = (members ?? []).filter((member) => member.workspace);
  const cookieStore = await cookies();
  const preferredId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active =
    memberships.find(
      (member) => member.workspace_id === preferredId,
    ) ||
    memberships[0] ||
    null;

  return { memberships, active };
}

async function setActiveWorkspaceCookie(workspaceId) {
  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_WORKSPACE_COOKIE,
    workspaceId,
    ACTIVE_WORKSPACE_COOKIE_OPTIONS,
  );
}

async function clearActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

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
  await clearActiveWorkspaceCookie();
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

  // Busca workspaces do usuário e resolve o espaço ativo pelo cookie.
  const { memberships, active } = await getActiveMembership(supabase, user.id);
  const currentWorkspace = active?.workspace ?? null;
  const role = active?.role ?? 'member';

  // Busca membros do workspace ativo.
  // O select evita o join user:profiles (sem FK definida no schema) para
  // nao quebrar a leitura; os perfis sao buscados em seguida e combinados.
  let teamMembers = [];
  if (currentWorkspace?.id) {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role, user_id, created_at')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: true });

    const userIds = (memberships ?? [])
      .map((m) => m.user_id)
      .filter(Boolean);

    let profilesById = {};
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_color')
        .in('user_id', userIds);
      profilesById = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p]),
      );
    }

    teamMembers = (memberships ?? []).map((m) => ({
      role: m.role,
      user: profilesById[m.user_id] ?? null,
    }));
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
    workspaces: memberships.map((member) => ({
      role: member.role,
      workspace: member.workspace,
    })),
  };
}

export async function switchWorkspaceAction(workspaceId) {
  const id = String(workspaceId ?? '').trim();
  if (!id) {
    return { ok: false, error: 'Espaço inválido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  const { data: member, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!member) {
    return { ok: false, error: 'Você não faz parte deste espaço.' };
  }

  await setActiveWorkspaceCookie(id);
  revalidatePath('/', 'layout');
  revalidatePath('/configuracoes');
  return { ok: true, workspace_id: id };
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

  await setActiveWorkspaceCookie(ws.id);
  revalidatePath('/', 'layout');
  revalidatePath('/configuracoes');
  return { ok: true, workspace: ws };
}

export async function inviteMemberAction({ email, role = 'member' }) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  const { active } = await getActiveMembership(supabase, user.id);

  if (!active || (active.role !== 'owner' && active.role !== 'admin')) {
    return { ok: false, error: 'Apenas administradores podem convidar membros.' };
  }

  if (normalizedEmail === String(user.email ?? '').toLowerCase().trim()) {
    return { ok: false, error: 'Você já faz parte deste espaço.' };
  }

  // Evita empilhar convites e notificações para o mesmo e-mail e espaço.
  const { data: existingInvites, error: existingError } = await supabase
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', active.workspace_id)
    .ilike('email', normalizedEmail)
    .is('accepted_at', null)
    .or('status.eq.pending,status.is.null')
    .limit(1);

  if (existingError) {
    return {
      ok: false,
      error: 'Erro ao verificar convites: ' + existingError.message,
    };
  }

  if (existingInvites?.length) {
    return {
      ok: false,
      error: 'Já existe um convite pendente para este e-mail.',
    };
  }

  const { data: invitedProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (invitedProfile?.id) {
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', active.workspace_id)
      .eq('user_id', invitedProfile.id)
      .maybeSingle();

    if (existingMember) {
      return { ok: false, error: 'Essa pessoa já faz parte deste espaço.' };
    }
  }

  const inviteRole = role === 'admin' ? 'admin' : 'member';
  const workspaceName = active.workspace?.name || 'seu espaço';

  const { error } = await supabase.from('workspace_invites').insert({
    workspace_id: active.workspace_id,
    email: normalizedEmail,
    invited_by: user.id,
    role: inviteRole,
    status: 'pending',
    user_id: invitedProfile?.id ?? null,
  });

  if (error) {
    return { ok: false, error: 'Erro ao gerar convite: ' + error.message };
  }

  if (invitedProfile?.id) {
    await supabase.from('notifications').insert({
      user_id: invitedProfile.id,
      workspace_id: active.workspace_id,
      type: 'invite',
      title: 'Convite para equipe',
      message: `Você foi convidado para participar de "${workspaceName}" no Trama.`,
      link: '/configuracoes#convites',
    });
  }

  return {
    ok: true,
    message: `Convite enviado para ${normalizedEmail}.`,
  };
}

export async function deleteWorkspaceAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  // Pega o workspace ativo do usuário (deve ser owner)
  const { active } = await getActiveMembership(supabase, user.id);

  if (!active || active.role !== 'owner') {
    return { ok: false, error: 'Apenas o dono pode excluir o espaço.' };
  }

  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', active.workspace_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  await clearActiveWorkspaceCookie();
  revalidatePath('/', 'layout');
  revalidatePath('/configuracoes');
  return { ok: true };
}

export async function getPendingInvites() {
  // Autentica com o cliente anônimo (respeita sessão e cookies do usuário).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const userEmail = String(user.email ?? '').toLowerCase().trim();

  // Lê os convites pendentes com o cliente anônimo. Isso funciona porque o
  // convidado já pode ler seus próprios convites por e-mail.
  const { data: invites, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) return [];

  // Filtra por email e status no cliente. O status "pending" é a fonte
  // de verdade; convites recusados não voltam para a lista.
  const pending = (invites ?? []).filter((invite) => {
    const status = String(invite.status ?? 'pending').toLowerCase();
    const email = String(invite.email ?? '').toLowerCase().trim();
    return status === 'pending' && email === userEmail;
  });

  // Agrupa por espaço: convites duplicados viram um único cartão.
  const byWorkspace = new Map();
  for (const invite of pending) {
    if (!byWorkspace.has(invite.workspace_id)) {
      byWorkspace.set(invite.workspace_id, invite);
    }
  }

  // Completa o nome do workspace usando a service role key (o convidado ainda
  // não é membro, então a RLS de workspaces bloqueia a leitura anônima).
  const result = [];
  for (const invite of byWorkspace.values()) {
    const workspaceName = await fetchWorkspaceName(invite.workspace_id);
    result.push({
      ...invite,
      workspace: workspaceName ? { name: workspaceName } : null,
      inviter: null,
    });
  }

  return result;
}

export async function acceptInvite(inviteId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  const userEmail = String(user.email ?? '').toLowerCase().trim();

  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteError || !invite) {
    return { ok: false, error: 'Convite não encontrado.' };
  }

  const workspaceName = await fetchWorkspaceName(invite.workspace_id);

  if (invite.accepted_at) {
    return { ok: false, error: 'Este convite já foi encerrado.' };
  }

  const inviteStatus = String(invite.status ?? 'pending').toLowerCase();
  if (inviteStatus !== 'pending') {
    return { ok: false, error: 'Este convite não está mais pendente.' };
  }

  // Verifica se o email do convite corresponde ao usuário logado
  if (String(invite.email ?? '').toLowerCase().trim() !== userEmail) {
    return { ok: false, error: 'Este convite não é para o seu e-mail.' };
  }

  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  let joined = false;

  if (!existingMember) {
    // Adiciona usuário ao workspace como membro.
    // Usa fetch direto com service role para evitar a recursão infinita da
    // política RLS de workspace_members (que valida o convite via
    // workspace_invites e causa recursão com a política de SELECT).
    const admin = await createAdminClient();
    try {
      await adminInsertWorkspaceMember({
        workspaceId: invite.workspace_id,
        userId: user.id,
        role: invite.role || 'member',
      });
    } catch (err) {
      const isDuplicate =
        /duplicate|already exists|23505/i.test(err?.message ?? '');
      if (!isDuplicate) {
        return { ok: false, error: err.message };
      }
    }
    joined = true;
  }

  // Encerra o convite e todos os duplicados do mesmo espaço/e-mail.
  const { error: updateError } = await supabase
    .from('workspace_invites')
    .update({
      accepted_at: new Date().toISOString(),
      status: 'accepted',
      user_id: user.id,
    })
    .eq('workspace_id', invite.workspace_id)
    .ilike('email', userEmail)
    .is('accepted_at', null);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Limpa as notificações antigas de convite deste espaço.
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('workspace_id', invite.workspace_id)
    .eq('type', 'invite');

  if (joined) {
    await supabase.from('notifications').insert({
      user_id: user.id,
      workspace_id: invite.workspace_id,
      type: 'invite',
      title: 'Bem-vindo ao workspace',
      message: `Você entrou no espaço ${workspaceName || 'do Trama'}.`,
      link: '/configuracoes#espaco',
    });
  }

  // Ao aceitar, o espaço recém-adicionado passa a ser o ativo.
  await setActiveWorkspaceCookie(invite.workspace_id);
  revalidatePath('/', 'layout');
  revalidatePath('/configuracoes');

  return {
    ok: true,
    workspace_id: invite.workspace_id,
    workspace_name: workspaceName || 'o espaço',
  };
}

export async function declineInvite(inviteId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  const userEmail = String(user.email ?? '').toLowerCase().trim();

  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteError || !invite) {
    return { ok: false, error: 'Convite não encontrado.' };
  }

  if (String(invite.email ?? '').toLowerCase().trim() !== userEmail) {
    return { ok: false, error: 'Este convite não é para o seu e-mail.' };
  }

  if (invite.accepted_at) {
    return { ok: false, error: 'Este convite já foi encerrado.' };
  }

  const inviteStatus = String(invite.status ?? 'pending').toLowerCase();
  if (inviteStatus !== 'pending') {
    return { ok: false, error: 'Este convite não está mais pendente.' };
  }

  // "rejected" é o valor aceito pela constraint do banco. accepted_at
  // também é preenchido para que a política RLS antiga (que só olha
  // accepted_at) não permita entrada após a recusa.
  const { error: updateError } = await supabase
    .from('workspace_invites')
    .update({
      accepted_at: new Date().toISOString(),
      status: 'rejected',
      user_id: user.id,
    })
    .eq('workspace_id', invite.workspace_id)
    .ilike('email', userEmail)
    .is('accepted_at', null);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('workspace_id', invite.workspace_id)
    .eq('type', 'invite');

  revalidatePath('/', 'layout');
  revalidatePath('/configuracoes');

  return {
    ok: true,
    workspace_id: invite.workspace_id,
  };
}

export async function updateUserName({ name }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Informe um nome válido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.updateUser({
    data: { name: trimmed },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase
    .from('profiles')
    .upsert({ id: user.id, name: trimmed }, { onConflict: 'id' });

  revalidatePath('/', 'layout');
  return { ok: true, name: trimmed };
}

export async function changePasswordAction({ newPassword }) {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updateWorkspaceNameAction({ name }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Informe um nome válido para o espaço.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Não autenticado.' };
  }

  const { active } = await getActiveMembership(supabase, user.id);

  if (!active || active.role !== 'owner') {
    return { ok: false, error: 'Apenas o dono pode editar o nome do espaço.' };
  }

  const { error } = await supabase
    .from('workspaces')
    .update({ name: trimmed })
    .eq('id', active.workspace_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
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
    // Convites pendentes têm uma seção própria e acionável no popover.
    // Não precisamos repetir um item por convite no histórico.
    .neq('title', 'Convite para equipe')
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
