'use client';

import { useEffect, useState } from 'react';
import { getWorkspaceActivityAction } from '../app/actions';
import { Icon } from './Icons';

const ACTION_LABELS = {
  create: 'Criou',
  update: 'Alterou',
  delete: 'Excluiu',
  duplicate: 'Duplicou',
  schedule: 'Agendou',
  unschedule: 'Removeu do agendamento',
  publish: 'Publicou',
};

const ACTION_TARGETS = {
  idea: 'publicação',
};

function actionIcon(action) {
  switch (action) {
    case 'create':
      return <Icon name="plus" size={16} />;
    case 'update':
      return <Icon name="pen" size={16} />;
    case 'delete':
      return <Icon name="trash" size={16} />;
    case 'duplicate':
      return <Icon name="copy" size={16} />;
    case 'schedule':
      return <Icon name="calendar" size={16} />;
    case 'unschedule':
      return <Icon name="clock" size={16} />;
    case 'publish':
      return <Icon name="send" size={16} />;
    default:
      return <Icon name="spark" size={16} />;
  }
}

function formatDateTimeBR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkspaceActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkspaceActivityAction()
      .then((data) => setActivities(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <section className="settings-card activity-card" aria-label="Historico de atividades">
      <header className="settings-card-head">
        <span className="settings-card-icon" aria-hidden="true">
          <Icon name="clock" size={18} />
        </span>
        <div className="settings-card-heading">
          <h2>Historico de atividades</h2>
          <p>
            Acoes recentes nas suas publicacoes (criar, alterar, excluir,
            agendar e publicar).
          </p>
        </div>
      </header>

      <div className="settings-card-body">
        {activities.length === 0 ? (
          <div className="settings-empty" style={{ padding: '26px 0' }}>
            <span className="settings-empty-icon" aria-hidden="true">
              <Icon name="clock" size={22} />
            </span>
            <h3>Sem atividade recente</h3>
            <p>
              As alteracoes nas suas publicacoes aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="activity-list">
            {activities.map((activity) => (
              <li key={activity.id} className="activity-item">
                <div className="activity-action">
                  {actionIcon(activity.action)}
                  <span>
                    <strong>{ACTION_LABELS[activity.action] || activity.action}</strong>{' '}
                    {ACTION_TARGETS[activity.targetType] || activity.targetType}
                  </span>
                  {activity.targetTitle && (
                    <span className="activity-title">
                      “{activity.targetTitle}”
                    </span>
                  )}
                </div>
                <span className="activity-time">
                  {formatDateTimeBR(activity.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
