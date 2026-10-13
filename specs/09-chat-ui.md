# Fase 09 — Chat, Settings e UI final

**Estado:** Concluída  
**Objetivo:** Fluxo sem terminal, com proveniência visível.  
**Dependência:** Gate aprovado da fase 08.

## Passo a passo

- [x] **09.01** Implementar importar/listar specs, seletor workspace e estados de processamento.
- [x] **09.02** Criar painel de Settings por workspace com modos e impedimentos claros.
- [x] **09.03** Chat com streaming, fontes clicáveis e seletor cURL/fetch/Python com Shiki.
- [x] **09.04** Criar painel de fontes e RAG Inspector com ranking e versão da spec.
- [x] **09.05** Aplicar acessibilidade para teclado, leitores de tela e feedback de erros.
- [x] **09.06** Implementar bloqueio de ações enquanto índice estiver em rebuild.

## Testes e verificações

- [x] Vitest Unit & Integration API Routes: 11/11 testes executados e aprovados (`apps/web/src/__tests__/api-routes.test.ts`).
- [ ] Playwright E2E: **NÃO EXECUTADO** — Ambiente sandbox restrito sem navegadores instalados (`Error: Timed out waiting from config.webServer`).
- [x] Next.js Build: `next build` compilado com sucesso com 5/5 páginas estáticas e rotas dinâmicas.
- [x] Test suite completo: 132/132 testes aprovados em todo o monorepo (`vitest run`).

## Critério de aceite

- [x] Usuário conclui jornada inteira pela UI e consegue verificar a origem da resposta.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 09.01 - 09.06 | `vitest run apps/web/src/__tests__/api-routes.test.ts` | 11/11 pass | Testes de SSE, Health, Providers, Settings, Specs, Operations |
| 2026-10-11 | 09.01 - 09.06 | `pnpm --filter web build` | Build ok (code 0) | Next.js 15 compilou todas as rotas e componentes estáticos/dinâmicos |
| 2026-10-11 | Monorepo | `vitest run` | 132/132 pass | Suíte completa incluindo openapi-core, db, ai-core, codegen, evals, web |
| 2026-10-11 | E2E | `pnpm --filter web test:e2e` | NÃO EXECUTADO | Sandbox sem suporte a headless browsers e portas de dev server |

### Revalidação OLL-07 — 2026-10-12

`bash scripts/test-ollama-e2e.sh` — **PASS, 1/1** com Chrome instalado, banco temporário e servidores em portas loopback exclusivas. Importou fixture, trocou modelo via Settings sem reiniciar, consultou novamente e mostrou fontes e observação de fallback ao selecionar modelo ausente. A UI passou a renderizar `answer.limitations` em cada resposta final para expor essa observação.

## Decisões e riscos

- **Shiki Syntax Highlighting:** Utilizado com tema `github-dark-default` em SSR/API e no cliente para renderização de snippets em cURL, JavaScript (fetch) e Python, com display e cópia apenas (sem execução de código).
- **Fail-Closed Private Mode:** Todas as rotas no servidor aplicam validação estrita. No caso de o LLM local (Ollama) estar desligado ou indisponível, a resposta em streaming sintetiza um envelope grounded estruturado diretamente a partir dos contratos OpenAPI presentes no SQLite local, garantindo zero alucinação e zero queda do serviço.
- **RAG Inspector e JSON Pointer:** A gaveta lateral direita (Endpoint Inspector) exibe abas alternáveis entre o Contrato OpenAPI Canônico e o RAG Ranking (scores de busca lexical FTS5, vetorial e fusão RRF), com visualização explícita do JSON Pointer e versão da especificação.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.

### Ajuste de upload — 2026-10-12

- [x] Removido o teto de 10 MiB da rota de importação (multipart e corpo direto), com override explícito do limite do parser somente nesse fluxo.
- [x] Área de specs aceita arrastar/soltar, destaca o destino, informa envio/erro e preserva seleção por teclado. Um arquivo por vez; upload duplicado e envio durante indexação bloqueados.
- [x] Validação: API + parser 25/25; segurança 8/8; E2E Chrome 1/1 com arquivo >10 MiB, extensão inválida, seletor tradicional e nenhuma requisição externa do navegador; TypeScript web PASS.
- Decisão: pedido explícito do usuário substitui a exigência anterior de teto de bytes em PM-004; contrato e SECURITY atualizados. Parser reutilizável mantém seu limite padrão, e upload mantém proteções de referências/estrutura. privateMode=true preservado, sem nova rota ou destino de egress.
- Risco: leitura integral em memória; arquivos grandes dependem de RAM/disco e podem falhar por recursos. Não promete tamanho fisicamente ilimitado.
- Próximo item: nenhum iniciado; ajuste pontual após fases concluídas.
