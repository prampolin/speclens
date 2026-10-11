# Fase 07 — Ollama e protocolo estruturado

**Estado:** Não iniciada  
**Objetivo:** Explicação baseada em fontes, streaming validado.  
**Dependência:** Gate aprovado da fase 06.

## Passo a passo

- [ ] **07.01** Criar LLMProvider e adapter Ollama para localhost com modelo instalado e permitido.
- [ ] **07.02** Validar runtime local de fato; rejeitar modelos cloud e proxy remoto no Private Mode.
- [ ] **07.03** Criar contratos Zod para entrada, eventos SSE/NDJSON e envelope final.
- [ ] **07.04** Limitar contexto ao material recuperado; tratar documentos como dados não confiáveis.
- [ ] **07.05** Retornar ausência de evidência em vez de inventar endpoints.
- [ ] **07.06** Implementar timeouts, cancelamento, erro claro e logs locais redigidos.

## Testes e verificações

- [ ] Consultar pergunta com documentação sensível fictícia e internet desligada.
- [ ] Validar JSON de ponta a ponta e citações para endpoints existentes.
- [ ] Simular modelo ausente, proxy e injection malicioso no Swagger.

## Critério de aceite

- [ ] Stream estruturado válido e nenhuma rota/campo não documentado apresentado como real.


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
