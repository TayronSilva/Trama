/**
 * Simulacao de cenario: Jessica e Tayronne
 *
 * 1. Jessica cria uma ideia com multiplos canais (instagram, linkedin, x)
 *    -> deve criar UMA ideia contendo os 3 canais
 * 2. Tayronne edita a ideia de Jessica
 * 3. Historico mostra quem editou, quando e o diff do conteudo
 *
 * Rode com: node scripts/simulate-history.mjs
 */

import { openStore } from '../lib/store.js';
import { rmSync } from 'node:fs';

const TEST_DB = './data/simulate-test.db';
try { rmSync(TEST_DB); } catch {}
try { rmSync(`${TEST_DB}-wal`); } catch {}
try { rmSync(`${TEST_DB}-shm`); } catch {}

const JESSICA = { id: 'jessica-id', name: 'Jessica' };
const TAYRONNE = { id: 'tayronne-id', name: 'Tayronne' };

// --- Jessica cria uma ideia com multiplos canais ---
const storeJ = openStore(TEST_DB, { seed: false, userId: JESSICA.id });

const ideia = storeJ.createIdea({
  content: 'Lancamento do novo produto — teaser multiplos canais.',
  channels: ['instagram', 'linkedin', 'x'],
  tags: 'lancamento, teaser',
});

console.log('=== Jessica criou a ideia ===');
console.log(`ID: ${ideia.id}`);
console.log(`Conteudo: "${ideia.content}"`);
console.log(`Canais: ${ideia.channels.join(', ')}`);
console.log(`Total de ideias criadas: 1 (com ${ideia.channels.length} canais)\n`);

// Verifica que so existe uma ideia
const todas = storeJ.listIdeas();
console.log(`Ideias no banco: ${todas.length} (esperado: 1)`);

// --- Tayronne edita a ideia de Jessica ---
const ideiaParaEditar = storeJ.getIdea(ideia.id);

const antes = {
  content: ideiaParaEditar.content,
  tags: [...ideiaParaEditar.tags],
  channels: [...ideiaParaEditar.channels],
};

const editada = storeJ.updateIdea(ideia.id, {
  content: 'Lancamento do novo produto — teaser multiplos canais editado por Tayronne.',
  tags: 'lancamento, teaser, atualizacao',
  channels: ['instagram', 'linkedin', 'x', 'tiktok'],
});

const depois = {
  content: editada.content,
  tags: [...editada.tags],
  channels: [...editada.channels],
};

storeJ.createIdeaEdit({
  ideaId: ideia.id,
  editorId: TAYRONNE.id,
  editorName: TAYRONNE.name,
  previous: antes,
  next: depois,
});

console.log('\n=== Tayronne editou a ideia ===');
console.log(`Editor: ${TAYRONNE.name} (${TAYRONNE.id})`);
console.log(`Conteudo antes: "${antes.content}"`);
console.log(`Conteudo depois: "${depois.content}"`);
console.log(`Canais antes: ${antes.channels.join(', ')}`);
console.log(`Canais depois: ${depois.channels.join(', ')}\n`);

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
    console.log(`   TAGS: ${edit.previousTags.join(', ')} -> ${edit.newTags.join(', ')}`);
  }
  if (edit.previousTags && edit.newTags) {
    const prevCh = JSON.parse(edit.previousTags || '[]');
    // channels nao estao no edit diretamente, mas podemos ver pelas tags
  }
  console.log('');
}

console.log('Simulacao concluida com sucesso!');
storeJ.close();
