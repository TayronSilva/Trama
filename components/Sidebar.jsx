'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CHANNELS, DEFAULT_HANDLES, formatHandle } from '../lib/channels';
import { BrandMark, Icon } from './Icons';
import UserProfileMenu from './UserProfileMenu';

const NAV = [
  { href: '/create', label: 'Criar', hint: 'Ideias', icon: 'pen' },
  { href: '/publish', label: 'Publicar', hint: 'Fila', icon: 'send' },
  { href: '/calendar', label: 'Calendário', hint: 'Ritmo', icon: 'calendar' },
];

const STORAGE_KEY = 'trama_channel_handles';

export default function Sidebar() {
  const pathname = usePathname();
  const [handles, setHandles] = useState(DEFAULT_HANDLES);
  const [editingChannel, setEditingChannel] = useState(null);
  const [tempValue, setTempValue] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const cleaned = {};
          for (const [k, v] of Object.entries(parsed)) {
            cleaned[k] = formatHandle(k, v);
          }
          setHandles((prev) => ({ ...prev, ...cleaned }));
        }
      }
    } catch {
      // Local storage indisponível
    }
  }, []);

  function startEditing(channelId, currentHandle) {
    setEditingChannel(channelId);
    setTempValue(currentHandle);
  }

  function saveHandle(channelId) {
    const formatted = formatHandle(channelId, tempValue);
    const next = { ...handles, [channelId]: formatted };
    setHandles(next);
    setEditingChannel(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Falha de escrita no localStorage ignorada
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
          <span className="sidebar-badge-simulated" title="Canais simulados para cálculo de limites e formato">
            Simulados
          </span>
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
                      onBlur={() => saveHandle(channel.id)}
                      onKeyDown={(e) => handleKeyDown(e, channel.id)}
                      maxLength={32}
                      autoFocus
                      aria-label={`Editar handle de ${channel.name}`}
                    />
                    <button
                      type="button"
                      className="sidebar-handle-btn-save"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        saveHandle(channel.id);
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
