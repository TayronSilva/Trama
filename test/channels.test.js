import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNELS,
  DEFAULT_HANDLES,
  channelById,
  countCharacters,
  formatHandle,
} from '../lib/channels.js';

test('DEFAULT_HANDLES possui os handles iniciais corretos', () => {
  assert.equal(DEFAULT_HANDLES.instagram, '@trama.studio');
  assert.equal(DEFAULT_HANDLES.linkedin, 'trama-studio');
  assert.equal(DEFAULT_HANDLES.x, '@trama');
  assert.equal(DEFAULT_HANDLES.tiktok, '@trama.studio');
});

test('formatHandle formata e adiciona arroba para canais sociais quando apropriado', () => {
  assert.equal(formatHandle('instagram', 'meuprojeto'), '@meuprojeto');
  assert.equal(formatHandle('instagram', '@meuprojeto'), '@meuprojeto');
  assert.equal(formatHandle('linkedin', 'empresa-xyz'), 'empresa-xyz');
  assert.equal(formatHandle('x', 'novo_handle'), '@novo_handle');
  assert.equal(formatHandle('tiktok', 'criador'), '@criador');
});

test('formatHandle reverte para o padrão se string for vazia ou nula', () => {
  assert.equal(formatHandle('instagram', '   '), '@trama.studio');
  assert.equal(formatHandle('linkedin', ''), 'trama-studio');
  assert.equal(formatHandle('x', null), '@trama');
});

test('channelById retorna canal correto ou fallback', () => {
  assert.equal(channelById('instagram').name, 'Instagram');
  assert.equal(channelById('desconhecido').name, 'desconhecido');
});

test('countCharacters conta caracteres unicode corretamente', () => {
  assert.equal(countCharacters('teste'), 5);
  assert.equal(countCharacters('🚀'), 1);
});
