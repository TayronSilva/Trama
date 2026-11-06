import Link from 'next/link';
import {
  publishIdeaAction,
  unscheduleIdeaAction,
} from '../actions';
import { getStore } from '../../lib/store';
import {
  formatLongDate,
  toInputValue,
} from '../../lib/dates';
import { Banner, ChannelChip } from '../../components/Chrome';
import { Icon } from '../../components/Icons';
import { PostTools } from '../../components/PostTools';
import { TagChips, TagFilter } from '../../components/Tags';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Publicar' };

function groupByDay(posts) {
  const groups = new Map();
  for (const post of posts) {
    const day = post.scheduledAt.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(post);
  }
  return [...groups.entries()];
}

export default async function PublishPage({ searchParams }) {
  const params = await searchParams;
  const store = getStore();
  const counts = store.counts();
  const allScheduled = store.listScheduled();
  const availableTags = [
    ...new Set(allScheduled.flatMap((post) => post.tags)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const activeTag = typeof params?.tag === 'string' ? params.tag : '';
  const scheduled = activeTag
    ? allScheduled.filter((post) => post.tags.includes(activeTag))
    : allScheduled;
  const groups = groupByDay(scheduled);
  const today = formatLongDate(toInputValue(new Date()).slice(0, 10));

  return (
    <div className="page">
      <Banner params={params} />

      <header className="page-header">
        <div className="page-heading">
          <p className="page-context">{today}</p>
          <h1>Fila de publicação</h1>
          <p className="page-subtitle">
            Tudo que já tem data e canal. Cada canal é uma publicação
            independente.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/calendar" className="button secondary">
            <Icon name="calendar" size={17} />
            Calendário
          </Link>
          <Link href="/create" className="button primary">
            <Icon name="plus" size={16} />
            Nova ideia
          </Link>
        </div>
      </header>

      <section className="stat-strip" aria-label="Resumo das publicações">
        <div className="stat">
          <strong>{counts.scheduled}</strong>
          <span>agendadas</span>
        </div>
        <div className="stat">
          <strong>{counts.ideas}</strong>
          <span>ideias em aberto</span>
        </div>
        <div className="stat">
          <strong>{counts.published}</strong>
          <span>publicadas</span>
        </div>
      </section>

      <TagFilter
        tags={availableTags}
        activeTag={activeTag}
        basePath="/publish"
      />

      {scheduled.length === 0 ? (
        <div className="empty-state queue-empty">
          <span className="empty-icon">
            <Icon name="send" size={25} />
          </span>
          <div>
            <h3>
              {activeTag
                ? `Nenhuma publicação com a tag “${activeTag}”.`
                : 'A fila está livre.'}
            </h3>
            <p>
              {activeTag
                ? 'Limpe o filtro para ver a fila completa.'
                : 'Escolha uma ideia da biblioteca e defina data, hora e canal.'}
            </p>
          </div>
          <Link
            href={activeTag ? '/publish' : '/create'}
            className="button primary"
          >
            {activeTag ? 'Limpar filtro' : 'Ir para a biblioteca'}
          </Link>
        </div>
      ) : (
        <div className="queue-groups">
          {groups.map(([day, posts]) => (
            <section className="queue-group" key={day} aria-labelledby={`dia-${day}`}>
              <div className="queue-date">
                <h2 id={`dia-${day}`}>{formatLongDate(day)}</h2>
                <span>
                  {posts.length} {posts.length === 1 ? 'publicação' : 'publicações'}
                </span>
              </div>

              <ul className="queue-list">
                {posts.map((post) => (
                  <li className="queue-item" id={`post-${post.id}`} key={post.id}>
                    <div className="queue-time">
                      <Icon name="clock" size={15} />
                      <strong>{post.scheduledAt.slice(11, 16)}</strong>
                    </div>

                    <div className="queue-body">
                      <p>{post.content}</p>
                      <div className="channel-row">
                        {post.channels.map((channel) => (
                          <ChannelChip key={channel} id={channel} />
                        ))}
                      </div>
                      <TagChips tags={post.tags} hrefBase="/publish" />
                    </div>

                    <div className="queue-actions">
                      <form action={publishIdeaAction} className="inline-form">
                        <input type="hidden" name="id" value={post.id} />
                        <button type="submit" className="button secondary small">
                          <Icon name="check" size={15} />
                          Publicar agora
                        </button>
                      </form>
                      <form action={unscheduleIdeaAction} className="inline-form">
                        <input type="hidden" name="id" value={post.id} />
                        <input type="hidden" name="from" value="publish" />
                        <button type="submit" className="button quiet small">
                          Remover da fila
                        </button>
                      </form>
                    </div>

                    <div className="queue-tools">
                      <PostTools post={post} from="publish" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
