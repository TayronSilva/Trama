import Link from 'next/link';
import {
  scheduleIdeaAction,
  createIdeaAction,
  unscheduleIdeaAction,
} from '../actions';
import { getStore } from '../../lib/store';
import { channelById } from '../../lib/channels';
import {
  formatDateShort,
  formatDateTime,
  formatLongDate,
  toInputValue,
  tomorrowAt,
} from '../../lib/dates';
import { Banner, ChannelChip } from '../../components/Chrome';
import { Composer } from '../../components/Composer';
import { Icon } from '../../components/Icons';
import { PostTools } from '../../components/PostTools';
import { TagChips, TagFilter } from '../../components/Tags';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Criar' };

const STATUS_LABELS = {
  idea: 'Ideia',
  scheduled: 'Agendado',
  published: 'Publicado',
};

function ScheduleForm({ idea, defaultValue }) {
  return (
    <form action={scheduleIdeaAction} className="schedule-form">
      <input type="hidden" name="id" value={idea.id} />
      <div className="schedule-fields">
        <label className="field">
          <span>Data e hora</span>
          <input
            type="datetime-local"
            name="scheduledAt"
            defaultValue={defaultValue}
            min={toInputValue(new Date())}
            required
          />
        </label>
      </div>
      <div className="schedule-actions">
        <p>Horário local. Este canal será agendado sozinho.</p>
        <button type="submit" className="button primary small">
          <Icon name="check" size={15} />
          Confirmar agendamento
        </button>
      </div>
    </form>
  );
}

function IdeaRow({ idea, defaultWhen }) {
  const scheduled = idea.status === 'scheduled';

  return (
    <li id={`ideia-${idea.id}`} className="idea-row">
      <span className={`status-rail ${idea.status}`} aria-hidden="true" />
      <div className="idea-body">
        <div className="idea-top">
          <p className="idea-copy">{idea.content}</p>
          <span className={`status-badge ${idea.status}`}>
            <span className="status-pill-dot" aria-hidden="true" />
            {STATUS_LABELS[idea.status]}
          </span>
        </div>

        <TagChips tags={idea.tags} hrefBase="/create" />

        <div className="idea-meta">
          <div className="channel-row">
            {idea.channels.map((channel) => (
              <ChannelChip key={channel} id={channel} />
            ))}
          </div>
          {scheduled ? (
            <span className="schedule-when">
              <Icon name="calendar" size={14} />
              {formatDateTime(idea.scheduledAt)}
            </span>
          ) : null}
        </div>

        <div className="idea-actions">
          <details className="schedule-details">
            <summary className="button ghost small">
              <Icon name="calendar" size={15} />
              {scheduled ? 'Reagendar' : 'Agendar'}
            </summary>
            <ScheduleForm
              idea={idea}
              defaultValue={scheduled ? idea.scheduledAt : defaultWhen}
            />
          </details>

          {scheduled ? (
            <form action={unscheduleIdeaAction} className="inline-form">
              <input type="hidden" name="id" value={idea.id} />
              <button type="submit" className="button quiet small">
                Voltar para ideias
              </button>
            </form>
          ) : null}

          <PostTools post={idea} from="create" />
        </div>
      </div>
    </li>
  );
}

export default async function CreatePage({ searchParams }) {
  const params = await searchParams;
  const store = getStore();
  const counts = store.counts();
  const allIdeas = store
    .listIdeas()
    .filter((idea) => idea.status !== 'published');
  const availableTags = [
    ...new Set(allIdeas.flatMap((idea) => idea.tags)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const activeTag = typeof params?.tag === 'string' ? params.tag : '';
  const ideas = activeTag
    ? allIdeas.filter((idea) => idea.tags.includes(activeTag))
    : allIdeas;
  const scheduled = store.listScheduled();
  const defaultWhen = tomorrowAt(9, 30);
  const today = formatLongDate(toInputValue(new Date()).slice(0, 10));

  return (
    <div className="page">
      <Banner params={params} />

      <header className="page-header">
        <div className="page-heading">
          <p className="page-context">{today}</p>
          <h1>Sua biblioteca de ideias</h1>
          <p className="page-subtitle">
            Anote o que ainda está solto. Escolha os canais e agende cada
            publicação de forma independente.
          </p>
        </div>
        <div className="header-stats" aria-label="Resumo da biblioteca">
          <div className="header-stat">
            <strong>{counts.ideas}</strong>
            <span>na biblioteca</span>
          </div>
          <div className="header-stat">
            <strong>{counts.scheduled}</strong>
            <span>na fila</span>
          </div>
        </div>
      </header>

      <div className="create-grid">
        <div className="create-main">
          <section className="composer" aria-labelledby="composer-title">
            <div className="composer-top">
              <div>
                <span className="kicker">
                  <Icon name="pen" size={15} />
                  Nova ideia
                </span>
                <h2 id="composer-title">O que vale registrar hoje?</h2>
              </div>
              <span className="draft-label">Rascunho</span>
            </div>

            <Composer action={createIdeaAction} />
          </section>

          <section className="library" aria-labelledby="library-title">
            <div className="section-head">
              <div>
                <span className="kicker">
                  <Icon name="layers" size={15} />
                  Biblioteca
                </span>
                <h2 id="library-title">Tudo que ainda pode virar post</h2>
              </div>
              <span className="section-count">
                {ideas.length} {ideas.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            <TagFilter
              tags={availableTags}
              activeTag={activeTag}
              basePath="/create"
            />

            {ideas.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name="layers" size={24} />
                </span>
                <div>
                  <h3>
                    {activeTag
                      ? `Nenhum item com a tag “${activeTag}”.`
                      : 'A biblioteca está vazia.'}
                  </h3>
                  <p>
                    {activeTag
                      ? 'Limpe o filtro para ver tudo que está aberto.'
                      : 'Comece pela ideia acima. O resto pode esperar.'}
                  </p>
                </div>
                {activeTag ? (
                  <Link href="/create" className="button secondary small">
                    Limpar filtro
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="idea-list">
                {ideas.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} defaultWhen={defaultWhen} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="rail" aria-label="Próximas publicações">
          <section className="queue-card">
            <div className="queue-card-head">
              <span className="kicker">
                <Icon name="clock" size={15} />
                Na fila
              </span>
              <h2>Próximas publicações</h2>
            </div>

            {scheduled.length === 0 ? (
              <p className="rail-empty">
                Nada agendado ainda. Use “Agendar” em uma das ideias.
              </p>
            ) : (
              <ul className="mini-queue">
                {scheduled.slice(0, 4).map((idea) => {
                  const [day, month] = formatDateShort(idea.scheduledAt).split(' ');
                  return (
                    <li key={idea.id}>
                      <Link
                        href={`/publish#post-${idea.id}`}
                        className="mini-queue-item"
                      >
                        <span className="date-badge" aria-hidden="true">
                          <strong>{day}</strong>
                          <span>{month}</span>
                        </span>
                        <span className="mini-queue-copy">
                          <strong>{idea.content}</strong>
                          <span>
                            {idea.scheduledAt.slice(11, 16)},{' '}
                            {channelById(idea.channels[0]).name}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link href="/calendar" className="rail-link">
              Abrir calendário
              <Icon name="arrow-right" size={16} />
            </Link>
          </section>

          <div className="demo-note">
            <span className="env-dot" aria-hidden="true" />
            <div>
              <strong>Canais simulados</strong>
              <p>
                O Trama calcula limites e adapta formato para cada rede.
                A conexão com APIs oficiais de publicação está em desenvolvimento.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
