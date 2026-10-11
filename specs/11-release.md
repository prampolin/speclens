# Fase 11 — Packaging e release local

**Estado:** Não iniciada  
**Objetivo:** Instalação reproduzível e documentação.  
**Dependência:** Gate aprovado da fase 10.

## Passo a passo

- [ ] **11.01** Criar Docker Compose local com volumes persistentes e portas limitadas a loopback.
- [ ] **11.02** Preparar scripts para provisionar artefatos previamente à operação desconectada.
- [ ] **11.03** Documentar fluxo Apple Silicon/macOS e Docker Linux.
- [ ] **11.04** Incluir README, ARCHITECTURE, SECURITY, LICENSE e screenshots sem dados reais.
- [ ] **11.05** Definir smoke test de instalação limpa + air-gap.
- [ ] **11.06** Documentar limitações, não prometer latência sub-segundo sem medir.

## Testes e verificações

- [ ] Subir app e dependências com volumes locais.
- [ ] Reiniciar containers e verificar workspaces e indexes.
- [ ] Desconectar rede e executar fluxo completo de demonstração.

## Critério de aceite

- [ ] Release local reproduzível e privacidade validada em instalação limpa.


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
