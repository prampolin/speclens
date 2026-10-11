# Fase 03 — SQLite, workspaces e settings

**Estado:** Não iniciada  
**Objetivo:** Persistência local e configurações atômicas.  
**Dependência:** Gate aprovado da fase 02.

## Passo a passo

- [ ] **03.01** Criar migrações das tabelas workspaces, specifications, operations, embedding_indexes, provider_configs e audit_events locais.
- [ ] **03.02** Implementar SettingsRepository transacional com schema Zod e versionamento.
- [ ] **03.03** Criar padrão privateMode=true, embeddings=transformers-local, decision=laya-local, llm=ollama-local.
- [ ] **03.04** Nunca armazenar credenciais em provider_configs JSON; usar mecanismo de secrets dedicado fora do MVP privado.
- [ ] **03.05** Implementar importação idempotente por SHA-256 e isolamento por workspace.
- [ ] **03.06** Criar índice FTS5 e VectorIndex persistente atrás de interface.

## Testes e verificações

- [ ] Criar workspace, alterar settings, reiniciar processo e conferir persistência.
- [ ] Simular falha de escrita e confirmar rollback.
- [ ] Buscar documento de outro workspace e validar isolamento.

## Critério de aceite

- [ ] Nenhuma configuração corrompida, nenhum segredo em texto puro e dados preservados após reinício.


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
