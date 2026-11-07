'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import {
  getProfileAndWorkspace,
  getPendingInvites as getPendingInvitesAction,
  getNotificationsAction,
  markNotificationReadAction,
  signOutAction,
  switchWorkspaceAction,
} from '../app/auth/actions';
import PendingInvites from './PendingInvites';

export default function UserProfileMenu() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('menu'); // 'menu' | 'notifications'
  const [pendingInvites, setPendingInvites] = useState([]);
  const [switching, setSwitching] = useState(false);
  const [menuError, setMenuError] = useState('');
  const menuRef = useRef(null);

  async function loadData() {
    try {
      const info = await getProfileAndWorkspace();
      setData(info);
      const notifs = await getNotificationsAction();
      setNotifications(notifs || []);
      const pending = await getPendingInvitesAction();
      setPendingInvites(pending || []);
    } catch {
      // Modo offline / sem autenticação
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isOpen) setView('menu');
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function handleMarkRead(id) {
    await markNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  async function handleWorkspaceChange(event) {
    const workspaceId = event.target.value;
    setSwitching(true);
    setMenuError('');
    try {
      const result = await switchWorkspaceAction(workspaceId);
      if (!result.ok) {
        setMenuError(result.error || 'Não foi possível trocar de espaço.');
        return;
      }
      await loadData();
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  async function handleInviteChanged() {
    await loadData();
    router.refresh();
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

  const { user, workspace, role, workspaces = [] } = data;
  const displayName = user.name || user.email || 'Sua conta';
  const initial = displayName.charAt(0).toUpperCase();
  const unreadCount =
    notifications.filter((n) => !n.read).length + pendingInvites.length;
  const roleLabel =
    role === 'owner' ? 'Dono' : role === 'admin' ? 'Admin' : 'Membro';
  const notificationCount = notifications.length + pendingInvites.length;
  const hasNotifications = notificationCount > 0;

  return (
    <div className="sidebar-profile-container" ref={menuRef}>
      <button
        type="button"
        className={`sidebar-profile-btn ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Menu de perfil de ${displayName}`}
      >
        <div
          className="profile-avatar"
          style={{ '--avatar-bg': user.avatar_color || '#e11d48' }}
        >
          <span>{initial}</span>
          {unreadCount > 0 && <span className="avatar-badge-dot" />}
        </div>
        <div className="sidebar-profile-info">
          <strong className="sidebar-user-name">{displayName}</strong>
          <span className="sidebar-user-role">
            {workspace?.name || 'Sem espaço criado'}
          </span>
        </div>
        <Icon name="chevron-right" size={14} className="profile-chevron" />
      </button>

      {isOpen && (
        <div
          className="profile-popover"
          role="dialog"
          aria-label="Menu de perfil e notificações"
        >
          {view === 'menu' ? (
            <>
              <div className="popover-header">
                <div className="popover-user">
                  <div
                    className="profile-avatar popover-avatar"
                    style={{ '--avatar-bg': user.avatar_color || '#e11d48' }}
                  >
                    <span>{initial}</span>
                  </div>
                  <div className="popover-user-text">
                    <strong className="popover-name-text">{displayName}</strong>
                    <span className="popover-email-text">{user.email}</span>
                  </div>
                </div>

                {workspace ? (
                  <div className="popover-workspace">
                    {workspaces.length > 1 ? (
                      <select
                        className="popover-workspace-select"
                        value={workspace.id}
                        onChange={handleWorkspaceChange}
                        disabled={switching}
                        aria-label="Escolher espaço de trabalho ativo"
                      >
                        {workspaces.map((item) => (
                          <option
                            key={item.workspace.id}
                            value={item.workspace.id}
                          >
                            {item.workspace.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="popover-workspace-name">
                        {workspace.name}
                      </span>
                    )}
                    <span className={`role-pill role-${role}`}>{roleLabel}</span>
                  </div>
                ) : (
                  <div className="popover-workspace is-empty">
                    <span>Nenhum espaço ainda.</span>
                    <Link
                      href="/configuracoes#espaco"
                      className="popover-inline-link"
                      onClick={() => setIsOpen(false)}
                    >
                      Criar espaço
                    </Link>
                  </div>
                )}
                {menuError && (
                  <p className="popover-inline-error" role="alert">
                    {menuError}
                  </p>
                )}
              </div>

              <div className="popover-menu">
                <button
                  type="button"
                  className="popover-menu-item"
                  onClick={() => setView('notifications')}
                >
                  <span className="popover-menu-icon">
                    <Icon name="bell" size={16} />
                  </span>
                  <span className="popover-menu-copy">
                    <strong>Notificações</strong>
                    <span>
                      {hasNotifications
                        ? `${notificationCount} ${
                            notificationCount === 1
                              ? 'atualização'
                              : 'atualizações'
                          }`
                        : 'Tudo em dia'}
                    </span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="tab-pill">{unreadCount}</span>
                  )}
                  <Icon
                    name="chevron-right"
                    size={14}
                    className="popover-menu-chevron"
                  />
                </button>

                <Link
                  href="/configuracoes"
                  className="popover-menu-item"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="popover-menu-icon">
                    <Icon name="gear" size={16} />
                  </span>
                  <span className="popover-menu-copy">
                    <strong>Configurações</strong>
                    <span>Conta, espaço e canais</span>
                  </span>
                  <Icon
                    name="chevron-right"
                    size={14}
                    className="popover-menu-chevron"
                  />
                </Link>
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
            </>
          ) : (
            <>
              <div className="popover-subhead">
                <button
                  type="button"
                  className="popover-back"
                  onClick={() => setView('menu')}
                  aria-label="Voltar ao menu de perfil"
                >
                  <Icon name="chevron-left" size={15} />
                  Voltar
                </button>
                <strong>Notificações</strong>
              </div>

              <div className="popover-body">
                {notifications.length === 0 && pendingInvites.length === 0 ? (
                  <div className="notifications-empty">
                    <span className="notifications-empty-icon">
                      <Icon name="bell" size={20} />
                    </span>
                    <p>Nenhuma notificação por enquanto.</p>
                    <span>Convites e novidades do espaço aparecem aqui.</span>
                  </div>
                ) : (
                  <>
                    {pendingInvites.length > 0 && (
                      <PendingInvites
                        initialInvites={pendingInvites}
                        onChanged={handleInviteChanged}
                      />
                    )}

                    {notifications.length > 0 && (
                      <ul className="notifications-list">
                        {notifications.map((n) => (
                          <li
                            key={n.id}
                            className={`notification-item ${
                              n.read ? 'is-read' : 'is-unread'
                            }`}
                            onClick={() => !n.read && handleMarkRead(n.id)}
                          >
                            <div className="notif-head">
                              <strong className="notif-title">{n.title}</strong>
                              {!n.read && <span className="notif-dot" />}
                            </div>
                            <p className="notif-msg">{n.message}</p>
                            <span className="notif-time">
                              {new Date(n.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
