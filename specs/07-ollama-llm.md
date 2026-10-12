# Fase 07 — Ollama e protocolo estruturado

**Estado:** Concluída no registro histórico; gate runtime/air-gap pendente de revalidação OLL-06/07
**Objetivo:** Explicação baseada em fontes, streaming validado.  
**Dependência:** Gate aprovado da fase 06.

## Passo a passo

- [x] **07.01** Criar LLMProvider e adapter Ollama para localhost com modelo instalado e permitido (`OllamaLLMProvider` em `packages/ai-core/src/llm/ollama-provider.ts`).
- [x] **07.02** Validar runtime local de fato; rejeitar modelos cloud e proxy remoto no Private Mode (`validateOllamaUrl` e `isCloudBackedModel` em `packages/ai-core/src/llm/policy.ts`).
- [x] **07.03** Criar contratos Zod para entrada, eventos SSE/NDJSON e envelope final (`explanationEventSchema`, `responseEnvelopeSchema`, `ollamaStreamChunkSchema` em `packages/ai-core/src/llm/schemas.ts`).
- [x] **07.04** Limitar contexto ao material recuperado; tratar documentos como dados não confiáveis (`buildExplanationPrompt` em `packages/ai-core/src/llm/prompt.ts`).
- [x] **07.05** Retornar ausência de evidência em vez de inventar endpoints (`buildExplanationPrompt` instrui modelo explicitamente; fallback estruturado com limitação no `ResponseEnvelope`).
- [x] **07.06** Implementar timeouts, cancelamento, erro claro e logs locais redigidos (`timeoutMs`, `AbortSignal`, eventos `error` tipados sem expor dados confidenciais).

## Testes e verificações

- [x] Consultar pergunta com documentação sensível fictícia e internet desligada (testado com fetch mockado e privateMode=true).
- [x] Validar JSON de ponta a ponta e citações para endpoints existentes (`streamExplanation` emite tokens e final ResponseEnvelope validado por Zod).
- [x] Simular modelo ausente, proxy e injection malicioso no Swagger (`readiness()` rejeita modelos offline, ausentes e cloud-backed; prompt isola dados da especificação).

## Critério de aceite

- [x] Stream estruturado válido e nenhuma rota/campo não documentado apresentado como real.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo (`validateOllamaUrl` rejeita IPs externos e URLs fora da allowlist).
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local (`isCloudBackedModel` inspeciona parent_model e remote_host).

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 07.01–07.06 | `pnpm --filter @speclens/ai-core test` | Aprovado (20/20 testes) | `packages/ai-core/tests/ollama-llm.test.ts` |
| 2026-10-11 | Integração Monorepo | `pnpm test` | Aprovado (30/30 testes) | `tests/foundation.test.ts` + `packages/ai-core/tests/ollama-llm.test.ts` |
| 2026-10-11 | Validação de Tipos e Build | `pnpm build` | Aprovado (0 erros) | build concluído de todos os packages e apps/web |
| 2026-10-11 | Linters | `pnpm lint` | Aprovado (0 erros, 0 warnings) | `eslint .` |

## Decisões e riscos

- **API do Ollama:** Utilizados `/api/tags` para verificação de prontidão (`readiness()`) e `/api/chat` para streaming estruturado com `stream: true` em NDJSON.
- **Parsing e Validação:** `parseOllamaStream` lê linha a linha do `ReadableStream`, validando cada chunk contra `ollamaStreamChunkSchema` antes de yieldar.
- **Isolamento de Prompt Injection:** Material OpenAPI delimitado explicitamente como dados brutos não-confiáveis (`--- INÍCIO DOS DADOS DA ESPECIFICAÇÃO ---`). A query do usuário nunca é injetada nas instruções do sistema.
- **Detecção de modelos cloud-backed:** Heurística em `policy.ts` verifica prefixos conhecidos de providers remotos (`cloud/`, `openai/`, `anthropic/`, etc.), `remote_host` e `parent_model` com URLs remotas.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.

## Ressalva da revisão OLL-01–06 — 2026-10-11

Os checkboxes históricos acima não comprovam integração Ollama real ou execução air-gap. A revisão em [ollama-corrections.md](./ollama-corrections.md) registra os testes reproduzidos e corrige essa distinção. Suíte focada 96/96 e regressão 200/200 PASS, com transporte/Docker mockados onde indicado. `docker compose config --quiet` PASS; smoke real parou na ausência de imagem local Ollama. Inferência, monitor de egress e teardown Docker real **NÃO EXECUTADOS**; o aceite runtime continua pendente. Nenhuma fase seguinte iniciada.
