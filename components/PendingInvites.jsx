'use client';

import { useEffect, useState } from 'react';
import { acceptInvite as acceptInviteAction } from '../app/auth/actions';
import { Icon } from './Icons';

export default function PendingInvites({ initialInvites = [] }) {
  const [invites, setInvites] = useState(initialInvites);

  async function handleAccept(id) {
    const result = await acceptInviteAction(id);
    if (result.ok) {
      setInvites((current) => current.filter((i) => i.id !== id));
    } else {
      alert(result.error || 'Erro ao aceitar convite.');
    }
  }

  if (invites.length === 0) return null;

  return (
    <section className="pending-invites" aria-label="Convites pendentes">
      <h3 className="pending-title">Convites de equipe pendentes</h3>
      <ul className="pending-list">
        {invites.map((invite) => (
          <li key={invite.id} className="pending-item">
            <div className="pending-info">
              <span className="pending-workspace">
                {invite.workspace?.name || 'Espaço de trabalho'}
              </span>
              <span className="pending-inviter">
                Convidado por{' '}
                {invite.inviter?.name || invite.inviter?.email || 'um membro'}
              </span>
            </div>
            <button
              className="button primary small"
              onClick={() => handleAccept(invite.id)}
            >
              <Icon name="check" size={14} />
              Aceitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
