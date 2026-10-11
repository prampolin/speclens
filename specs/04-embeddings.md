# Fase 04 — Embeddings intercambiáveis

**Estado:** Não iniciada  
**Objetivo:** Modelo local padrão e índices versionados.  
**Dependência:** Gate aprovado da fase 03.

## Passo a passo

- [ ] **04.01** Implementar ProviderManifest, EmbeddingProvider e ProviderRegistry.
- [ ] **04.02** Implementar adapter @huggingface/transformers com arquivos locais e revision fixada.
- [ ] **04.03** Recusar download em runtime no privateMode=true.
- [ ] **04.04** Persistir fingerprint: modelo, revisão, dimensões, pré-processamento e versão da spec.
- [ ] **04.05** Criar migração de índice por staging, rebuild e troca atômica.
- [ ] **04.06** Validar seleção de provedor e explicar incompatibilidades no painel.

## Testes e verificações

- [ ] Indexar fixture de specs; consultar com modelo original.
- [ ] Trocar modelo e verificar bloqueio até reconstrução.
- [ ] Simular ausência dos pesos e verificar falha controlada, sem fallback cloud.

## Critério de aceite

- [ ] Vetores nunca são comparados entre espaços incompatíveis; indexação roda desconectada.


## Privacidade e segurança

- [ ] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [ ] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [ ] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| — | — | NÃO EXECUTADO | Pendente | — |

## Decisões e riscos

- Pendentes de execução.

## Gate de saída

- [ ] Todas as tarefas P0 desta fase concluídas.
- [ ] Testes indicados executados e resultados registrados.
- [ ] Checagens de privacidade aprovadas.
- [ ] `plan.md` atualizado com a fase finalizada.
