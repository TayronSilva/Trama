'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CHANNELS } from '../lib/channels';
import { BrandMark, Icon } from './Icons';

const NAV = [
  { href: '/create', label: 'Criar', hint: 'Ideias', icon: 'pen' },
  { href: '/publish', label: 'Publicar', hint: 'Fila', icon: 'send' },
  { href: '/calendar', label: 'Calendário', hint: 'Ritmo', icon: 'calendar' },
];

const HANDLES = {
  instagram: '@trama.studio',
  linkedin: 'trama-studio',
  x: '@trama',
  tiktok: '@trama.studio',
};

export default function Sidebar() {
  const pathname = usePathname();

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
          <span>Canais conectados</span>
          <span className="sidebar-count">{CHANNELS.length}</span>
        </div>
        <ul className="channel-list">
          {CHANNELS.map((channel) => (
            <li key={channel.id}>
              <span
                className="channel-dot"
                style={{ '--channel-color': channel.color }}
                aria-hidden="true"
              />
              <span className="sidebar-channel-name">{channel.name}</span>
              <span className="sidebar-handle">{HANDLES[channel.id]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-footer">
        <span className="env-dot" aria-hidden="true" />
        <div>
          <strong>Ambiente local</strong>
          <p>Canais simulados. Nada é publicado de verdade.</p>
        </div>
      </div>
    </aside>
  );
}
