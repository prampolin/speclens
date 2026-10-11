# Fase 09 — Chat, Settings e UI final

**Estado:** Não iniciada  
**Objetivo:** Fluxo sem terminal, com proveniência visível.  
**Dependência:** Gate aprovado da fase 08.

## Passo a passo

- [ ] **09.01** Implementar importar/listar specs, seletor workspace e estados de processamento.
- [ ] **09.02** Criar painel de Settings por workspace com modos e impedimentos claros.
- [ ] **09.03** Chat com streaming, fontes clicáveis e seletor cURL/fetch/Python com Shiki.
- [ ] **09.04** Criar painel de fontes e RAG Inspector com ranking e versão da spec.
- [ ] **09.05** Aplicar acessibilidade para teclado, leitores de tela e feedback de erros.
- [ ] **09.06** Implementar bloqueio de ações enquanto índice estiver em rebuild.

## Testes e verificações

- [ ] Playwright: importar → perguntar → inspecionar → copiar snippet.
- [ ] Testar configuração inválida e reload do browser.
- [ ] Verificar layout desktop/mobile e uso por teclado.

## Critério de aceite

- [ ] Usuário conclui jornada inteira pela UI e consegue verificar a origem da resposta.


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
