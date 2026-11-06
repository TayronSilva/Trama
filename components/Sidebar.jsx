'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CHANNELS, DEFAULT_HANDLES, formatHandle } from '../lib/channels';
import { BrandMark, Icon } from './Icons';
import UserProfileMenu from './UserProfileMenu';
import {
  getUserChannelHandles,
  saveUserChannelHandle,
} from '../app/auth/actions';

const NAV = [
  { href: '/create', label: 'Criar', hint: 'Ideias', icon: 'pen' },
  { href: '/publish', label: 'Publicar', hint: 'Fila', icon: 'send' },
  { href: '/calendar', label: 'Calendário', hint: 'Ritmo', icon: 'calendar' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [handles, setHandles] = useState({});
  const [editingChannel, setEditingChannel] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [loading, setLoading] = useState(true);

  const loadHandles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUserChannelHandles();
      if (res.ok && res.handles) {
        const cleaned = {};
        for (const [k, v] of Object.entries(res.handles)) {
          cleaned[k] = formatHandle(k, v);
        }
        setHandles(cleaned);
      }
    } catch {
      // Falha ao carregar handles do servidor
    } finally {
      setLoading(false);
    }
  }, [loadHandles]);

  useEffect(() => {
    loadHandles();
  }, [loadHandles]);

  function startEditing(channelId, currentHandle) {
    setEditingChannel(channelId);
    setTempValue(currentHandle);
  }

  async function saveHandle(channelId) {
    const formatted = formatHandle(channelId, tempValue);
    const next = { ...handles, [channelId]: formatted };
    setHandles(next);
    setEditingChannel(null);
    try {
      await saveUserChannelHandle({ channelId: channelId, handle: tempValue });
    } catch {
      // Falha de escrita no servidor ignorada
    }
  }

  function handleKeyDown(e, channelId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveHandle(channelId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingChannel(null);
    }
  }

  if (loading) {
    return (
      <aside className="sidebar">
        <Link href="/create" className="brand" aria-label="Trama, ir para a biblioteca">
          <BrandMark />
          <span className="brand-copy">
            <span className="brand-name">trama</span>
            <span className="brand-subtitle">estúdio de conteúdo</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Navegação principal">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                <span className="nav-hint">{item.hint}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-section-head">
            <span>Canais de planejamento</span>
          </div>
          <p className="sidebar-section-hint">
            Defina o @ para testar limite e tom. Publicação direta em breve.
          </p>
          <ul className="channel-list">
            {CHANNELS.map((channel) => (
              <li key={channel.id} className="channel-item">
                <span
                  className="channel-dot"
                  style={{ '--channel-color': channel.color }}
                  aria-hidden="true"
                />
                <span className="sidebar-channel-name">{channel.name}</span>
                <span className="sidebar-handle">…</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-footer">
          <UserProfileMenu />
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <Link href="/create" className="brand" aria-label="Trama, ir para a biblioteca">
        <BrandMark />
        <span className="brand-copy">
          <span className="brand-name">trama</span>
          <span className="brand-subtitle">estúdio de conteúdo</span>
        </span>
      </Link>

      <nav className="nav" aria-label="Navegação principal">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              <span className="nav-hint">{item.hint}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span>Canais de planejamento</span>
        </div>
        <p className="sidebar-section-hint">
          Defina o @ para testar limite e tom. Publicação direta em breve.
        </p>

        <ul className="channel-list">
          {CHANNELS.map((channel) => {
            const isEditing = editingChannel === channel.id;
            const currentHandle = handles[channel.id] ?? DEFAULT_HANDLES[channel.id];

            return (
              <li
                key={channel.id}
                className={`channel-item ${isEditing ? 'is-editing' : ''}`}
              >
                <span
                  className="channel-dot"
                  style={{ '--channel-color': channel.color }}
                  aria-hidden="true"
                />
                <span className="sidebar-channel-name">{channel.name}</span>

                {isEditing ? (
                  <div className="sidebar-handle-edit-wrap">
                    <input
                      type="text"
                      className="sidebar-handle-input"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onBlur={() => saveHandle(channelId)}
                      onKeyDown={(e) => handleKeyDown(e, channelId)}
                      maxLength={32}
                      autoFocus
                      aria-label={`Editar handle de ${channel.name}`}
                    />
                    <button
                      type="button"
                      className="sidebar-handle-btn-save"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveHandle(channelId);
                      }}
                      title="Salvar"
                      aria-label="Salvar"
                    >
                      <Icon name="check" size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="sidebar-handle-btn"
                    onClick={() => startEditing(channel.id, currentHandle)}
                    title={`Clique para editar @ de ${channel.name}`}
                    aria-label={`Editar @ de ${channel.name}, atualmente ${currentHandle}`}
                  >
                    <span className="sidebar-handle">{currentHandle}</span>
                    <span className="sidebar-handle-pencil" aria-hidden="true">
                      <Icon name="pen" size={11} />
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-footer">
        <UserProfileMenu />
      </div>
    </aside>
  );
}
