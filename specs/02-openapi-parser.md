# Fase 02 — Parser e normalização OpenAPI

**Estado:** Concluída  
**Objetivo:** Contrato canônico por método + path.  
**Dependência:** Gate aprovado da fase 01.

## Passo a passo

- [x] **02.01** Implementar importação de JSON e YAML por arquivo local com limite de tamanho.
- [x] **02.02** Validar Swagger 2.0 e OpenAPI 3.x, incluindo erros com caminho e contexto.
- [x] **02.03** Normalizar métodos, paths, parameters, requestBody, security, responses, exemplos e provenance.
- [x] **02.04** Resolver apenas $ref permitido, com tratamento de ciclos e limites de recursão.
- [x] **02.05** Criar fixtures para allOf, oneOf, anyOf, multipart, caminhos duplicados e spec malformada.

## Testes e verificações

- [x] Executar fixtures de parser e snapshots do Operation normalizado.
- [x] Contar operations e comparar com métodos suportados no arquivo-fonte.
- [x] Testar $ref remoto bloqueado.

## Critério de aceite

- [x] Operações e schemas correspondem à fonte e não existe expansão infinita nem resolução remota no privado.


## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 02.01 / 02.02 | `pnpm --filter @speclens/openapi-core test` (parser.test.ts) | 8 testes passaram (JSON/Buffer, YAML, limites, erros com contexto) | `packages/openapi-core/src/__tests__/parser.test.ts` |
| 2026-10-11 | 02.04 | `pnpm --filter @speclens/openapi-core test` (ref-resolver.test.ts) | 5 testes passaram (ciclo com corte seguro, $ref remoto bloqueado com erro acionável, allOf/oneOf/anyOf) | `packages/openapi-core/src/__tests__/ref-resolver.test.ts` |
| 2026-10-11 | 02.03 / 02.05 | `pnpm --filter @speclens/openapi-core test` (normalizer.test.ts) | 5 testes passaram (contagem exata de operações, snapshot, Swagger 2.0 conversion, toIndexText, multipart) | `packages/openapi-core/src/__tests__/normalizer.test.ts` |
| 2026-10-11 | Suite completa | `pnpm test` | 18 testes aprovados em 3 arquivos de teste | Vitest v3.2.7 (433ms) |

## Decisões e riscos

- **Decisão:** ID estável de operação padronizado como `{specId}:{method}:{canonicalPath}` (tudo em lowercase) garantindo invariância de case e unicidade canônica.
- **Decisão:** `$ref` remoto com `privateMode=true` (padrão) lança erro explícito `RefResolutionError` com código `REMOTE_REF_FORBIDDEN` e não faz requisições de rede.
- **Decisão:** Referências circulares são interceptadas com pilha de chamadas e profundidade máxima (20), retornando marcador `{ $refCycle: pointer, type: 'object' }` para evitar overflow.
- **Decisão:** Parâmetros de nível de path (`paths[path].parameters`) são mesclados com parâmetros de operação (`op.parameters`), onde a operação sobrescreve por nome + `in`.
- **Decisão:** Swagger 2.0 converte `in: "body"` e `in: "formData"` em `requestBody` compatível OpenAPI 3.x, e converte `host` + `basePath` em `servers`.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.
