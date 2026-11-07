import { duplicateIdeaAction, updateIdeaAction } from '../app/actions';
import { DeleteButton } from './DeleteButton';
import IdeaHistory from './IdeaHistory';
import { Icon } from './Icons';

export function PostTools({ post, from = 'create' }) {
  const contentId = `edit-content-${post.id}`;
  const tagsId = `edit-tags-${post.id}`;

  return (
    <div className="post-tools">
      <details className="edit-details">
        <summary className="button quiet small">
          <Icon name="pen" size={15} />
          Editar
        </summary>
        <form action={updateIdeaAction} className="edit-form">
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="from" value={from} />
          {post.channels.map((channel) => (
            <input
              key={channel}
              type="hidden"
              name="channels"
              value={channel}
            />
          ))}
          <label className="sr-only" htmlFor={contentId}>
            Editar conteúdo
          </label>
          <textarea
            id={contentId}
            name="content"
            rows={3}
            required
            defaultValue={post.content}
          />
          <label className="field edit-tags" htmlFor={tagsId}>
            <span>Tags</span>
            <input
              id={tagsId}
              name="tags"
              defaultValue={post.tags.join(', ')}
              placeholder="separadas por vírgula"
            />
          </label>
          <label className="field edit-channels" style={{ marginTop: 8 }}>
            <span>Canais</span>
            <input
              id={`edit-channels-${post.id}`}
              name="channels-text"
              defaultValue={post.channels.join(', ')}
              placeholder="instagram, linkedin, x"
              readOnly
            />
          </label>
          <div className="edit-form-actions">
            <button type="submit" className="button primary small">
              <Icon name="check" size={15} />
              Salvar
            </button>
            <span>O agendamento não muda.</span>
          </div>
        </form>
      </details>

      <form action={duplicateIdeaAction} className="inline-form">
        <input type="hidden" name="id" value={post.id} />
        <input type="hidden" name="from" value={from} />
        <button type="submit" className="button quiet small">
          <Icon name="layers" size={15} />
          Duplicar
        </button>
      </form>

      <DeleteButton id={post.id} from={from} />
      <IdeaHistory ideaId={post.id} from={from} />
    </div>
  );
}
