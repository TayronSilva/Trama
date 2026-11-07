'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateUserName,
  changePasswordAction,
  updateWorkspaceNameAction,
  inviteMemberAction,
  deleteWorkspaceAction,
  acceptInvite as acceptInviteAction,
  saveUserChannelHandle,
  getUserChannelHandles,
  getPendingInvites as getPendingInvitesAction,
} from '../auth/actions';
import { CHANNELS } from '../../lib/channels';
import { Icon } from '../../components/Icons';

export default function ConfiguracoesForm({ initial }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(initial);
  }, [initial]);

  async function reload() {
    setLoading(true);
    try {
      const handlesRes = await getUserChannelHandles();
      const pending = await getPendingInvitesAction();
      setData((prev) => ({
        ...prev,
        userHandles: handlesRes.ok ? handlesRes.handles : {},
        pendingInvites: pending ?? [],
      }));
    } catch (err) {
      setError(err.message || 'Erro ao recarregar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateName(e) {
    e.preventDefault();
    const name = e.target.elements.name.value;
    const res = await updateUserName({ name });
    if (res.ok) {
      setMessage('Nome atualizado.');
      setError(null);
      setData((prev) => ({ ...prev, profile: { ...prev.profile, name: res.name } }));
    } else {
      setError(res.error);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    const password = e.target.elements.password.value;
    const res = await changePasswordAction({ newPassword: password });
    if (res.ok) {
      setMessage('Senha atualizada.');
      setError(null);
      e.target.reset();
    } else {
      setError(res.error);
    }
  }

  async function handleUpdateWorkspace(e) {
    e.preventDefault();
    const name = e.target.elements.workspaceName.value;
    const res = await updateWorkspaceNameAction({ name });
    if (res.ok) {
      setMessage('Nome do espaço atualizado.');
      setError(null);
      setData((prev) => ({ ...prev, workspace: { ...prev.workspace, name } }));
    } else {
      setError(res.error);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    const email = e.target.elements.inviteEmail.value;
    const res = await inviteMemberAction({ email });
    if (res.ok) {
      setMessage(res.message);
      setError(null);
      e.target.reset();
      await reload();
    } else {
      setError(res.error);
    }
  }

  async function handleDeleteWorkspace() {
    if (!window.confirm('Excluir este espaço apagará todos os dados. Continuar?')) return;
    const res = await deleteWorkspaceAction();
    if (res.ok) router.push('/login');
    else setError(res.error);
  }

  async function handleAcceptInvite(id) {
    const res = await acceptInviteAction(id);
    if (res.ok) {
      setMessage('Convite aceito.');
      setError(null);
      await reload();
    } else {
      setError(res.error);
    }
  }

  async function handleSaveHandles(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    let failed = false;
    for (const channel of CHANNELS) {
      const handle = formData.get(`handle-${channel.id}`);
      if (!handle) continue;
      const res = await saveUserChannelHandle({ channelId: channel.id, handle });
      if (!res.ok) {
        setError(res.error);
        failed = true;
        break;
      }
    }
    if (!failed) {
      setMessage('Handles salvos.');
      setError(null);
      await reload();
    }
  }

  const { profile, workspace, role, userHandles, pendingInvites } = data;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1>Configurações</h1>
          <p className="page-subtitle">
            Gerencie sua conta, espaço de trabalho e canais sociais.
          </p>
        </div>
      </header>

      {message && <p className="banner success">{message}</p>}
      {error && <p className="banner error">{error}</p>}

      <section className="settings-section">
        <h2>Conta</h2>

        <form onSubmit={handleUpdateName} className="settings-form">
          <label>
            <span>Nome</span>
            <input
              type="text"
              name="name"
              defaultValue={profile?.name ?? ''}
              required
              className="settings-input"
            />
          </label>
          <button type="submit" className="button primary small">Salvar nome</button>
        </form>

        <form onSubmit={handleChangePassword} className="settings-form">
          <label>
            <span>Nova senha</span>
            <input type="password" name="password" required className="settings-input" />
          </label>
          <button type="submit" className="button primary small">Alterar senha</button>
        </form>
      </section>

      {workspace && (
        <section className="settings-section">
          <h2>Espaço de trabalho</h2>
          <p>
            Espaço atual: <strong>{workspace.name}</strong>
            ({role === 'owner' ? 'Você é o dono' : 'Você é membro'})
          </p>

          {role === 'owner' && (
            <>
              <form onSubmit={handleUpdateWorkspace} className="settings-form">
                <label>
                  <span>Novo nome do espaço</span>
                  <input
                    type="text"
                    name="workspaceName"
                    defaultValue={workspace.name}
                    required
                    className="settings-input"
                  />
                </label>
                <button type="submit" className="button primary small">Salvar nome</button>
              </form>

              <form onSubmit={handleInvite} className="settings-form">
                <label>
                  <span>Convidar por e-mail</span>
                  <input
                    type="email"
                    name="inviteEmail"
                    placeholder="amigo@email.com"
                    required
                    className="settings-input"
                  />
                </label>
                <button type="submit" className="button primary small">Convidar membro</button>
              </form>

              <button
                type="button"
                className="button danger small"
                onClick={handleDeleteWorkspace}
              >
                <Icon name="trash" size={14} />
                Excluir espaço
              </button>
            </>
          )}

          {pendingInvites.length > 0 && (
            <div className="settings-section">
              <h3>Convites pendentes para você</h3>
              <ul className="invite-list">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="invite-item">
                    <span>
                      Convidado para <strong>{invite.workspace?.name}</strong> por{' '}
                      {invite.inviter?.name || invite.inviter?.email}
                    </span>
                    <button
                      className="button primary small"
                      onClick={() => handleAcceptInvite(invite.id)}
                    >
                      Aceitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="settings-section">
        <h2>Redes sociais</h2>
        <p>Defina seu @ para cada canal (aparece nas prévias de publicação).</p>

        <form onSubmit={handleSaveHandles} className="settings-form handles-form">
          {CHANNELS.map((channel) => {
            const current = userHandles[channel.id] || '';
            return (
              <div key={channel.id} className="handle-row">
                <label style={{ '--channel-color': channel.color }}>
                  <span className="channel-dot" style={{ background: channel.color }} />
                  {channel.name}
                </label>
                <input
                  type="text"
                  name={`handle-${channel.id}`}
                  defaultValue={current}
                  placeholder={`@${channel.name.toLowerCase()}`}
                  className="settings-input"
                />
              </div>
            );
          })}
          <button type="submit" className="button primary small">Salvar handles</button>
        </form>
      </section>
    </div>
  );
}
