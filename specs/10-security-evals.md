# Fase 10 — Privacidade, segurança e benchmarks

**Estado:** Não iniciada  
**Objetivo:** Modo privado com provas negativas de vazamento.  
**Dependência:** Gate aprovado da fase 09.

## Passo a passo

- [ ] **10.01** Aplicar política fail-closed no backend, mesmo se a UI alterar parâmetros.
- [ ] **10.02** Validar URLs contra SSRF, DNS rebinding e importações externas proibidas.
- [ ] **10.03** Rejeitar provider remoto, localhost proxy e model download não autorizado.
- [ ] **10.04** Limitar tamanho/tempo/profundidade de parse e quota por workspace.
- [ ] **10.05** Validar ausência de analytics externos, crash reporting e logs com payloads.
- [ ] **10.06** Rodar testes offline/air-gap e matrizes PT/EN para retrieval/classifier/codegen.
- [ ] **10.07** Registrar hardware, modelos, revisão e métricas p50/p95, RAM e precisão.

## Testes e verificações

- [ ] Negar e registrar localmente tentativa de conexão externa.
- [ ] Rodar E2E sem conectividade após provisioning.
- [ ] Gerar relatório reproduzível sem dados sensíveis.

## Critério de aceite

- [ ] Nenhum teste crítico de privacidade falha; relatório de avaliação pode ser reproduzido.


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
