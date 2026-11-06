'use client';

import { useState } from 'react';
import { CHANNELS, countCharacters } from '../lib/channels';
import { normalizeTags } from '../lib/tags';
import { ChannelOptions } from './Chrome';
import { Icon } from './Icons';

export function Composer({ action }) {
  const [content, setContent] = useState('');
  const [tagText, setTagText] = useState('');
  const [selected, setSelected] = useState([]);

  const characters = countCharacters(content);
  const tags = normalizeTags(tagText);
  const selectedChannels = CHANNELS.filter((channel) =>
    selected.includes(channel.id),
  );
  const narrowest = selectedChannels.reduce(
    (current, channel) =>
      !current || channel.limit < current.limit ? channel : current,
    null,
  );
  const overNarrowest = narrowest ? characters > narrowest.limit : false;

  function toggleChannel(id, checked) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  }

  return (
    <form action={action} className="idea-form">
      <label className="sr-only" htmlFor="idea-content">
        Conteúdo da ideia
      </label>
      <textarea
        id="idea-content"
        name="content"
        rows={4}
        maxLength={4000}
        required
        value={content}
        onChange={(event) => setContent(event.target.value)}
        aria-describedby="idea-counter"
        placeholder="Uma frase, um gancho, um ângulo que merece ser explorado..."
      />

      <div
        id="idea-counter"
        className={`char-counter${overNarrowest ? ' over' : ''}`}
      >
        <span>
          <strong>{characters}</strong>{' '}
          {narrowest
            ? `usados / ${narrowest.limit} em ${narrowest.name}`
            : 'caracteres'}
        </span>
        {overNarrowest ? (
          <span className="limit-warning" role="status">
            Limite excedido em {characters - narrowest.limit}. Você ainda pode
            salvar como ideia, mas não agendar nem publicar.
          </span>
        ) : null}
      </div>

      <div className="tag-field">
        <label htmlFor="idea-tags">
          Tags
          <span>separadas por vírgula</span>
        </label>
        <input
          id="idea-tags"
          name="tags"
          value={tagText}
          onChange={(event) => setTagText(event.target.value)}
          placeholder="lançamento, bastidores, editorial"
        />
        {tags.length > 0 ? (
          <div className="tag-row composer-tags" aria-label="Tags da ideia">
            {tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="composer-foot">
        <fieldset className="channel-fieldset">
          <legend>Canais de destino</legend>
          <ChannelOptions selected={selected} onChange={toggleChannel} />
        </fieldset>
        <button type="submit" className="button primary">
          <Icon name="plus" size={16} />
          Salvar ideia
        </button>
      </div>

      {selectedChannels.length > 0 ? (
        <section className="preview-panel" aria-labelledby="preview-title">
          <div className="preview-panel-head">
            <h3 id="preview-title">Prévia por canal</h3>
            <p>O texto é o mesmo; cada canal vira um registro independente.</p>
          </div>
          <div className="preview-grid">
            {selectedChannels.map((channel) => {
              const over = characters > channel.limit;
              const visible = over
                ? Array.from(content).slice(0, channel.limit).join('')
                : content;
              return (
                <article
                  className={`channel-preview${over ? ' over' : ''}`}
                  key={channel.id}
                  style={{ '--channel-color': channel.color }}
                >
                  <header className="channel-preview-head">
                    <span className="preview-avatar" aria-hidden="true">
                      {channel.short}
                    </span>
                    <div className="preview-identity">
                      <h4>{channel.name}</h4>
                      <span>{channel.previewLabel}</span>
                    </div>
                  </header>
                  <p className={`preview-copy${visible ? '' : ' empty'}`}>
                    {visible || 'A prévia aparece enquanto você escreve.'}
                    {over ? '…' : ''}
                  </p>
                  <footer className="preview-foot">
                    <span>
                      {characters} / {channel.limit}
                    </span>
                    {over ? (
                      <strong>
                        Corte visual: +{characters - channel.limit}
                      </strong>
                    ) : null}
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </form>
  );
}
