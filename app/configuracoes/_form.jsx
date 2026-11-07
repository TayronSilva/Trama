'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createWorkspaceAction,
  updateUserName,
  changePasswordAction,
  updateWorkspaceNameAction,
  inviteMemberAction,
  deleteWorkspaceAction,
  acceptInvite as acceptInviteAction,
  declineInvite as declineInviteAction,
  switchWorkspaceAction,
  saveUserChannelHandle,
  getUserChannelHandles,
  getPendingInvites as getPendingInvitesAction,
} from '../auth/actions';
import { CHANNELS } from '../../lib/channels';
import { Icon } from '../../components/Icons';
import WorkspaceActivity from '../../components/WorkspaceActivity';

function roleLabel(role) {
  if (role === 'owner') return 'Dono';
  if (role === 'admin') return 'Admin';
  return 'Membro';
}

function initialOf(value) {
  return String(value || '?').trim().charAt(0).toUpperCase() || '?';
}

export default function ConfiguracoesForm({ initial }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  async function reload() {
    const handlesRes = await getUserChannelHandles();
    const pending = await getPendingInvitesAction();
    setData((prev) => ({
      ...prev,
      userHandles: handlesRes.ok ? handlesRes.handles : {},
      pendingInvites: pending ?? [],
    }));
  }

  async function runAction(key, task) {
    setBusy(key);
    setMessage(null);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.',
      );
    } finally {
      setBusy('');
    }
  }

  function handleUpdateName(e) {
    e.preventDefault();
    const name = e.currentTarget.elements.name.value;
    runAction('name', async () => {
      const res = await updateUserName({ name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage('Nome atualizado.');
      setData((prev) => ({
        ...prev,
        profile: { ...prev.profile, name: res.name },
      }));
    });
  }

  function handleChangePassword(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = form.elements.password.value;
    runAction('password', async () => {
      const res = await changePasswordAction({ newPassword: password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      form.reset();
      setMessage('Senha atualizada.');
    });
  }

  function handleUpdateWorkspace(e) {
    e.preventDefault();
    const name = e.currentTarget.elements.workspaceName.value;
    runAction('workspace-name', async () => {
      const res = await updateWorkspaceNameAction({ name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage('Nome do espaço atualizado.');
      setData((prev) => ({
        ...prev,
        workspace: { ...prev.workspace, name },
      }));
    });
  }

  function handleCreateWorkspace(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.elements.workspaceName.value;
    runAction('create-workspace', async () => {
      const res = await createWorkspaceAction({ name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      form.reset();
      setMessage('Espaço criado.');
      router.refresh();
    });
  }

  function handleInvite(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.elements.inviteEmail.value;
    runAction('invite', async () => {
      const res = await inviteMemberAction({ email });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      form.reset();
      setMessage(res.message || 'Convite enviado.');
      await reload();
    });
  }

  function handleDeleteWorkspace() {
    if (
      !window.confirm(
        'Excluir este espaço apagará todos os dados. Esta ação não pode ser desfeita. Continuar?',
      )
    ) {
      return;
    }

    runAction('delete-workspace', async () => {
      const res = await deleteWorkspaceAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData((prev) => ({
        ...prev,
        workspace: null,
        role: 'member',
        teamMembers: [],
      }));
      setMessage('Espaço excluído.');
      router.refresh();
    });
  }

  function handleAcceptInvite(id) {
    runAction(`accept-${id}`, async () => {
      const res = await acceptInviteAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData((prev) => ({
        ...prev,
        pendingInvites: prev.pendingInvites.filter(
          (invite) => invite.id !== id,
        ),
      }));
      setMessage(
        res.workspace_name
          ? `Você entrou em ${res.workspace_name}.`
          : 'Convite aceito.',
      );
      router.refresh();
    });
  }

  function handleDeclineInvite(id) {
    runAction(`decline-${id}`, async () => {
      const res = await declineInviteAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData((prev) => ({
        ...prev,
        pendingInvites: prev.pendingInvites.filter(
          (invite) => invite.id !== id,
        ),
      }));
      setMessage('Convite recusado.');
      router.refresh();
    });
  }

  function handleSwitchWorkspace(id) {
    runAction(`switch-${id}`, async () => {
      const res = await switchWorkspaceAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage('Espaço ativo alterado.');
      router.refresh();
    });
  }

  function handleSaveHandles(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    runAction('handles', async () => {
      let failed = false;
      for (const channel of CHANNELS) {
        const handle = formData.get(`handle-${channel.id}`);
        if (!handle) continue;
        const res = await saveUserChannelHandle({
          channelId: channel.id,
          handle,
        });
        if (!res.ok) {
          setError(res.error);
          failed = true;
          break;
        }
      }
      if (failed) return;
      setMessage('Handles salvos.');
      await reload();
    });
  }

  const {
    profile = {},
    workspace,
    role = 'member',
    teamMembers = [],
    workspaces = [],
    userHandles = {},
    pendingInvites = [],
  } = data;

  const members =
    teamMembers.length > 0
      ? teamMembers
      : [{ role, user: profile }];

  return (
    <div className="page settings-page">
      <header className="page-header settings-page-header">
        <div className="page-heading">
          <p className="page-context">Preferências da conta</p>
          <h1>Configurações</h1>
          <p className="page-subtitle">
            Sua conta, seu espaço de trabalho e seus canais — cada ajuste no seu
            próprio bloco.
          </p>
        </div>

        <div className="settings-identity">
          <span
            className="settings-avatar"
            style={{ '--avatar-bg': profile.avatar_color || '#e11d48' }}
            aria-hidden="true"
          >
            {initialOf(profile.name || profile.email)}
          </span>
          <span className="settings-identity-copy">
            <strong>{profile.name || 'Sua conta'}</strong>
            <span>{workspace?.name || 'Sem espaço criado'}</span>
          </span>
        </div>
      </header>

      {message && (
        <p className="banner success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções de configuração">
          <a className="settings-nav-link" href="#conta">
            Conta
          </a>
          <a className="settings-nav-link" href="#espaco">
            Espaço de trabalho
          </a>
          {pendingInvites.length > 0 && (
            <a className="settings-nav-link" href="#convites">
              Convites
              <span className="settings-nav-count">
                {pendingInvites.length}
              </span>
            </a>
          )}
          <a className="settings-nav-link" href="#canais">
            Redes sociais
          </a>
          <span className="settings-nav-note">
            Alterações são salvas neste computador e sincronizadas com sua
            conta.
          </span>
        </nav>

        <div className="settings-main">
          <section id="conta" className="settings-card">
            <header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <Icon name="gear" size={18} />
              </span>
              <div className="settings-card-heading">
                <h2>Conta</h2>
                <p>Seus dados de acesso e como você aparece no Trama.</p>
              </div>
            </header>

            <div className="settings-card-body">
              <div className="settings-row">
                <div className="settings-row-copy">
                  <h3>Nome de exibição</h3>
                  <p>Aparece no menu, nos convites e nas prévias.</p>
                </div>
                <form onSubmit={handleUpdateName} className="settings-inline-form">
                  <input
                    type="text"
                    name="name"
                    defaultValue={profile.name ?? ''}
                    required
                    className="settings-input"
                    aria-label="Nome de exibição"
                    autoComplete="name"
                  />
                  <button
                    type="submit"
                    className="button primary small"
                    disabled={busy === 'name'}
                  >
                    {busy === 'name' ? 'Salvando…' : 'Salvar nome'}
                  </button>
                </form>
              </div>

              <div className="settings-row">
                <div className="settings-row-copy">
                  <h3>E-mail</h3>
                  <p>Usado para entrar e receber convites de equipe.</p>
                </div>
                <div className="settings-readonly">
                  <span>{profile.email}</span>
                  <span className="settings-readonly-note">Não editável</span>
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-copy">
                  <h3>Senha</h3>
                  <p>Defina uma nova senha com pelo menos 6 caracteres.</p>
                </div>
                <form
                  onSubmit={handleChangePassword}
                  className="settings-inline-form"
                >
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    defaultValue={profile.email || ''}
                    hidden
                    readOnly
                  />
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    placeholder="Nova senha"
                    className="settings-input"
                    aria-label="Nova senha"
                    autoComplete="new-password"
                  />
                  <button
                    type="submit"
                    className="button primary small"
                    disabled={busy === 'password'}
                  >
                    {busy === 'password' ? 'Alterando…' : 'Alterar senha'}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section id="espaco" className="settings-card">
            <header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <Icon name="layers" size={18} />
              </span>
              <div className="settings-card-heading">
                <h2>Espaço de trabalho</h2>
                <p>O lugar onde sua equipe organiza o conteúdo.</p>
              </div>
              {workspace && (
                <span className={`role-pill role-${role}`}>
                  {roleLabel(role)}
                </span>
              )}
            </header>

            <div className="settings-card-body">
              {!workspace ? (
                <div className="settings-empty">
                  <span className="settings-empty-icon" aria-hidden="true">
                    <Icon name="layers" size={22} />
                  </span>
                  <h3>Crie seu primeiro espaço</h3>
                  <p>
                    Dê um nome ao projeto, marca ou estúdio para começar a
                    planejar e convidar sua equipe.
                  </p>
                  <form
                    onSubmit={handleCreateWorkspace}
                    className="settings-inline-form settings-inline-form-wide"
                  >
                    <input
                      type="text"
                      name="workspaceName"
                      required
                      placeholder="Ex: Trama Studio, Canal Tech"
                      className="settings-input"
                      aria-label="Nome do espaço de trabalho"
                    />
                    <button
                      type="submit"
                      className="button primary small"
                      disabled={busy === 'create-workspace'}
                    >
                      {busy === 'create-workspace'
                        ? 'Criando…'
                        : 'Criar espaço'}
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  <div className="settings-row">
                    <div className="settings-row-copy">
                      <h3>Nome do espaço</h3>
                      <p>O nome que identifica este espaço para a equipe.</p>
                    </div>
                    {role === 'owner' ? (
                      <form
                        onSubmit={handleUpdateWorkspace}
                        className="settings-inline-form"
                      >
                        <input
                          type="text"
                          name="workspaceName"
                          defaultValue={workspace.name}
                          required
                          className="settings-input"
                          aria-label="Nome do espaço de trabalho"
                        />
                        <button
                          type="submit"
                          className="button primary small"
                          disabled={busy === 'workspace-name'}
                        >
                          {busy === 'workspace-name'
                            ? 'Salvando…'
                            : 'Salvar espaço'}
                        </button>
                      </form>
                    ) : (
                      <div className="settings-readonly">
                        <span>{workspace.name}</span>
                        <span className="settings-readonly-note">
                          Apenas o dono edita
                        </span>
                      </div>
                    )}
                  </div>

                  {workspaces.length > 1 && (
                    <div className="settings-row is-stacked">
                      <div className="settings-row-copy">
                        <h3>Seus espaços</h3>
                        <p>Escolha qual espaço fica ativo no Trama.</p>
                      </div>
                      <ul className="settings-workspaces">
                        {workspaces.map((item) => {
                          const itemWorkspace = item.workspace;
                          const isActive = itemWorkspace.id === workspace.id;
                          const switchKey = `switch-${itemWorkspace.id}`;
                          return (
                            <li
                              key={itemWorkspace.id}
                              className={`settings-workspace ${
                                isActive ? 'is-active' : ''
                              }`}
                            >
                              <span className="settings-workspace-copy">
                                <strong>{itemWorkspace.name}</strong>
                                <span>{roleLabel(item.role)}</span>
                              </span>
                              {isActive ? (
                                <span className="settings-active-pill">
                                  Ativo
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="button secondary small"
                                  onClick={() =>
                                    handleSwitchWorkspace(itemWorkspace.id)
                                  }
                                  disabled={busy === switchKey}
                                >
                                  {busy === switchKey
                                    ? 'Ativando…'
                                    : 'Usar este espaço'}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="settings-row is-stacked">
                    <div className="settings-row-copy">
                      <h3>
                        Membros
                        <span className="settings-count">{members.length}</span>
                      </h3>
                      <p>Quem tem acesso a {workspace.name}.</p>
                    </div>
                    <ul className="settings-members">
                      {members.map((member, index) => {
                        const memberUser = member.user || {};
                        const memberName =
                          memberUser.name || memberUser.email || 'Membro';
                        const isYou = memberUser.id === profile.id;
                        return (
                          <li
                            className="settings-member"
                            key={memberUser.id || `member-${index}`}
                          >
                            <span
                              className="settings-member-avatar"
                              style={{
                                '--avatar-bg':
                                  memberUser.avatar_color || '#e11d48',
                              }}
                              aria-hidden="true"
                            >
                              {initialOf(memberName)}
                            </span>
                            <span className="settings-member-copy">
                              <strong>
                                {memberName}
                                {isYou ? ' (você)' : ''}
                              </strong>
                              <span>{memberUser.email || 'Sem e-mail'}</span>
                            </span>
                            <span className={`role-pill role-${member.role}`}>
                              {roleLabel(member.role)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <WorkspaceActivity />

                  {(role === 'owner' || role === 'admin') && (
                    <div className="settings-row">
                      <div className="settings-row-copy">
                        <h3>Convidar pessoa</h3>
                        <p>
                          Envie um convite por e-mail para alguém entrar neste
                          espaço.
                        </p>
                      </div>
                      <form
                        onSubmit={handleInvite}
                        className="settings-inline-form"
                      >
                        <input
                          type="email"
                          name="inviteEmail"
                          placeholder="pessoa@email.com"
                          required
                          className="settings-input"
                          aria-label="E-mail da pessoa a convidar"
                        />
                        <button
                          type="submit"
                          className="button primary small"
                          disabled={busy === 'invite'}
                        >
                          {busy === 'invite' ? 'Enviando…' : 'Convidar membro'}
                        </button>
                      </form>
                    </div>
                  )}

                  {role === 'owner' && (
                    <div className="settings-danger-zone">
                      <div className="settings-row-copy">
                        <h3>Excluir espaço</h3>
                        <p>
                          Apaga o espaço, os membros e o conteúdo vinculado.
                          Esta ação não pode ser desfeita.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="button danger small"
                        onClick={handleDeleteWorkspace}
                        disabled={busy === 'delete-workspace'}
                      >
                        <Icon name="trash" size={14} />
                        {busy === 'delete-workspace'
                          ? 'Excluindo…'
                          : 'Excluir espaço'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {pendingInvites.length > 0 && (
            <section id="convites" className="settings-card">
              <header className="settings-card-head">
                <span className="settings-card-icon" aria-hidden="true">
                  <Icon name="bell" size={18} />
                </span>
                <div className="settings-card-heading">
                  <h2>Convites recebidos</h2>
                  <p>Convites para participar de outros espaços.</p>
                </div>
                <span className="settings-card-badge">
                  {pendingInvites.length}
                </span>
              </header>

              <div className="settings-card-body">
                <ul className="settings-invite-list">
                  {pendingInvites.map((invite) => (
                    <li key={invite.id} className="settings-invite-item">
                      <div className="settings-invite-copy">
                        <strong>
                          {invite.workspace?.name || 'Espaço de trabalho'}
                        </strong>
                        <span>
                          Convidado por{' '}
                          {invite.inviter?.name ||
                            invite.inviter?.email ||
                            'um membro'}
                        </span>
                      </div>
                      <div className="settings-invite-actions">
                        <button
                          type="button"
                          className="button primary small"
                          onClick={() => handleAcceptInvite(invite.id)}
                          disabled={
                            busy === `accept-${invite.id}` ||
                            busy === `decline-${invite.id}`
                          }
                        >
                          <Icon name="check" size={14} />
                          {busy === `accept-${invite.id}`
                            ? 'Aceitando…'
                            : 'Aceitar'}
                        </button>
                        <button
                          type="button"
                          className="button secondary small"
                          onClick={() => handleDeclineInvite(invite.id)}
                          disabled={
                            busy === `accept-${invite.id}` ||
                            busy === `decline-${invite.id}`
                          }
                        >
                          <Icon name="x" size={14} />
                          {busy === `decline-${invite.id}`
                            ? 'Recusando…'
                            : 'Recusar'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section id="canais" className="settings-card">
            <header className="settings-card-head">
              <span className="settings-card-icon" aria-hidden="true">
                <Icon name="send" size={18} />
              </span>
              <div className="settings-card-heading">
                <h2>Redes sociais</h2>
                <p>Defina seu @ em cada canal para as prévias de publicação.</p>
              </div>
            </header>

            <div className="settings-card-body">
              <form
                onSubmit={handleSaveHandles}
                className="settings-handles-form"
              >
                <div className="settings-handles-grid">
                  {CHANNELS.map((channel) => {
                    const current = userHandles[channel.id] || '';
                    return (
                      <label
                        key={channel.id}
                        className="settings-handle"
                        htmlFor={`handle-${channel.id}`}
                      >
                        <span className="settings-handle-label">
                          <span
                            className="channel-dot"
                            style={{ background: channel.color }}
                            aria-hidden="true"
                          />
                          {channel.name}
                        </span>
                        <input
                          id={`handle-${channel.id}`}
                          type="text"
                          name={`handle-${channel.id}`}
                          defaultValue={current}
                          placeholder={`@${channel.name.toLowerCase()}`}
                          className="settings-input"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="settings-form-foot">
                  <span className="settings-form-hint">
                    O @ aparece nas prévias e não altera a publicação.
                  </span>
                  <button
                    type="submit"
                    className="button primary small"
                    disabled={busy === 'handles'}
                  >
                    {busy === 'handles' ? 'Salvando…' : 'Salvar handles'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
