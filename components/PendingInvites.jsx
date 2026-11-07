'use client';

import { useEffect, useState } from 'react';
import {
  acceptInvite as acceptInviteAction,
  declineInvite as declineInviteAction,
} from '../app/auth/actions';
import { Icon } from './Icons';

export default function PendingInvites({ initialInvites = [], onChanged }) {
  const [invites, setInvites] = useState(initialInvites);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

  async function handleAction(id, action) {
    setBusy(`${action}-${id}`);
    setFeedback(null);
    try {
      const result =
        action === 'accept'
          ? await acceptInviteAction(id)
          : await declineInviteAction(id);

      if (result.ok) {
        setInvites((current) => current.filter((invite) => invite.id !== id));
        setFeedback({
          type: 'success',
          text:
            action === 'accept'
              ? `Você entrou em ${result.workspace_name || 'o espaço'}.`
              : 'Convite recusado.',
        });
        onChanged?.(action, result);
      } else {
        setFeedback({
          type: 'error',
          text: result.error || 'Não foi possível responder ao convite.',
        });
      }
    } finally {
      setBusy('');
    }
  }

  if (invites.length === 0 && !feedback) return null;

  return (
    <section className="pending-invites" aria-label="Convites pendentes">
      <h3 className="pending-title">Convites de equipe pendentes</h3>
      {invites.length > 0 && (
        <ul className="pending-list">
          {invites.map((invite) => (
            <li key={invite.id} className="pending-item">
              <div className="pending-info">
                <span className="pending-workspace">
                  {invite.workspace?.name || 'Espaço de trabalho'}
                </span>
                <span className="pending-inviter">
                  Convidado por{' '}
                  {invite.inviter?.name ||
                    invite.inviter?.email ||
                    'um membro'}
                </span>
              </div>
              <div className="pending-actions">
                <button
                  className="button primary small"
                  onClick={() => handleAction(invite.id, 'accept')}
                  disabled={busy === `accept-${invite.id}` || busy === `decline-${invite.id}`}
                >
                  <Icon name="check" size={14} />
                  {busy === `accept-${invite.id}` ? 'Aceitando…' : 'Aceitar'}
                </button>
                <button
                  className="button secondary small"
                  onClick={() => handleAction(invite.id, 'decline')}
                  disabled={busy === `accept-${invite.id}` || busy === `decline-${invite.id}`}
                >
                  <Icon name="x" size={14} />
                  {busy === `decline-${invite.id}` ? 'Recusando…' : 'Recusar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {feedback && (
        <p
          className={`pending-feedback ${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
