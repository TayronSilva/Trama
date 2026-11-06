import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAdaptPrompt,
  buildHooksPrompt,
  parseHooksResponse,
  getAiConfig,
  isAiAvailable,
} from '../lib/ai.js';

const channel = { id: 'x', name: 'X', limit: 280 };

test('buildAdaptPrompt inclui limite, nome do canal e palavras proibidas', () => {
  const prompt = buildAdaptPrompt('Texto de teste', channel);

  assert.ok(prompt.includes('280'), 'deve incluir o limite do canal');
  assert.ok(prompt.includes('X'), 'deve incluir o nome do canal');
  assert.ok(prompt.includes('desbloqueie'), 'deve incluir palavra proibida');
  assert.ok(prompt.includes('game changer'), 'deve incluir palavra proibida');
  assert.ok(prompt.includes('Texto de teste'), 'deve incluir o texto original');
});

test('buildHooksPrompt inclui o texto original', () => {
  const prompt = buildHooksPrompt('Primeira frase. Segunda frase.');

  assert.ok(prompt.includes('Primeira frase.'), 'deve incluir o texto original');
  assert.ok(prompt.includes('3 aberturas'), 'deve pedir 3 aberturas');
});

test('parseHooksResponse devolve 3 strings de 3 linhas', () => {
  const hooks = parseHooksResponse('Abertura um.\nAbertura dois.\nAbertura três.');

  assert.deepEqual(hooks, ['Abertura um.', 'Abertura dois.', 'Abertura três.']);
});

test('parseHooksResponse ignora linhas vazias e espaços extras', () => {
  const hooks = parseHooksResponse('\n  Abertura um.  \n\nAbertura dois.\nAbertura três.\n');

  assert.deepEqual(hooks, ['Abertura um.', 'Abertura dois.', 'Abertura três.']);
});

test('parseHooksResponse com menos de 3 linhas lança erro legível', () => {
  assert.throws(
    () => parseHooksResponse('Apenas uma.'),
    /abertura/i,
  );

  assert.throws(
    () => parseHooksResponse('Duas apenas.\nE mais uma.'),
    /abertura/i,
  );
});

test('getAiConfig sem env → available: false', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const config = getAiConfig();
    assert.equal(config.available, false);
    assert.equal(config.provider, 'gemini');
    assert.ok(config.reason, 'deve ter reason');
    assert.ok(
      config.reason.includes('GEMINI_API_KEY'),
      'reason deve mencionar GEMINI_API_KEY',
    );
  } finally {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

test('isAiAvailable reflete a presença da chave', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    assert.equal(isAiAvailable(), false);
  } finally {
    if (originalKey !== undefined) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});
