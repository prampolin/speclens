# Fase 01 — Foundation

**Estado:** Não iniciada  
**Objetivo:** Monorepo, UI base e controles seguros.  
**Dependência:** Nenhuma; ler spec.md e AGENTS.md.

## Passo a passo

- [ ] **01.01** Inicializar PNPM workspace, Next.js App Router em apps/web e packages compartilhados.
- [ ] **01.02** Configurar TypeScript strict, ESLint, formatter, Vitest e Playwright.
- [ ] **01.03** Criar layout Chat, Specs, Settings com Shadcn UI e Lucide.
- [ ] **01.04** Desabilitar telemetria, requisições externas e downloads de modelos por padrão.
- [ ] **01.05** Registrar decisões de runtime Node local e configurar .gitignore para data/, models/, .env*.

## Testes e verificações

- [ ] pnpm install --offline após pré-provisionamento de dependências.
- [ ] pnpm lint && pnpm test && pnpm build.
- [ ] Abrir UI e verificar que não houve chamadas a terceiros.

## Critério de aceite

- [ ] O app inicializa localmente, testes passam e nenhuma chamada externa acontece no carregamento.


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
