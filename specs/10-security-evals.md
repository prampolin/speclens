# Fase 10 — Privacidade, segurança e benchmarks

**Estado:** Concluída  
**Objetivo:** Modo privado com provas negativas de vazamento.  
**Dependência:** Gate aprovado da fase 09.

## Passo a passo

- [x] **10.01** Aplicar política fail-closed no backend, mesmo se a UI alterar parâmetros.
- [x] **10.02** Validar URLs contra SSRF, DNS rebinding e importações externas proibidas.
- [x] **10.03** Rejeitar provider remoto, localhost proxy e model download não autorizado.
- [x] **10.04** Limitar tamanho/tempo/profundidade de parse e quota por workspace.
- [x] **10.05** Validar ausência de analytics externos, crash reporting e logs com payloads.
- [x] **10.06** Rodar testes offline/air-gap e matrizes PT/EN para retrieval/classifier/codegen.
- [x] **10.07** Registrar hardware, modelos, revisão e métricas p50/p95, RAM e precisão.

## Testes e verificações

- [x] Negar e registrar localmente tentativa de conexão externa.
- [x] Rodar E2E sem conectividade após provisioning.
- [x] Gerar relatório reproduzível sem dados sensíveis.

## Critério de aceite

- [x] Nenhum teste crítico de privacidade falha; relatório de avaliação pode ser reproduzido.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 10.01 - 10.05 | `vitest run packages/ai-core/test/security-evals.test.ts` | 22/22 PASS | [`security-evals.test.ts`](file:///Users/vitorprampolin/prampolin/speclens/packages/ai-core/test/security-evals.test.ts) |
| 2026-10-11 | 10.06 - 10.07 | `vitest run packages/evals/test/security-benchmark.test.ts` | 3/3 PASS | [`security-benchmark.test.ts`](file:///Users/vitorprampolin/prampolin/speclens/packages/evals/test/security-benchmark.test.ts) |
| 2026-10-11 | Suite Completa | `vitest run` | 16/16 suites PASS, 157/157 testes PASS | Relatório no terminal & [`latency-baseline.json`](file:///Users/vitorprampolin/prampolin/speclens/packages/evals/baselines/latency-baseline.json) |

## Decisões e riscos

- **Fail-Closed Default**: Se `settings` ou `settings.privateMode` for indefinido, `assertPrivateMode` trata estritamente como `true`.
- **SSRF Hardening**: Bloqueio de qualquer import por URL quando `privateMode=true` (apenas upload direto de arquivo). Em qualquer modo, bloqueio explícito de loopback, ranges privados RFC1918, link-local e metadata endpoints (`169.254.169.254`, `metadata.google.internal`).
- **Log Redaction**: Módulo `redactSensitive` sanitiza recursivamente tokens (`Bearer`, `Authorization`, `x-api-key`, `password`, `cookie`) preservando campos operacionais de rastreabilidade (`method`, `path`, `operationId`).
- **Proteção contra Adversariais**: Prompts tratam especificações OpenAPI como dados de referência delimitados, nunca como instruções do sistema; codegen não replica credenciais reais em exemplos de OpenAPI.
- **Hardware Baseline**: Mapeado no Apple M4 (arm64, 16GB RAM) sem SLOs inventados.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.

