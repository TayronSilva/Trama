import { channelById, countCharacters } from './channels.js';

const FORBIDDEN_WORDS = [
  'desbloqueie',
  'eleve',
  'mergulhe',
  'revolucione',
  'potencialize',
  'alavanque',
  'jornada',
  'no mundo de hoje',
  'não é apenas',
  'divisor de águas',
  'game changer',
];

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 15000;

export function getAiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: 'gemini',
      model: GEMINI_MODEL,
      available: false,
      reason: 'Configure GEMINI_API_KEY no .env.local',
    };
  }
  return {
    provider: 'gemini',
    model: GEMINI_MODEL,
    available: true,
    reason: null,
  };
}

export function isAiAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function buildAdaptPrompt(content, channel) {
  const forbidden = FORBIDDEN_WORDS.join(', ');
  return `
Você é um assistente de redação para redes sociais do Trama, um estúdio de conteúdo local.
Reescreva o texto abaixo para o canal "${channel.name}" (${channel.id}).

Regras obrigatórias:
- Respeite o limite máximo de ${channel.limit} caracteres (conte pontuação e espaços).
- Ajuste o tom ao canal, preserve a intenção e use quebras de linha naturais quando ajudarem a leitura.
- Exemplo de tom do Trama: "Ideias claras viram conteúdo que aproxima pessoas."
- Mantenha o texto direto e em português do Brasil.
- NÃO use estas palavras proibidas: ${forbidden}.
- Retorne apenas o texto reescrito, sem aspas, sem introdução, sem explicação.

Texto original:
${content}

Texto reescrito:
`.trim();
}

export function buildHooksPrompt(content) {
  return `
Você é um assistente de redação para redes sociais do Trama, um estúdio de conteúdo local.
Gere 3 variações da primeira frase (ganchos/aberturas) do texto abaixo.

Regras obrigatórias:
- Mantenha o tom profissional, direto e em português do Brasil.
- Exemplo de tom do Trama: "Ideias claras viram conteúdo que aproxima pessoas."
- NÃO use estas palavras proibidas: ${FORBIDDEN_WORDS.join(', ')}.
- Retorne exatamente 3 linhas, uma variação por linha, sem numeração, sem aspas, sem introdução.

Texto original:
${content}

3 aberturas:
`.trim();
}

export function parseHooksResponse(text) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 3) {
    throw new Error(
      `A resposta da IA retornou ${lines.length} abertura(ões). Esperado 3. Tente novamente.`,
    );
  }

  return [lines[0], lines[1], lines[2]];
}

function aiErrorMessage(status) {
  if (status === 401 || status === 403) {
    return 'Chave de API da IA inválida ou sem permissão. Verifique a GEMINI_API_KEY.';
  }
  if (status === 429) {
    return 'Limite de requisições da IA excedido (cota). Tente novamente mais tarde.';
  }
  if (status === 503) {
    return 'O serviço de IA está indisponível no momento. Tente novamente em alguns instantes.';
  }
  if (status >= 500) {
    return 'O servidor de IA teve um erro temporário. Tente novamente.';
  }
  if (status >= 400) {
    return 'Requisição inválida para a IA. Verifique o conteúdo e tente novamente.';
  }
  return `O serviço de IA respondeu com erro ${status}. Tente novamente.`;
}

async function callGemini(prompt) {
  const config = getAiConfig();
  if (!config.available) {
    return { ok: false, error: config.reason };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: aiErrorMessage(response.status) };
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return { ok: true, text };
  } catch (cause) {
    if (cause.name === 'AbortError') {
      return {
        ok: false,
        error: 'A IA demorou mais de 15 segundos para responder. Tente novamente.',
      };
    }
    return {
      ok: false,
      error: 'Não foi possível contatar o serviço de IA. Tente novamente.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function adaptToChannel(content, channelId) {
  const channel = channelById(channelId);
  if (!channel) {
    return { ok: false, error: `Canal não encontrado: ${channelId}` };
  }

  const prompt = buildAdaptPrompt(content, channel);
  let result = await callGemini(prompt);

  if (!result.ok) {
    return result;
  }

  let adapted = result.text.trim();

  // Valida o limite do canal; se exceder, tenta uma vez mais com prompt mais direto.
  if (countCharacters(adapted) > channel.limit) {
    const retryPrompt = `
${buildAdaptPrompt(content, channel)}
Encurte ainda mais para ficar abaixo de ${channel.limit} caracteres.

Texto reescrito:
`.trim();
    const retry = await callGemini(retryPrompt);
    if (retry.ok) {
      adapted = retry.text.trim();
    }
  }

  if (countCharacters(adapted) > channel.limit) {
    return {
      ok: false,
      error: `O texto adaptado tem ${countCharacters(adapted)} caracteres e excede o limite de ${channel.limit} do ${channel.name}.`,
    };
  }

  return { ok: true, text: adapted };
}

export async function threeHooks(content) {
  const prompt = buildHooksPrompt(content);
  const result = await callGemini(prompt);

  if (!result.ok) {
    return result;
  }

  try {
    const hooks = parseHooksResponse(result.text);
    return { ok: true, hooks };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error ? cause.message : 'Erro ao processar as aberturas.',
    };
  }
}
