import Link from 'next/link';
import { CHANNELS, channelById } from '../lib/channels';
import { Icon } from './Icons';

export function ChannelChip({ id }) {
  const channel = channelById(id);
  return (
    <span className="channel-chip">
      <span
        className="channel-dot"
        style={{ '--channel-color': channel.color }}
        aria-hidden="true"
      />
      {channel.name}
    </span>
  );
}

export function ChannelOptions({ selected = [], onChange }) {
  return (
    <div className="channel-options">
      {CHANNELS.map((channel) => {
        const checked = selected.includes(channel.id);
        return (
          <label className="channel-option" key={channel.id}>
            <input
              type="checkbox"
              name="channels"
              value={channel.id}
              checked={onChange ? checked : undefined}
              defaultChecked={onChange ? undefined : checked}
              onChange={
                onChange
                  ? (event) => onChange(channel.id, event.target.checked)
                  : undefined
              }
            />
            <span className="channel-option-face">
              <span
                className="channel-dot"
                style={{ '--channel-color': channel.color }}
                aria-hidden="true"
              />
              {channel.name}
              <Icon name="check" size={12} className="option-check" />
            </span>
          </label>
        );
      })}
    </div>
  );
}

const MESSAGES = {
  criada: {
    tone: 'success',
    title: 'Ideias salvas na biblioteca.',
    text: 'Cada canal escolhido virou um registro independente.',
  },
  agendado: {
    tone: 'success',
    title: 'Publicação agendada.',
    text: 'O item já aparece na fila e no calendário.',
    action: 'Abrir calendário',
  },
  publicado: {
    tone: 'success',
    title: 'Publicação concluída.',
    text: 'O canal é simulado, mas o fluxo foi registrado.',
  },
  removido: {
    tone: 'neutral',
    title: 'Publicação devolvida para a biblioteca.',
    text: 'Você pode reagendar quando quiser.',
  },
  editada: {
    tone: 'success',
    title: 'Publicação atualizada.',
    text: 'O texto e as tags foram salvos. O agendamento continua igual.',
  },
  excluida: {
    tone: 'neutral',
    title: 'Publicação excluída.',
    text: 'O item saiu da biblioteca, da fila e do calendário.',
  },
  duplicada: {
    tone: 'success',
    title: 'Ideia duplicada.',
    text: 'A cópia entrou no topo da biblioteca sem data marcada.',
  },
};

export function Banner({ params }) {
  if (params?.erro) {
    return (
      <div className="banner error" role="alert">
        <Icon name="alert" size={19} />
        <div>
          <strong>Não foi possível concluir.</strong>
          <p>{params.erro}</p>
        </div>
      </div>
    );
  }

  const message = MESSAGES[params?.ok];
  if (!message) return null;

  const month = params?.data ? `?mes=${String(params.data).slice(0, 7)}` : '';
  const href = message.action === 'Abrir calendário' ? `/calendar${month}` : null;

  return (
    <div className={`banner ${message.tone}`} role="status">
      <Icon name={message.tone === 'success' ? 'check' : 'arrow-right'} size={19} />
      <div>
        <strong>{message.title}</strong>
        <p>{message.text}</p>
      </div>
      {href ? (
        <Link href={href} className="banner-link">
          {message.action}
          <Icon name="arrow-right" size={15} />
        </Link>
      ) : null}
    </div>
  );
}
