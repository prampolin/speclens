# Fase 04 — Embeddings intercambiáveis

**Estado:** Concluída  
**Objetivo:** Modelo local padrão e índices versionados.  
**Dependência:** Gate aprovado da fase 03.

## Passo a passo

- [x] **04.01** Implementar ProviderManifest, EmbeddingProvider e ProviderRegistry.
- [x] **04.02** Implementar adapter @huggingface/transformers com arquivos locais e revision fixada.
- [x] **04.03** Recusar download em runtime no privateMode=true (PrivacyViolationError).
- [x] **04.04** Persistir fingerprint: modelo, revisão, dimensões, pré-processamento e versão da spec (namespaceId).
- [x] **04.05** Criar migração de índice por staging, rebuild e troca atômica (EmbeddingIndexer + LocalFlatVectorIndex).
- [x] **04.06** Validar seleção de provedor e explicar incompatibilidades no painel (assertCompatibleSpaces).

## Testes e verificações

- [x] Indexar fixture de specs; consultar com modelo original.
- [x] Trocar modelo e verificar bloqueio até reconstrução.
- [x] Simular ausência dos pesos e verificar falha controlada, sem fallback cloud.

## Critério de aceite

- [x] Vetores nunca são comparados entre espaços incompatíveis; indexação roda desconectada.


## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 04.01 | `pnpm --filter @speclens/ai-core test test/registry.test.ts` | Passou (6 testes) | `packages/ai-core/src/providers/registry.ts` |
| 2026-10-11 | 04.02-04.04 | `pnpm --filter @speclens/ai-core test test/embedding.test.ts` | Passou (7 testes) | `packages/ai-core/src/providers/embedding/transformers-local.ts` |
| 2026-10-11 | 04.05-04.06 | `pnpm --filter @speclens/ai-core test test/indexer.test.ts` | Passou (4 testes) | `packages/ai-core/src/providers/embedding/indexer.ts` |

## Decisões e riscos

- **Transformers local offline:** `TransformersLocalEmbeddingProvider` bloqueia downloads com `allowRemoteModels=false` e lança `PrivacyViolationError` se os pesos não estiverem no disco em `privateMode=true`.
- **Fingerprint imutável:** `namespaceId` calcula SHA-256 de workspace, specId, providerId, modelId, modelRevision, dimensions e chunkingVersion. Comparações entre espaços diferentes são rejeitadas por `EmbeddingIndexer.assertCompatibleSpaces`.
- **Staging seguro:** `EmbeddingIndexer.stageAndCommit` constrói o índice em namespace temporário de staging antes do commit atômico, garantindo ausência de estado intermediário corrompido.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.
