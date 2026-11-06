# Trama TODO — Sprint 3

## Encoding (verificado)

- [x] 1. Verificar lib/channels.js por caractere quebrado — ã, ç, í já estão corretos

## lib/ai.js (server-only, testes sem rede)

- [x] 2. Criar lib/ai.js com funções puras: buildAdaptPrompt, buildHooksPrompt, parseHooksResponse, getAiConfig, isAiAvailable
- [x] 3. Criar funções async: adaptToChannel (timeout 15s, 1 retry, valida countCharacters), threeHooks
- [x] 4. Chamada REST para Gemini (generativelanguage.googleapis.com), header x-goog-api-key, sem SDK
- [x] 5. Palavras proibidas no prompt: desbloqueie, eleve, mergulhe, revolucione, potencialize, alavanque, jornada, no mundo de hoje, não é apenas, divisor de águas, game changer

## Actions (app/actions.js)

- [x] 6. adaptIdeaAction({ content, channel }) → { ok, text?, error? }
- [x] 7. hooksIdeaAction({ content }) → { ok, hooks?, error? }
- [x] 8. getAiStatus() → { available, provider, reason }

## UI (components/Composer.jsx)

- [x] 9. Botão "Adaptar para o canal" — habilitado só com exatamente 1 canal selecionado
- [x] 10. Botão "Três aberturas" — 3 opções clicáveis que substituem a primeira frase
- [x] 11. Sem GEMINI_API_KEY → ambos desabilitados, aviso "Configure GEMINI_API_KEY no .env.local"
- [x] 12. Chama actions via await (não redirect)

## Testes (test/ai.test.js, sem rede)

- [x] 13. buildAdaptPrompt inclui limite, nome do canal e palavras proibidas
- [x] 14. buildHooksPrompt inclui o texto original
- [x] 15. parseHooksResponse devolve 3 strings de 3 linhas
- [x] 16. parseHooksResponse com < 3 linhas → erro legível definido
- [x] 17. getAiConfig sem env → available: false

## Validação

- [x] 18. npm test verde (21 + testes de IA)
- [x] 19. npm run build verde
- [x] 20. Playwright sem chave — botões desabilitados, aviso visível, console limpo
- [x] 21. Novas screenshots em assets/ (sprint3-*.png)
- [x] 22. Atualizar README.md com galeria de IA
- [x] 23. python -m graphify extract . --code-only


## Sprint 4: Canais Customizados, Equipes, Workspaces e Autoria

### Canais Conectados (Sidebar)
- [x] 24. Tornar handles dos canais editáveis inline com botão sutil e tecla Enter/Escape na Sidebar (`components/Sidebar.jsx`).
- [x] 25. Funções `DEFAULT_HANDLES` e `formatHandle` em `lib/channels.js`.
- [x] 26. Testes unitários de channels e handles em `test/channels.test.js` (33 testes passando).

### Banco & Store (lib/store.js)
- [ ] 27. Migração com backup automático adicionando `workspace_id`, `created_by`, `created_by_name`, `updated_by`, `updated_by_name`, `updated_at` na tabela `ideas`.
- [ ] 28. Criar tabelas `workspaces`, `users`, `workspace_members` e seeds padrão no store.
- [ ] 29. Atualizar métodos `createIdea`, `updateIdea`, `duplicateIdea`, `scheduleIdea`, `publishIdea` para registrar autoria.
- [ ] 30. Métodos `listWorkspaces`, `createWorkspace`, `listUsers`, `createUser`.

### Sessão & Actions (lib/session.js & app/actions.js)
- [ ] 31. Gerenciamento de usuário ativo via cookies (`lib/session.js`).
- [ ] 32. Ações de alternar usuário ativo e alternar workspace atual.
- [ ] 33. Atualizar Server Actions existentes para injetar usuário ativo e workspace nas mutações.

### UI & Experiência (components/)
- [ ] 34. Componente de alternância de Workspace no topo da Sidebar.
- [ ] 35. Componente de perfil / alternância rápida de amigos no rodapé da Sidebar.
- [ ] 36. Tags/chips discretos de autoria nos cards ("Criado por X", "Editado por Y").

### Validação
- [ ] 37. Testes unitários do Store com autoria e workspaces (`test/store.test.js` e `test/teams.test.js`).
- [ ] 38. `npm test` e `npm run build` verdes.
