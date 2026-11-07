'use client';

import { useEffect, useState } from 'react';
import { getIdeaEditsAction } from '../app/actions';

export default function IdeaHistory({ ideaId }) {
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIdeaEditsAction(Number(ideaId)).then(setEdits).finally(() => setLoading(false));
  }, [Number(ideaId)]);

  if (loading) return null;
  if (edits.length === 0) return null;

  return (
    <section className="idea-history" aria-label="Historico de edicoes">
      <h3 className="history-title">Historico de alteracoes</h3>
      <ul className="history-list">
        {edits.map((edit) => (
          <li key={edit.id} className="history-item">
            <div className="history-head">
              <span className="history-editor">
                <strong>{edit.editorName || edit.editorId}</strong>
              </span>
              <span className="history-at">{formatDateTimeBR(edit.createdAt)}</span>
            </div>
            {edit.previousContent && edit.newContent &&
              edit.previousContent !== edit.newContent && (
                <div className="history-diff">
                  <p className="diff-label">Conteudo alterado</p>
                  <div className="diff-before">
                    <span className="diff-tag">Antes:</span>
                    <p className="diff-text">{edit.previousContent}</p>
                  </div>
                  <div className="diff-after">
                    <span className="diff-tag">Depois:</span>
                    <p className="diff-text">{edit.newContent}</p>
                  </div>
                </div>
              )}
            {(!edit.previousContent ||
              edit.newContent === edit.previousContent ||
              (edit.previousTags && edit.newTags &&
                JSON.stringify(edit.previousTags) !==
                  JSON.stringify(edit.newTags))) && (
              <p className="history-note">Tags ou metadados atualizados.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
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
