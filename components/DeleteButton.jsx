'use client';

import { useState } from 'react';
import { deleteIdeaAction } from '../app/actions';

export function DeleteButton({ id, from }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="button quiet small danger-text"
        onClick={() => setConfirming(true)}
      >
        Excluir
      </button>
    );
  }

  return (
    <span className="delete-confirm">
      <form action={deleteIdeaAction} className="inline-form">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="from" value={from} />
        <button type="submit" className="button danger small">
          Confirmar exclusão
        </button>
      </form>
      <button
        type="button"
        className="button quiet small"
        onClick={() => setConfirming(false)}
      >
        Cancelar
      </button>
    </span>
  );
}
