# Fase 06 — Laya + classificador configurável

**Estado:** Concluída  
**Objetivo:** Escolha de intenção local e fallback seguro.  
**Dependência:** Gate aprovado da fase 05.

## Passo a passo

- [x] **06.01** Definir DecisionProvider com labels permitidos (search_endpoint, generate_code, explain_schema, compare_endpoints) e confiança opcional.
- [x] **06.02** Implementar provider Laya local (stub com interface completa e verificação real de pesos ONNX sem fingir funcionamento).
- [x] **06.03** Manter RuleDecisionProvider como fallback explícito determinístico (nunca cloud).
- [x] **06.04** Classificar apenas intents search_endpoint, generate_code, explain_schema, compare_endpoints no MVP.
- [x] **06.05** Manter seleção de classificador independente do modelo de embedding e LLM.
- [x] **06.06** Calibrar thresholds (CONFIDENCE_THRESHOLD=0.7) e orquestrador de fallback automático (DecisionOrchestrator).

## Testes e verificações

- [x] Executar mesma suíte com Laya e fallback de regras.
- [x] Desabilitar pesos do Laya e testar fallback previsto para RuleDecisionProvider.
- [x] Inspecionar tráfego de rede com internet bloqueada e execução offline total.

## Critério de aceite

- [x] Intents somente do enum, funcionamento offline e nenhuma dependência obrigatória de serviço remoto.


## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 06.01, 06.04 | `pnpm --filter @speclens/ai-core test test/decision.test.ts` | Passou (12 testes) | `packages/ai-core/src/providers/decision/rule-based.ts` |
| 2026-10-11 | 06.02 | `pnpm --filter @speclens/ai-core test test/decision.test.ts` | Passou (Laya readiness & refusal) | `packages/ai-core/src/providers/decision/laya-local.ts` |
| 2026-10-11 | 06.03, 06.06 | `pnpm --filter @speclens/ai-core test test/decision.test.ts` | Passou (Orchestrator fallback) | `packages/ai-core/src/providers/decision/orchestrator.ts` |

## Decisões e riscos

- **Decisão sobre Laya ONNX runtime:** O `LayaLocalProvider` foi implementado como stub honesto com a interface completa do `DecisionProvider`. Ele verifica a presença real de pesos no disco em `readiness()`, não finge sucesso sem pesos e tenta carregar o runtime Node ONNX via dynamic import. Caso o runtime ou os pesos não estejam presentes, ele falha controladamente permitindo que o `DecisionOrchestrator` acione o `RuleDecisionProvider` imediatamente.
- **Risco de Runtime ONNX no Node:** A dependência `onnxruntime-node` pode exigir compilação nativa em plataformas não suportadas ou binários pré-construídos para Apple Silicon / Linux. Se houver instabilidade ou overhead no processo Node, a especificação (§6.1) prevê um sidecar Python isolado para inferência Laya ONNX.
- **RuleDecisionProvider determinístico:** Cobre os 4 intents (`generate_code`, `explain_schema`, `compare_endpoints`, `search_endpoint`) em Português e Inglês com suporte a caracteres acentuados.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.
