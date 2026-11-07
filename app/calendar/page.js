import Link from 'next/link';
import { getStore, getUnifiedStore } from '../../lib/store';
import { CHANNELS, channelById } from '../../lib/channels';
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  monthBounds,
  monthLabel,
  parseMonthParam,
  shiftMonth,
} from '../../lib/dates';
import { Banner } from '../../components/Chrome';
import { Icon } from '../../components/Icons';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Calendário' };

const pad = (value) => String(value).padStart(2, '0');
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default async function CalendarPage({ searchParams }) {
  const params = await searchParams;
  const now = new Date();
  const { year, month } = parseMonthParam(params?.mes, now);
  const { start, end } = monthBounds(year, month);
  const store = await getUnifiedStore();
  const items = await store.listScheduledBetween(start, end);
  const days = buildMonthGrid(year, month, now);

  const itemsByDay = new Map();
  for (const item of items) {
    const day = item.scheduledAt.slice(0, 10);
    if (!itemsByDay.has(day)) itemsByDay.set(day, []);
    itemsByDay.get(day).push(item);
  }

  const previous = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const previousHref = `/calendar?mes=${previous.year}-${pad(previous.month)}`;
  const nextHref = `/calendar?mes=${next.year}-${pad(next.month)}`;
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="page">
      <Banner params={params} />

      <header className="page-header">
        <div className="page-heading">
          <p className="page-context">Calendário editorial</p>
          <h1>Calendário</h1>
          <p className="page-subtitle">
            Uma visão do mês inteiro. Ajuste o ritmo antes que a fila fique
            apertada.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/create" className="button primary">
            <Icon name="plus" size={16} />
            Nova ideia
          </Link>
        </div>
      </header>

      <section className="calendar-panel" aria-label={`Calendário de ${monthLabel(year, month)}`}>
        <div className="calendar-toolbar">
          <div className="month-switcher">
            <Link
              href={previousHref}
              className="icon-button"
              aria-label={`Mês anterior, ${monthLabel(previous.year, previous.month)}`}
            >
              <Icon name="chevron-left" size={18} />
            </Link>
            <div className="month-title">
              <h2>{capitalize(monthLabel(year, month))}</h2>
              <span>
                {items.length}{' '}
                {items.length === 1 ? 'publicação' : 'publicações'}
              </span>
            </div>
            <Link
              href={nextHref}
              className="icon-button"
              aria-label={`Próximo mês, ${monthLabel(next.year, next.month)}`}
            >
              <Icon name="chevron-right" size={18} />
            </Link>
            {!isCurrentMonth ? (
              <Link href="/calendar" className="button quiet small">
                Hoje
              </Link>
            ) : null}
          </div>

          <div className="calendar-legend" aria-label="Canais">
            {CHANNELS.map((channel) => (
              <span key={channel.id} className="legend-item">
                <span
                  className="channel-dot"
                  style={{ '--channel-color': channel.color }}
                  aria-hidden="true"
                />
                {channel.name}
              </span>
            ))}
          </div>

          <p className="calendar-mobile-hint">
            Deslize para o lado para ver a semana completa.
          </p>
        </div>

        <div className="calendar-scroll">
          <div className="calendar-frame">
            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {days.map((day) => {
                const posts = itemsByDay.get(day.date) ?? [];
                return (
                  <div
                    key={day.date}
                    className={[
                      'cal-day',
                      day.inMonth ? '' : 'outside',
                      day.isToday ? 'today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="cal-day-head">
                      <span className="cal-day-number">{day.day}</span>
                      {day.isToday ? <span className="cal-today">hoje</span> : null}
                    </div>

                    <div className="cal-day-items">
                      {posts.slice(0, 2).map((post) => {
                        const channel = channelById(post.channels[0]);
                        return (
                          <Link
                            key={post.id}
                            href={`/publish#post-${post.id}`}
                            className="cal-item"
                            style={{ '--channel-color': channel.color }}
                            title={`${channel.name}: ${post.content}`}
                          >
                            <span className="cal-item-time">
                              {post.scheduledAt.slice(11, 16)} · {channel.name}
                            </span>
                            <span className="cal-item-text">{post.content}</span>
                          </Link>
                        );
                      })}
                      {posts.length > 2 ? (
                        <Link href="/publish" className="cal-more">
                          +{posts.length - 2} na fila
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="calendar-empty-bar">
            <span>
              <Icon name="calendar" size={17} />
              Nenhuma publicação em {monthLabel(year, month)}.
            </span>
            <Link href="/create" className="text-link">
              Começar por uma ideia
              <Icon name="arrow-right" size={15} />
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
