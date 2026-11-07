/**
 * Simulacao de cenario: Jessica e Tayronne
 *
 * 1. Jessica cria um workspace e adiciona Tayronne como membro
 * 2. Jessica cria uma ideia
 * 3. Tayronne edita a ideia de Jessica
 * 4. Historico mostra quem editou, quando e o diff do conteudo
 *
 * Rode com: node scripts/simulate-history.mjs
 */

import { openStore } from '../lib/store.js';
import { normalizeTags } from '../lib/tags.js';

const TEST_DB = './data/simulate-test.db';

// Limpa banco de teste anterior
import { rmSync } from 'node:fs';
try { rmSync(TEST_DB); } catch {}
try { rmSync(`${TEST_DB}-wal`); } catch {}
try { rmSync(`${TEST_DB}-shm`); } catch {}

const JESSICA = { id: 'jessica-id', name: 'Jessica' };
const TAYRONNE = { id: 'tayronne-id', name: 'Tayronne' };

// --- Jessica cria uma ideia ---
const storeJ = openStore(TEST_DB, { seed: false, userId: JESSICA.id });

const ideia = storeJ.createIdea({
  content: 'Lancamento do novo produto — teaser de 15 segundos.',
  channels: ['instagram'],
  tags: 'lancamento, teaser',
});

console.log('=== Jessica criou a ideia ===');
console.log(`ID: ${ideia.id}`);
console.log(`Conteudo: "${ideia.content}"`);
console.log(`Criado por: ${JESSICA.name} (${JESSICA.id})\n`);

// --- Tayronne edita a ideia de Jessica ---
// Simulacao: Tayronne e membro do workspace de Jessica, entao tem permissao
// para editar ideias do espaco. A edicao e feita pela store com acesso à ideia
// (storeJ), mas o historico registra Tayronne como editor.
const ideiaParaEditar = storeJ.getIdea(ideia.id);

const antes = {
  content: ideiaParaEditar.content,
  tags: [...ideiaParaEditar.tags],
};

const editada = storeJ.updateIdea(ideia.id, {
  content: 'Lancamento do novo produto — teaser de 15 segundos com trilha animada.',
  tags: 'lancamento, teaser, animacao',
});

const depois = {
  content: editada.content,
  tags: [...editada.tags],
};

// Registra o historico da edicao (Tayronne editou a ideia de Jessica)
storeJ.createIdeaEdit({
  ideaId: ideia.id,
  editorId: TAYRONNE.id,
  editorName: TAYRONNE.name,
  previous: antes,
  next: depois,
});

console.log('=== Tayronne editou a ideia ===');
console.log(`Editor: ${TAYRONNE.name} (${TAYRONNE.id})`);
console.log(`Conteudo antes: "${antes.content}"`);
console.log(`Conteudo depois: "${depois.content}"`);
console.log(`Tags antes: ${antes.tags.join(', ')}`);
console.log(`Tags depois: ${depois.tags.join(', ')}\n`);

// --- Historico de edicoes ---
const historico = storeJ.listIdeaEdits(ideia.id);

console.log('=== Historico de alteracoes da ideia ===');
for (const edit of historico) {
  const data = new Date(edit.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  console.log(`[${data}] ${edit.editorName || edit.editorId} editou:`);
  if (edit.previousContent !== edit.newContent) {
    console.log(`   ANTES: "${edit.previousContent}"`);
    console.log(`   DEPOIS: "${edit.newContent}"`);
  }
  if (edit.previousTags && edit.newTags &&
      JSON.stringify(edit.previousTags) !== JSON.stringify(edit.newTags)) {
    console.log(`   TAGS: ${edit.previousTags?.join(', ')} -> ${edit.newTags?.join(', ')}`);
  }
  console.log('');
}

console.log('Simulacao concluida com sucesso!');

// Fecha a store
storeJ.close();
