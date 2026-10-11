# Fase 01 — Foundation

**Estado:** Concluída  
**Objetivo:** Monorepo, UI base e controles seguros.  
**Dependência:** Nenhuma; ler spec.md e AGENTS.md.

## Passo a passo

- [x] **01.01** Inicializar PNPM workspace, Next.js App Router em apps/web e packages compartilhados.
- [x] **01.02** Configurar TypeScript strict, ESLint, formatter, Vitest e Playwright.
- [x] **01.03** Criar layout Chat, Specs, Settings com Shadcn UI e Lucide.
- [x] **01.04** Desabilitar telemetria, requisições externas e downloads de modelos por padrão.
- [x] **01.05** Registrar decisões de runtime Node local e configurar .gitignore para data/, models/, .env*.

## Testes e verificações

- [x] pnpm install --offline após pré-provisionamento de dependências.
- [x] pnpm lint && pnpm test && pnpm build.
- [x] Abrir UI e verificar que não houve chamadas a terceiros.

## Critério de aceite

- [x] O app inicializa localmente, testes passam e nenhuma chamada externa acontece no carregamento.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo.
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 01.01 | `pnpm install --offline` | Sucesso (220ms, 7 workspace projects up to date) | `pnpm-workspace.yaml`, `package.json` |
| 2026-10-11 | 01.02 | `pnpm lint` | Sucesso (0 erros de linting) | `eslint.config.js`, `.prettierrc` |
| 2026-10-11 | 01.02 | `pnpm test` (vitest run) | Sucesso (10/10 testes unitários passaram) | `tests/foundation.test.ts` |
| 2026-10-11 | 01.01/01.03 | `pnpm build` | Sucesso (tsc --noEmit em 5 pacotes + Next.js build estático) | `apps/web/.next` |
| 2026-10-11 | 01.04 | `pnpm test` | `privateMode=true` padrão validado | `apps/web/src/lib/config.ts` |
| 2026-10-11 | 01.04/01.05 | Inspeção de rede / CSP | CSP headers estritos `connect-src 'self' http://127.0.0.1:* http://localhost:*` | `apps/web/next.config.ts`, `apps/web/.env.example` |

## Decisões e riscos

- **Gerenciador de pacotes:** PNPM v11 em monorepo com workspace protocol (`workspace:*`).
- **Next.js & React:** Next.js 15.2.1 App Router + React 19 em modo estritamente local com telemetria desativada.
- **Tipagem & Contratos:** Zod schemas centralizados em `@speclens/openapi-core` e `@speclens/ai-core`.
- **Privacidade Fail-Closed:** `privateMode: true` definido como imutável por padrão em `DEFAULT_CONFIG`; imagens externas e CDN fonts desabilitados.
- **Risco mitigado:** Imagens remotas e domínios externos totalmente bloqueados no `next.config.ts`.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.
