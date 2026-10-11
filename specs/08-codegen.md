# Fase 08 — Codegen determinístico

**Estado:** Não iniciada  
**Objetivo:** cURL, fetch e Python fundamentados no contrato.  
**Dependência:** Gate aprovado da fase 07.

## Passo a passo

- [ ] **08.01** Definir CodeGenerator e formato intermediário de requisição.
- [ ] **08.02** Gerar path/query/header e body baseado no Operation normalizado.
- [ ] **08.03** Usar placeholders rotulados para valores desconhecidos e tokens.
- [ ] **08.04** Suportar JSON, urlencoded, multipart e ausência de body.
- [ ] **08.05** Escapar URLs e strings corretamente para cada linguagem.
- [ ] **08.06** Validar snippets contra schema, com snapshots e casos negativos.

## Testes e verificações

- [ ] Executar testes de geração contra fixtures por método e content-type.
- [ ] Inspecionar ausência de segredo em snippets.
- [ ] Confirmar que endpoint inventado não gera código.

## Critério de aceite

- [ ] Nenhum método/path/field inventado; exemplos copiáveis e validados pelo contrato.


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
