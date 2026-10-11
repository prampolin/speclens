# Fase 08 — Codegen determinístico

**Estado:** Concluída  
**Objetivo:** cURL, fetch e Python fundamentados no contrato.  
**Dependência:** Gate aprovado da fase 07.

## Passo a passo

- [x] **08.01** Definir CodeGenerator e formato intermediário de requisição (`RequestModel`, `Param`, `BodyModel`, `AuthModel`).
- [x] **08.02** Gerar path/query/header e body baseado no Operation normalizado (`buildRequestModel`).
- [x] **08.03** Usar placeholders rotulados para valores desconhecidos e tokens (`<REQUIRED_param>`, `<YOUR_TOKEN>`, `<YOUR_API_KEY>`).
- [x] **08.04** Suportar JSON, urlencoded, multipart e ausência de body (`curl`, `fetch`, `python`).
- [x] **08.05** Escapar URLs e strings corretamente para cada linguagem.
- [x] **08.06** Validar snippets contra schema, com snapshots e casos negativos (`validateSnippet`).

## Testes e verificações

- [x] Executar testes de geração contra fixtures por método e content-type.
- [x] Inspecionar ausência de segredo em snippets.
- [x] Confirmar que endpoint inventado não gera código / gera warning de validação.

## Critério de aceite

- [x] Nenhum método/path/field inventado; exemplos copiáveis e validados pelo contrato.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 08.01–08.06 | `pnpm --filter @speclens/codegen test` | 17 testes passaram (100%) | `packages/codegen/test/codegen.test.ts` |
| 2026-10-11 | Suíte completa | `pnpm test` | 13 arquivos, 121 testes passaram | Monorepo vitest suite |
| 2026-10-11 | Linting | `pnpm lint` | 0 erros | `eslint .` |
| 2026-10-11 | Typecheck | `pnpm --filter @speclens/codegen typecheck` | Concluído com código 0 | `packages/codegen/tsconfig.json` |

## Decisões e riscos

- **Decisões**:
  - Geração 100% determinística sem acionar LLM para o código. LLM é responsável somente por síntese/explicação em outras camadas.
  - Modelo canônico intermediário `RequestModel` decoupla a extração dos dados da operação OpenAPI da sintaxe de cada linguagem.
  - Multipart/form-data omite header manual `Content-Type: multipart/form-data` nos builders (cURL usa `-F`, fetch usa `FormData`, Python usa `files=`) para garantir boundary gerado corretamente pelo runtime.
  - Ausência de valores groundeados para campos obrigatórios resulta em `<REQUIRED_{name}>`, evitando alucinação de dados.
  - Validação estrita via `validateSnippet` detecta divergências de método, parâmetros de rota inexistentes, campos não mapeados no schema OpenAPI e tipos de conteúdo não suportados.
- **Riscos mitigados**:
  - Vazamento de credenciais: nenhuma chave real é exposta, uso obrigatório de tokens de placeholder `<YOUR_TOKEN>`, `<YOUR_API_KEY>`.
  - Falha de segurança/privacidade: nenhum snippet é executado; display/copy only.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.
