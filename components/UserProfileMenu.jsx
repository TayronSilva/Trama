'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import {
  getProfileAndWorkspace,
  inviteMemberAction,
  getNotificationsAction,
  markNotificationReadAction,
  signOutAction,
} from '../app/auth/actions';

export default function UserProfileMenu() {
  const [data, setData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'team' | 'notifications'
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const info = await getProfileAndWorkspace();
        setData(info);
        const notifs = await getNotificationsAction();
        setNotifications(notifs || []);
      } catch {
        // Modo offline / sem autenticação
      }
    }
    load();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function handleSendInvite(e) {
    e.preventDefault();
    if (!inviteEmail) return;
    setLoadingInvite(true);
    setInviteStatus(null);
    try {
      const res = await inviteMemberAction({ email: inviteEmail });
      if (res?.error) {
        setInviteStatus({ type: 'error', text: res.error });
      } else {
        setInviteStatus({ type: 'success', text: res.message });
        setInviteEmail('');
      }
    } catch {
      setInviteStatus({ type: 'error', text: 'Falha ao enviar convite.' });
    } finally {
      setLoadingInvite(false);
    }
  }

  async function handleMarkRead(id) {
    await markNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  if (!data || !data.user) {
    return (
      <div className="sidebar-profile-guest">
        <a href="/login" className="sidebar-login-link">
          <span className="profile-avatar guest-avatar">
            <Icon name="pen" size={14} />
          </span>
          <span className="sidebar-profile-info">
            <strong className="sidebar-user-name">Entrar / Conectar</strong>
            <span className="sidebar-user-role">Sincronizar equipe</span>
          </span>
        </a>
      </div>
    );
  }

  const { user, workspace, role, teamMembers } = data;
  const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="sidebar-profile-container" ref={menuRef}>
      <button
        type="button"
        className={`sidebar-profile-btn ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Menu de perfil de ${user.name}`}
      >
        <div
          className="profile-avatar"
          style={{ '--avatar-bg': user.avatar_color || '#e11d48' }}
        >
          <span>{initial}</span>
          {unreadCount > 0 && <span className="avatar-badge-dot" />}
        </div>
        <div className="sidebar-profile-info">
          <strong className="sidebar-user-name">{user.name}</strong>
          <span className="sidebar-user-role">
            {workspace?.name || 'Meu Espaço'} · {role === 'owner' ? 'Dono' : 'Membro'}
          </span>
        </div>
        <Icon name="chevron-right" size={14} className="profile-chevron" />
      </button>

      {isOpen && (
        <div className="profile-popover" role="dialog" aria-label="Opções da equipe e perfil">
          <div className="popover-header">
            <div className="popover-user">
              <div
                className="profile-avatar popover-avatar"
                style={{ '--avatar-bg': user.avatar_color || '#e11d48' }}
              >
                <span>{initial}</span>
              </div>
              <div className="popover-user-text">
                <strong>{user.name}</strong>
                <span className="popover-email">{user.email}</span>
              </div>
            </div>
          </div>

          <div className="popover-nav-tabs">
            <button
              type="button"
              className={`popover-tab ${activeTab === 'menu' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('menu')}
            >
              Equipe
            </button>
            <button
              type="button"
              className={`popover-tab ${activeTab === 'notifications' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              Notificações
              {unreadCount > 0 && <span className="tab-pill">{unreadCount}</span>}
            </button>
          </div>

          <div className="popover-body">
            {activeTab === 'menu' && (
              <div className="popover-team-section">
                <div className="popover-section-label">
                  <span>Membros ({teamMembers.length || 1})</span>
                  <span className="workspace-badge">{workspace?.name || 'Workspace'}</span>
                </div>

                <ul className="popover-members-list">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((m) => (
                      <li key={m.user?.id || m.role} className="member-item">
                        <span
                          className="member-dot"
                          style={{ background: m.user?.avatar_color || '#0a66c2' }}
                        />
                        <span className="member-name">
                          {m.user?.name || m.user?.email}
                          {m.user?.id === user.id && ' (você)'}
                        </span>
                        <span className="member-role">
                          {m.role === 'owner' ? 'Dono' : m.role === 'admin' ? 'Admin' : 'Membro'}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="member-item">
                      <span className="member-dot" style={{ background: user.avatar_color }} />
                      <span className="member-name">{user.name} (você)</span>
                      <span className="member-role">Dono</span>
                    </li>
                  )}
                </ul>

                <form onSubmit={handleSendInvite} className="invite-form">
                  <div className="popover-section-label">
                    <span>Convidar por e-mail</span>
                  </div>
                  <div className="invite-input-row">
                    <input
                      type="email"
                      required
                      placeholder="amigo@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="invite-input"
                    />
                    <button
                      type="submit"
                      disabled={loadingInvite}
                      className="invite-submit-btn"
                    >
                      {loadingInvite ? '...' : 'Convidar'}
                    </button>
                  </div>
                  {inviteStatus && (
                    <span className={`invite-msg is-${inviteStatus.type}`}>
                      {inviteStatus.text}
                    </span>
                  )}
                </form>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="popover-notifications-section">
                {notifications.length === 0 ? (
                  <div className="notifications-empty">
                    <p>Nenhuma notificação por enquanto.</p>
                  </div>
                ) : (
                  <ul className="notifications-list">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className={`notification-item ${n.read ? 'is-read' : 'is-unread'}`}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                      >
                        <div className="notif-head">
                          <strong className="notif-title">{n.title}</strong>
                          {!n.read && <span className="notif-dot" />}
                        </div>
                        <p className="notif-msg">{n.message}</p>
                        <span className="notif-time">
                          {new Date(n.created_at).toLocaleDateString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="popover-footer">
            <button
              type="button"
              className="popover-logout-btn"
              onClick={() => signOutAction()}
            >
              <Icon name="arrow-right" size={14} />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

