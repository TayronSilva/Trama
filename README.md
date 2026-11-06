# REA-Buffer — Trama

Ferramenta local de criação e agendamento de posts, inspirada no Buffer — sem conta, sem OAuth, sem nuvem. Os canais (Instagram, LinkedIn, X, TikTok) são simulados; tudo fica salvo neste computador.

## Estado atual

- **Sprint 1 (MVP):** fluxo Create → Publish → Calendar completo.
- **Sprint 2:** um registro por canal (agendamento e publicação independentes), edição inline,
  duplicação, exclusão com confirmação, tags com filtro, limites e prévia por canal, migração
  automática e idempotente com backup.
- **Sprint 3 (pendente):** Item 6 — IA opcional (adaptar texto por canal + 3 aberturas), sem impacto no resto do app.

## Stack

- Next.js 16.4.5 (App Router) + React 19.3.1 — server components e server actions
- `node:sqlite` (DatabaseSync) — banco local em `data/trama.db`, WAL
- Datas em strings locais `YYYY-MM-DDTHH:mm` (sem drift de fuso)
- UI própria ("trama"), sem lib de componentes

## Como rodar

```powershell
npm install
npm test        # 21 testes (node --test)
npm run dev     # http://localhost:3000
```

Produção:

```powershell
npm run build
npm start
```

## IA opcional (Sprint 3 — ainda não implementada)

Duas funções apenas, via `lib/ai.js` (server-only), sem tabela nova no banco:

- **Adaptar para o canal:** reescreve o texto respeitando limite e tom do canal.
- **Três aberturas:** 3 variações da primeira frase.

Provider via ambiente:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=...
```

Sem configuração, o app funciona 100% e o botão de IA fica desabilitado com o aviso para configurar a chave. **Nunca** coloque a chave no código, em log ou no repositório — só em `.env.local` (já ignorado pelo git).
