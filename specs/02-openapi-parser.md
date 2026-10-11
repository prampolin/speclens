# Fase 02 — Parser e normalização OpenAPI

**Estado:** Não iniciada  
**Objetivo:** Contrato canônico por método + path.  
**Dependência:** Gate aprovado da fase 01.

## Passo a passo

- [ ] **02.01** Implementar importação de JSON e YAML por arquivo local com limite de tamanho.
- [ ] **02.02** Validar Swagger 2.0 e OpenAPI 3.x, incluindo erros com caminho e contexto.
- [ ] **02.03** Normalizar métodos, paths, parameters, requestBody, security, responses, exemplos e provenance.
- [ ] **02.04** Resolver apenas $ref permitido, com tratamento de ciclos e limites de recursão.
- [ ] **02.05** Criar fixtures para allOf, oneOf, anyOf, multipart, caminhos duplicados e spec malformada.

## Testes e verificações

- [ ] Executar fixtures de parser e snapshots do Operation normalizado.
- [ ] Contar operations e comparar com métodos suportados no arquivo-fonte.
- [ ] Testar $ref remoto bloqueado.

## Critério de aceite

- [ ] Operações e schemas correspondem à fonte e não existe expansão infinita nem resolução remota no privado.


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
