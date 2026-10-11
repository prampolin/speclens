# Fase 06 — Laya + classificador configurável

**Estado:** Não iniciada  
**Objetivo:** Escolha de intenção local e fallback seguro.  
**Dependência:** Gate aprovado da fase 05.

## Passo a passo

- [ ] **06.01** Definir DecisionProvider com labels permitidos e confiança opcional.
- [ ] **06.02** Implementar provider Laya local, verificando compatibilidade Node ONNX em protótipo antes de decidir sidecar Python.
- [ ] **06.03** Manter RuleDecisionProvider como fallback explícito (nunca cloud).
- [ ] **06.04** Classificar apenas intents search_endpoint, generate_code, explain_schema, compare_endpoints no MVP.
- [ ] **06.05** Manter seleção de classificador independente do modelo de embedding e LLM.
- [ ] **06.06** Calibrar thresholds e testar casos ambíguos em PT/EN.

## Testes e verificações

- [ ] Executar mesma suíte com Laya e fallback de regras.
- [ ] Desabilitar processo do Laya e testar fallback previsto.
- [ ] Inspecionar tráfego de rede com internet bloqueada.

## Critério de aceite

- [ ] Intents somente do enum, funcionamento offline e nenhuma dependência obrigatória de serviço remoto.


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
