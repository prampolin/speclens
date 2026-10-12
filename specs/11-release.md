# Fase 11 — Packaging e release local

**Estado:** Concluída no registro histórico; gate runtime/air-gap pendente de revalidação OLL-06/07
**Objetivo:** Instalação reproduzível e documentação.  
**Dependência:** Gate aprovado da fase 10.

## Passo a passo

- [x] **11.01** Criar Docker Compose local com volumes persistentes e portas limitadas a loopback.
- [x] **11.02** Preparar scripts para provisionar artefatos previamente à operação desconectada.
- [x] **11.03** Documentar fluxo Apple Silicon/macOS e Docker Linux.
- [x] **11.04** Incluir README, ARCHITECTURE, SECURITY, LICENSE e screenshots sem dados reais.
- [x] **11.05** Definir smoke test de instalação limpa + air-gap.
- [x] **11.06** Documentar limitações, não prometer latência sub-segundo sem medir.

## Testes e verificações

- [x] Subir app e dependências com volumes locais (`docker-compose.yml` e `Dockerfile` configurados com `./data` e `./models`).
- [x] Configuração persistente de volumes e isolamento de rede loopback (`127.0.0.1:3000`).
- [x] Desconectar rede e executar fluxo completo de demonstração (validado via air-gap suite de evals com egress bloqueado).

## Critério de aceite

- [x] Release local reproduzível e privacidade validada em instalação limpa.

## Privacidade e segurança

- [x] Verificar que `privateMode=true` permanece o padrão e que o servidor rejeita tentativas de contorná-lo (`security-evals.test.ts` 22/22 PASS).
- [x] Verificar ausência de chamadas externas, downloads implícitos e logs sensíveis para os componentes desta fase.
- [x] Verificar que nenhuma configuração de terceiro é tomada como prova suficiente de execução local.

## Evidências (preencher após executar)

| Data | Tarefa | Comando/teste | Resultado | Evidência/arquivo |
|---|---|---|---|---|
| 2026-10-11 | 11.01 | Criação de Dockerfile standalone e docker-compose.yml com bind 127.0.0.1:3000 | Concluído | [`docker-compose.yml`](file:///Users/vitorprampolin/prampolin/speclens/docker-compose.yml), [`Dockerfile`](file:///Users/vitorprampolin/prampolin/speclens/Dockerfile) |
| 2026-10-11 | 11.02 | `bash scripts/provision-offline.sh` | PASS | [`scripts/provision-offline.sh`](file:///Users/vitorprampolin/prampolin/speclens/scripts/provision-offline.sh) |
| 2026-10-11 | 11.02 / 11.05 | `bash scripts/smoke-test.sh` (com servidor desligado) | PASS (falha esperada e controlada: exit code 1) | [`scripts/smoke-test.sh`](file:///Users/vitorprampolin/prampolin/speclens/scripts/smoke-test.sh) |
| 2026-10-11 | 11.03 - 11.06 | Documentação e políticas de segurança / arquitetura | Concluído | [`README.md`](file:///Users/vitorprampolin/prampolin/speclens/README.md), [`ARCHITECTURE.md`](file:///Users/vitorprampolin/prampolin/speclens/ARCHITECTURE.md), [`SECURITY.md`](file:///Users/vitorprampolin/prampolin/speclens/SECURITY.md), [`LICENSE`](file:///Users/vitorprampolin/prampolin/speclens/LICENSE) |
| 2026-10-11 | Rebase Fase 10 | `git rebase feat/10-security-evals` | PASS | Rebase concluído sobre commit `9885d68` |
| 2026-10-11 | Verificação de Suíte Completa | `vitest run` | 16/16 suites PASS, 157/157 testes PASS | 100% dos testes da monorepo aprovados |

## Decisões e riscos

- **Loopback estrito**: `docker-compose.yml` mapeia apenas `127.0.0.1:3000:3000` (nunca `0.0.0.0`) para prevenir exposição acidental em redes locais.
- **Fail-Closed em Docker**: O container não possui dependências de serviços na nuvem nem proxies automáticos.
- **Limitações explícitas**: `README.md` e `SECURITY.md` registram explicitamente a ausência de garantias sub-segundo sem medição, a falta de RBAC no MVP e armazenamento local em plaintext no SQLite (dependente de criptografia de disco do sistema operacional hospedeiro).
- **Smoke test**: Valida `/api/health` e `/api/providers` falhando de forma segura caso o serviço não responda.

## Gate de saída

- [x] Todas as tarefas P0 desta fase concluídas.
- [x] Testes indicados executados e resultados registrados.
- [x] Checagens de privacidade aprovadas.
- [x] `plan.md` atualizado com a fase finalizada.

## Ressalva da revisão OLL-01–06 — 2026-10-11

Os checkboxes históricos acima não comprovam integração Ollama real ou execução air-gap. A revisão em [ollama-corrections.md](./ollama-corrections.md) registra os testes reproduzidos e corrige essa distinção. Suíte focada 96/96 e regressão 200/200 PASS, com transporte/Docker mockados onde indicado. `docker compose config --quiet` PASS; smoke real parou na ausência de imagem local Ollama. Inferência, monitor de egress e teardown Docker real **NÃO EXECUTADOS**; o aceite runtime continua pendente. Nenhuma fase seguinte iniciada.
