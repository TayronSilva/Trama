'use client';

import { useEffect, useState } from 'react';
import { CHANNELS, countCharacters } from '../lib/channels';
import { normalizeTags } from '../lib/tags';
import { ChannelOptions } from './Chrome';
import { Icon } from './Icons';
import {
  adaptIdeaAction,
  hooksIdeaAction,
  getAiStatus,
} from '../app/actions';

export function Composer({ action }) {
  const [content, setContent] = useState('');
  const [tagText, setTagText] = useState('');
  const [selected, setSelected] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [adapting, setAdapting] = useState(false);
  const [hookOptions, setHookOptions] = useState([]);
  const [hooksError, setHooksError] = useState(null);

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
  const aiAvailable = aiStatus ? aiStatus.available : false;
  const singleChannel = selectedChannels.length === 1;

  useEffect(() => {
    getAiStatus()
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({ available: false, reason: 'Erro ao verificar IA.' }),
      );
  }, []);

  function toggleChannel(id, checked) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((item) => item !== id),
    );
  }

  function replaceFirstSentence(nextText, hook) {
    const match = nextText.match(/^([^.!?]*[.!?]?)\s*(.*)$/s);
    if (!match) return hook;
    const rest = match[2] ? ` ${match[2]}` : '';
    return `${hook}${rest}`;
  }

  async function handleAdapt() {
    if (!singleChannel) return;
    setAdapting(true);
    setAiError(null);
    const channel = selectedChannels[0].id;
    try {
      const result = await adaptIdeaAction({ content, channel });
      if (result.ok) {
        setContent(result.text);
      } else {
        setAiError(result.error || 'Erro ao adaptar o texto.');
      }
    } finally {
      setAdapting(false);
    }
  }

  async function handleHooks() {
    setHookOptions([]);
    setHooksError(null);
    const result = await hooksIdeaAction({ content });
    if (result.ok) {
      setHookOptions(result.hooks);
    } else {
      setHooksError(result.error || 'Erro ao gerar aberturas.');
    }
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

        {aiStatus ? (
          <div className="ai-tools">
            <p className="ai-status">
              {aiAvailable ? (
                <>
                  <span>IA disponível</span>
                  <span className="ai-model">
                    {aiStatus.provider} · {aiStatus.model}
                  </span>
                </>
              ) : (
                <span className="ai-warn">
                  Configure GEMINI_API_KEY no .env.local para usar a IA.
                </span>
              )}
            </p>

            <div className="ai-buttons">
              <button
                type="button"
                className={`button quiet small${
                  !aiAvailable || !singleChannel ? ' disabled' : ''
                }`}
                disabled={!aiAvailable || !singleChannel || adapting}
                title={
                  !aiAvailable
                    ? 'Configure GEMINI_API_KEY no .env.local.'
                    : !singleChannel
                    ? 'Selecione exatamente um canal para adaptar.'
                    : undefined
                }
                onClick={handleAdapt}
              >
                <Icon name="sparkles" size={14} />
                {adapting ? 'Adaptando…' : 'Adaptar para o canal'}
              </button>
              <span className="ai-caption">
                Reescreve respeitando o limite e o tom do canal selecionado.
              </span>

              <button
                type="button"
                className={`button quiet small${
                  !aiAvailable ? ' disabled' : ''
                }`}
                disabled={!aiAvailable}
                title={
                  !aiAvailable
                    ? 'Configure GEMINI_API_KEY no .env.local.'
                    : undefined
                }
                onClick={handleHooks}
              >
                <Icon name="sparkles" size={14} />
                Três aberturas
              </button>
              <span className="ai-caption">
                Gera 3 variações da primeira frase (gancho) da sua ideia.
              </span>
            </div>

            {aiError && (
              <p className="ai-error" role="alert">
                {aiError}
              </p>
            )}

            {hooksError && (
              <p className="ai-error" role="alert">
                {hooksError}
              </p>
            )}

            {hookOptions.length > 0 && (
              <div className="ai-hooks">
                <span className="ai-hooks-label">Escolha uma abertura:</span>
                <div className="ai-hook-list">
                  {hookOptions.map((hook, index) => (
                    <button
                      type="button"
                      key={index}
                      className="button quiet small ai-hook"
                      onClick={() => {
                        setContent(
                          replaceFirstSentence(content, hook),
                        );
                        setHookOptions([]);
                      }}
                    >
                      {hook}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

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
