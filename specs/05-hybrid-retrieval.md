# Fase 05 — Busca híbrida e RAG Inspector

**Estado:** Não iniciada  
**Objetivo:** Resultados rastreáveis e avaliáveis.  
**Dependência:** Gate aprovado da fase 04.

## Passo a passo

- [ ] **05.01** Indexar textos compactos das operations em FTS5/BM25 e VectorIndex.
- [ ] **05.02** Aplicar filtros method/path/tags e fusão de rankings (ex.: RRF configurável).
- [ ] **05.03** Carregar o schema canônico só após escolher candidatos.
- [ ] **05.04** Definir top-K, desempate, threshold e no-answer explícito.
- [ ] **05.05** Expor metadados de scores no RAG Inspector sem vazar conteúdo em logs.
- [ ] **05.06** Criar perguntas em português/inglês e medir Recall@5, MRR, top-1.

## Testes e verificações

- [ ] Perguntas exatas por path e perguntas semânticas por intenção.
- [ ] Conferir citations para operationId/spec version.
- [ ] Comparar métricas com baseline lexical e baseline vetorial.

## Critério de aceite

- [ ] Retrieval devolve fonte rastreável, scores reproduzíveis e baseline de métricas armazenado.


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
