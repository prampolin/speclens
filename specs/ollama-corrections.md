# Plano de correções — Ollama local

**Estado:** OLL-01 a OLL-07 concluídas em 2026-10-12; jornadas mockada e real registradas abaixo.
**Origem:** diagnóstico local de 2026-10-11.  
**Escopo:** correções das fases 03, 07, 09, 10 e 11; não constitui avanço automático de fase.  
**Contrato:** [spec.md](../spec.md), especialmente §§6.3, 7, 8 e FR-012/013/014/017.  
**Workflow:** [AGENTS.md](../AGENTS.md) e [SKILL.md](../SKILL.md).

## 1. Evidência e conflito documental

No diagnóstico, `GET http://127.0.0.1:11434/api/tags` retornou `llama3.2:3b` e `qwen3:8b`. O SpecLens informou `llama3.2:latest` com `ready=true` em `/api/providers`. Uma requisição ao `/api/chat` do Ollama com esse modelo e mensagens vazias retornou HTTP 404: `model 'llama3.2:latest' not found`.

O código no diagnóstico inicial confirmava (registro histórico; as correções abaixo substituem esses comportamentos):

- `packages/ai-core/src/llm/ollama-provider.ts`: readiness aceita a mesma família com outra tag; geração envia o identificador completo. O timeout de readiness não cobre a geração.
- `apps/web/src/lib/server/providers.ts`: instância global de LLM baseada no ambiente/padrão.
- `apps/web/src/app/api/settings/route.ts`: salva settings sem aplicar a seleção à instância usada pelo chat.
- `apps/web/src/app/api/chat/route.ts`: falhas distintas acabam apresentadas como Ollama offline; `finalEmitted` é marcado antes da validação do envelope.
- `start.sh`: pode baixar `llama3.2:3b` implicitamente e aceita qualquer correspondência `llama3` como suficiente.
- `docker-compose.yml`: usa `http://ollama:11434`, rejeitado pelo guard de loopback.

O [plan.md](../plan.md) declara todas as fases concluídas, mas esses comportamentos não atendem integralmente ao contrato funcional. Testes com fetch mockado não comprovam inferência real nem isolamento de rede. Este documento registra a divergência; os gates afetados deverão ser reavaliados com evidências, sem apagar o histórico anterior. O cabeçalho de `spec.md` ainda diz “implementation not started”; esse estado editorial está desatualizado frente ao código e não altera os requisitos normativos. O status atual desta revisão prevalece sobre os checkboxes históricos de integração/air-gap das fases 07, 10 e 11.

## 2. Regras da execução

- Executar uma microtarefa por vez, na ordem abaixo; parar e registrar resultado após cada entrega.
- Consultar o código novamente antes de editar e preservar mudanças preexistentes do usuário.
- Manter `privateMode=true`, sem downloads implícitos, fallback cloud ou execução de snippets.
- Usar somente documentos fictícios nos testes; não registrar consultas, contratos ou segredos reais.
- Não substituir silenciosamente um modelo salvo por outro instalado.
- Distinguir testes determinísticos com mocks de integração com Ollama real e validação de egress.
- Marcar `[x]` somente após executar o teste correspondente. Ausência de ferramenta/modelo implica **NÃO EXECUTADO**, com motivo.

## 3. Tarefas e testes automatizados

### OLL-01 — Identidade exata e padrão consistente

**Dependência:** nenhuma.  
**Arquivos existentes:** `packages/ai-core/src/llm/ollama-provider.ts`, `packages/db/src/settings-schema.ts`, `apps/web/src/lib/config.ts`, `apps/web/src/lib/server/providers.ts`.  
**Testes existentes a ampliar:** `packages/ai-core/tests/ollama-llm.test.ts`, `packages/db/tests/storage-settings.test.ts`.

- [x] Definir `llama3.2:3b` como padrão inicial consistente, eliminando defaults divergentes, inclusive `llama3:latest` do adapter.
- [x] Comparar o identificador completo na disponibilidade; entrada sem tag é normalizada explicitamente para `:latest` tanto na verificação quanto na geração.
- [x] Preservar configurações já persistidas; um modelo inexistente continua selecionado com erro acionável.
- [x] Retornar motivo tipado (`ProviderReadiness.code = MODEL_UNAVAILABLE`) para modelo ausente, estendendo o contrato de readiness já existente.

**Casos obrigatórios:**

- [x] `llama3.2:3b` instalado e selecionado => pronto; payload da geração contém exatamente esse identificador.
- [x] Somente `llama3.2:3b` instalado, seleção `llama3.2:latest` => indisponível.
- [x] Modelo da mesma família com outra quantização/tag não satisfaz a seleção.
- [x] Lista vazia, JSON inválido e falha de conexão retornam motivos distintos e seguros.
- [x] Criar workspace aplica o novo padrão; carregar workspace existente não altera sua seleção.

**Aceite:** nenhum falso positivo por comparação apenas da família do modelo.

### OLL-02 — Resolver a configuração efetiva por workspace

**Dependência:** OLL-01.  
**Arquivos existentes:** `apps/web/src/lib/server/providers.ts`, rotas `api/settings`, `api/providers` e `api/chat`, repositório de settings em `packages/db/src`.  
**Teste novo proposto:** `apps/web/src/__tests__/llm-settings.test.ts`.

- [x] Definir precedência: seleção persistida do workspace > `OLLAMA_MODEL_ID` para inicialização sem seleção persistida > padrão do produto.
- [x] Inspecionar `getOrDefault` para distinguir ausência de registro de settings explicitamente salvos; não inferir intenção apenas porque o valor coincide com um default antigo.
- [x] Validar settings no carregamento e na escrita; rejeitar provider não suportado ou configuração insegura antes de qualquer inferência.
- [x] Criar/resolver o LLM a partir do workspace da requisição; substituir ou invalidar eventual cache por configuração, sem singleton mutável compartilhando seleções.
- [x] Fazer `/api/providers` e a UI consultarem a mesma configuração efetiva que o chat utiliza.
- [x] Manter configuração estável durante cada requisição; alterações passam a valer para a próxima consulta.

**Casos obrigatórios:**

- [x] PATCH do modelo para `qwen3:8b`, seguido de criação do provider, usa o novo modelo sem reiniciar o processo.
- [x] Reabrir um banco temporário em arquivo mantém o modelo selecionado.
- [x] Dois workspaces resolvidos em paralelo mantêm modelos distintos no provider; contexto continua montado no escopo de cada chamada.
- [x] Matriz de precedência cobre seleção persistida, apenas variável de ambiente e ausência de ambos.
- [x] Configuração inválida não sobrescreve settings válidos; tentativa insegura não dispara fetch de geração.
- [x] Status de providers corresponde ao modelo efetivo do workspace.

**Aceite:** selecionar, salvar, consultar e reiniciar preservam a mesma configuração efetiva.

### OLL-03 — Erros, fallback e integridade do stream

**Dependência:** OLL-02.  
**Arquivos existentes:** adapter e schemas de `packages/ai-core/src/llm`, `apps/web/src/app/api/chat/route.ts` e componentes de chat a localizar na implementação.  
**Testes:** ampliar `ollama-llm.test.ts` e `apps/web/src/__tests__/api-routes.test.ts`.

- [x] Preservar códigos e motivos para conexão recusada, modelo ausente, política de privacidade, HTTP inesperado e stream inválido.
- [x] Exibir orientação específica para modelo ausente; não substituir todos os erros pela mensagem de servidor offline.
- [x] Registrar o motivo seguro do fallback nas limitações da resposta final, mesmo após desaparecerem os eventos de progresso.
- [x] Validar o envelope antes de marcar `finalEmitted`; garantir um único resultado final válido quando houver recuperação.
- [x] Definir tratamento de tokens parciais: não promovê-los a resposta validada após falha de parsing ou validação.

**Casos obrigatórios:**

- [x] 404 de modelo produz diagnóstico de modelo ausente e fallback fundamentado no contrato fictício.
- [x] Conexão recusada produz diagnóstico de serviço indisponível.
- [x] Violação de política mantém bloqueio e não tenta outro destino.
- [x] JSON inválido, stream truncado e envelope final inválido não geram final falso nem deixam a UI aguardando indefinidamente.
- [x] Sucesso gera um único final validado por Zod, com fontes existentes e snippets determinísticos.
- [x] Mensagens/logs de erro não contêm sentinelas usadas como consulta, segredo ou conteúdo sensível de fixture.

**Aceite:** usuário consegue distinguir a causa e reconhecer quando a resposta foi produzida sem LLM.

### OLL-04 — Timeout e cancelamento da geração

**Dependência:** OLL-03.  
**Arquivo existente:** `packages/ai-core/src/llm/ollama-provider.ts` e parser do stream.  
**Teste existente:** `packages/ai-core/tests/ollama-llm.test.ts`.

- [x] Aplicar deadline total à geração, incluindo conexão, espera pelo primeiro chunk e leitura do corpo.
- [x] Combinar timeout interno e cancelamento do cliente sem perder a causa original.
- [x] Limpar timers, listeners e leitor do stream em sucesso, erro e cancelamento.
- [x] Não emitir final de sucesso ou continuar inferência após cancelamento.

**Casos obrigatórios com timers falsos e transporte que respeita AbortSignal:**

- [x] Fetch sem resposta aborta no prazo configurado com código de timeout.
- [x] Headers recebidos, corpo travado => timeout interrompe a leitura.
- [x] Abort do cliente antes e durante a geração => cancelamento distinto de timeout.
- [x] Sucesso antes do prazo não recebe erro tardio; nenhuma pendência de timer/listener permanece.

**Aceite:** geração travada termina de forma previsível e cancelamento interrompe o trabalho.

### OLL-05 — Inicialização local sem downloads implícitos

**Dependência:** OLL-01 e OLL-02.  
**Arquivos existentes:** `start.sh`, `scripts/provision-offline.sh`, `README.md`.  
**Teste novo proposto:** `tests/startup.test.ts`.

- [x] Remover `ollama pull` automático do fluxo normal; separar provisionamento explicitamente iniciado pelo usuário.
- [x] Usar endereço e modelo efetivos do bootstrap; verificar cada modelo de workspace quando ele for utilizado.
- [x] Detectar o serviço antes de depender da presença do CLI; serviço existente pode estar ativo mesmo sem `ollama` no PATH.
- [x] Iniciar serviço local ausente quando CLI disponível, com espera limitada e mensagem acionável em caso de falha.
- [x] Encerrar apenas processo criado pelo script, preservando serviço que já estava ativo.
- [x] Documentar o comando único de execução após provisionamento e o comportamento degradado sem modelo.
- [x] No primeiro `./start.sh`, oferecer instalação lockfile-pinned e pull do modelo bootstrap com confirmação explícita; downloads nunca ocorrem silenciosamente ou em execução não interativa.

**Harness proposto:** executar o script com diretório temporário, PATH controlado e executáveis falsos para `ollama`, `curl`, `pnpm` e demais dependências efetivamente chamadas. Isolar a preparação de dependências para não instalar pacotes nem iniciar serviços reais durante a suíte.

**Casos obrigatórios:**

- [x] Serviço ativo => não chama `serve`; modelo correto => inicia aplicação.
- [x] Serviço ausente + CLI presente => inicia uma vez e aguarda prontidão com limite.
- [x] CLI ausente ou modelo ausente => informa motivo, sem executar `pull` ou acessar registries.
- [x] Outra tag da mesma família não é aceita como modelo selecionado.
- [x] Encerramento limpa processo próprio e preserva processo preexistente.

**Aceite:** inicialização reproduzível sem download escondido de modelos.

### OLL-06 — Compatibilidade Docker e proteção de egress

**Dependência:** OLL-01 a OLL-05.  
**Arquivos existentes:** `docker-compose.yml`, `Dockerfile`, `packages/ai-core/src/llm/policy.ts`, `SECURITY.md`, `ARCHITECTURE.md`.  
**Testes:** ampliar `packages/evals/test/security-benchmark.test.ts`; criar `scripts/test-ollama-docker.sh`.

- [x] Registrar decisão arquitetural antes de alterar: preferir topologia em que web e Ollama compartilhem loopback isolado; se inviável no ambiente suportado, documentar alternativa com destino local verificado e restrito.
- [x] Não resolver liberando qualquer hostname, aceitando manifestos como prova ou desativando Private Mode.
- [x] Bloquear redirecionamentos para destinos não permitidos e validar configuração do modelo antes de enviar documentos à inferência; readiness isolado não substitui o guard do caminho de geração.
- [x] Configurar rede sem egress externo na execução privada, exposição da UI apenas no host local e modelos previamente provisionados.
- [x] Usar projeto Compose e volumes temporários exclusivos para testes; nunca derrubar a instalação do usuário.

**Casos obrigatórios:**

- [x] Teste unitário bloqueia host remoto, porta fora da allowlist, redirect externo e modelo cloud/proxy antes de enviar contexto.
- [x] `docker compose config --quiet` valida a configuração final.
- [x] Smoke automatizado com imagens e pesos já presentes sobe serviços com pulls/builds de rede desabilitados e confirma geração local.
- [x] Verificação de rede confirma ausência de rota default, TX restrito às interfaces privadas e bloqueio de tentativa de saída controlada.
- [x] Falha do Ollama no ambiente isolado produz erro específico sem fallback de rede.
- [x] Teardown do script remove apenas recursos do projeto temporário, inclusive após falha do smoke.

**Aceite:** Docker funcional e isolamento comprovado. Mock do transporte sozinho não satisfaz este gate.

### OLL-07 — Jornada automatizada e atualização das evidências

**Dependência:** OLL-01 a OLL-06.  
**Arquivos existentes:** `apps/web/playwright.config.ts`, `apps/web/e2e/foundation.spec.ts`, `scripts/smoke-test.sh`.  
**Novos arquivos:** `apps/web/e2e/ollama-settings.spec.ts`, `scripts/ollama-e2e-fake.mjs`, `scripts/test-ollama-e2e.sh`, `scripts/test-ollama-local.sh`.

- [x] Criar E2E com servidor Ollama falso local, banco temporário e portas efêmeras exclusivas; `reuseExistingServer=false` por padrão.
- [x] Importar fixture fictícia, escolher modelo, salvar, consultar e verificar no servidor falso o modelo recebido.
- [x] Trocar o modelo pela UI, consultar novamente e confirmar atualização sem reinício.
- [x] Simular modelo ausente e validar diagnóstico final visível, fontes e fallback sem POST de inferência.
- [x] Criar smoke opt-in com Ollama real e modelo já instalado: chat do SpecLens confirmou tokens e envelope final com fontes/snippets.
- [x] Executar regressão, lint, build e cenários de privacidade aplicáveis.
- [x] Atualizar `specs/03-storage-settings.md`, `07-ollama-llm.md`, `09-chat-ui.md`, `10-security-evals.md`, `11-release.md` e `plan.md` com os resultados obtidos.

**Aceite:** integração real comprovada; testes que não rodaram permanecem identificados como pendências.

## 4. Comandos e execução

Executar os comandos focados após a tarefa correspondente. Arquivos novos abaixo são propostas e precisam ser implementados antes dos comandos que os referenciam.

```bash
# OLL-01, OLL-03 e OLL-04 — testes existentes a ampliar
pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts
pnpm exec vitest run packages/db/tests/storage-settings.test.ts
pnpm exec vitest run apps/web/src/__tests__/api-routes.test.ts

# OLL-02 e OLL-05 — testes novos propostos
pnpm exec vitest run apps/web/src/__tests__/llm-settings.test.ts
pnpm exec vitest run tests/startup.test.ts
bash -n start.sh

# OLL-06 — suíte existente e smoke novo proposto
pnpm exec vitest run packages/evals/test/security-benchmark.test.ts
docker compose config --quiet
bash scripts/test-ollama-docker.sh

# OLL-07 — E2E e smoke novos propostos
bash scripts/test-ollama-e2e.sh
OLLAMA_MODEL_ID=llama3.2:3b bash scripts/test-ollama-local.sh

# Gate integrado após as correções
pnpm test
pnpm lint
pnpm build
```

Pré-requisitos: dependências locais instaladas; Chromium pré-provisionado para E2E; Docker, imagens e pesos pré-provisionados para smoke Docker; Ollama local com modelo instalado para smoke real. A suíte padrão não deve depender desses serviços. Os scripts opt-in devem falhar com motivo explícito quando faltar pré-requisito, sem baixar nada.

## 5. Registro de execução e conclusão

| Item | Resultado atual | Evidência a anexar |
|---|---|---|
| Diagnóstico inicial | Executado; tag divergente e HTTP 404 confirmados | Respostas locais descritas na seção 1 |
| OLL-01 | EXECUTADO — PASS em 2026-10-11 | `pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts` (23/23) e `pnpm exec vitest run packages/db/tests/storage-settings.test.ts` (20/20), exit code 0; cobre identidade exata, normalização `:latest`, payload, diagnósticos e preservação de settings |
| OLL-02 | EXECUTADO — PASS em 2026-10-11 | `pnpm exec vitest run apps/web/src/__tests__/llm-settings.test.ts apps/web/src/__tests__/api-routes.test.ts` (15/15, exit code 0); cobre precedência e validade ao ler/escrever, isolamento por workspace, persistência em arquivo, readiness por workspace e rejeição antes da geração |
| OLL-03 | EXECUTADO — PASS em 2026-10-11 | Vitest focado (39/39), TypeScript ai-core e web, `git diff --check`; transporte e provider mockados |
| OLL-04 | EXECUTADO — PASS em 2026-10-11 | `pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts` (30/30); `pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json`; `git diff --check` — PASS. Timers falsos e transporte/stream que respeitam AbortSignal. |
| OLL-05 | EXECUTADO — PASS em 2026-10-11 | `pnpm exec vitest run tests/startup.test.ts` (7/7), `bash -n start.sh scripts/provision-offline.sh` e `git diff --check` — PASS. Harness usa PATH controlado e executáveis falsos; não instala dependências nem inicia serviços reais. |
| OLL-06 | PARCIAL — 2026-10-11 | Provider/policy, Compose, benchmark unitário, documentação e script de smoke implementados; Docker smoke tentou executar com acesso elevado, mas parou no pré-requisito: imagem `ollama/ollama:latest` ausente localmente. Pull/build foram evitados. |
| OLL-07 | EXECUTADO — PASS em 2026-10-12 | E2E 1/1; smoke real 29 tokens e final com 1 fonte/3 snippets; regressão 203/203; lint sem erros; build PASS |

Ao finalizar cada item, registrar arquivos alterados, decisão, resultado dos testes, riscos e próximo item. Não armazenar payloads reais nas evidências.

**Riscos conhecidos:** configurações antigas podem continuar selecionando tags ausentes; inferência em hardware local pode exceder timeout inadequado; testes mockados podem ocultar problemas de transporte; mudanças de rede Docker precisam preservar isolamento; scripts de teste não podem compartilhar banco, portas ou volumes de produção.

**Fora do escopo:** corrigir ausência de embeddings, implementar Laya real, adicionar provedores cloud, baixar modelos automaticamente ou executar APIs descritas pelo OpenAPI.

**Decisões OLL-01:** `llama3.2:3b` é o padrão para novos workspaces e inicialização; seleção sem tag vira `:latest`; nomes com tag são comparados integralmente; seleção persistida não é migrada. O contrato `ProviderReadiness` ganhou `code` opcional `MODEL_UNAVAILABLE`. `plan.md` já declara as fases 01–11 concluídas; este roteiro registra correções posteriores sem alterar esse histórico ou avançar fase.

**Decisões OLL-02:** settings persistidas do workspace prevalecem; sem registro, bootstrap usa `OLLAMA_MODEL_ID` ou `llama3.2:3b` e persiste a escolha inicial. GET de settings aplica a mesma resolução. Cada requisição captura settings e instancia o Ollama provider com snapshot imutável; endpoint de readiness recebe `workspaceId`; o provider override permanece exclusivamente como seam de testes. Apenas `ollama-local` é aceito e modelos cloud conhecidos são rejeitados em Private Mode antes do transporte.

**Riscos OLL-02:** não foi executada inferência real contra Ollama; atualização e transporte foram verificados com provider/transporte mockado. A heurística de identificadores cloud complementa, mas não substitui a validação da metadata do Ollama no adapter antes da inferência.

**Decisões OLL-03:** 404 da geração identifica `MODEL_UNAVAILABLE`; erro de conexão identifica `OLLAMA_UNAVAILABLE`; erros de transporte e parsing são resumidos sem incluir conteúdo recebido. Stream sem `done=true` é incompleto. A rota descarta tokens parciais ao gerar fallback, grava a causa segura em `answer.limitations` e valida o envelope antes de marcar o final. A UI substitui o texto parcial pelo final validado.

**Verificações OLL-03:** `pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts apps/web/src/__tests__/api-routes.test.ts` — PASS (39/39). Casos: 404 com fallback e fonte fictícia; conexão recusada; política sem fetch; HTTP 503; JSON inválido; stream sem `done`; envelope inválido recuperado com um único final; sucesso com envelope Zod, fonte e snippets do contrato; sentinelas ausentes dos eventos de erro/status. O consumo integral da resposta SSE nos testes comprova encerramento dos cenários cobertos, mas não substitui teste visual da UI. `pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json` e `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` — PASS; `git diff --check` — PASS. Sem inferência real ou captura de egress nesta microtarefa.

**Riscos OLL-03:** status de erro do Ollama diferente de 404 é classificado genericamente; timeout e cancelamento completos pertencem à OLL-04. Os testes de rota e transporte usam mocks e não substituem o smoke real da OLL-07.

**Verificações OLL-02:** `pnpm exec vitest run apps/web/src/__tests__/llm-settings.test.ts apps/web/src/__tests__/api-routes.test.ts` — PASS (15/15); `git diff --check` — PASS; `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` — NÃO EXECUTADO COM SUCESSO: encontra dois erros preexistentes em `api-routes.test.ts` (eventos token incluindo propriedade `content` fora do contrato). Nenhum dos erros TypeScript aponta para arquivo de implementação OLL-02.

**Riscos OLL-01:** workspaces antigos que selecionam uma tag ausente permanecem indisponíveis até escolha explícita do usuário; não foi executada inferência real contra Ollama (validação coberta por transporte mockado).

**Decisões OLL-04:** deadline de `timeoutMs` inicia antes do POST e usa um AbortController interno; o sinal do cliente é encaminhado sem apagar a causa original, mantendo timeout (`OLLAMA_TIMEOUT`) distinto de cancelamento (`ABORTED`). O parser cancela o reader quando o sinal aborta e sempre remove listener/libera o lock. A conclusão e o envelope validado são impedidos após abort.

**Verificações OLL-04:** `pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts` — PASS (30/30), incluindo fetch sem headers, corpo travado após headers, abort do cliente antes e durante a leitura e sucesso sem timer tardio. `pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json` — PASS; `git diff --check` — PASS. O caminho privado de URL continua coberto pelo teste de policy que garante bloqueio antes do fetch. Sem inferência real ou captura de egress; transporte é controlado no teste e não envia conteúdo externamente.

**Riscos OLL-04:** timeout da geração é configurável e o valor padrão continua 30 segundos; hardware/modelo local pode exigir ajuste. Os testes demonstram cancelamento do transporte mockado que respeita AbortSignal, sem substituir smoke com Ollama real.

**Decisões OLL-05:** `start.sh` não executa instalação de pacotes nem downloads de modelo; `scripts/provision-offline.sh`, invocado explicitamente antes de desconectar a rede, instala dependências travadas com `pnpm install --frozen-lockfile`. O bootstrap usa `OLLAMA_BASE_URL` (restrito aos endereços loopback já permitidos pela policy) e `OLLAMA_MODEL_ID`; tags são comparadas integralmente após a mesma normalização `:latest` do provider. Modelo de workspace continua verificado pelo readiness por workspace ao ser consultado/usado. Sem serviço/CLI/modelo, o app continua em modo degradado; sem `curl`, não inicia um segundo serviço às cegas. O timeout de inicialização é limitado a 1–60 segundos. `start.sh` encerra somente o PID iniciado por ele.

**Verificações OLL-05:** `pnpm exec vitest run tests/startup.test.ts` — PASS (7/7): serviço preexistente preservado; CLI ausente não impede app; serviço novo iniciado uma vez e aguardado; timeout limitado continua em modo degradado; ausência/tag divergente do modelo não gera pull; cleanup encerra processo próprio; destino fora da allowlist é bloqueado antes de curl. Harness controla `PATH`, estado, curl, Ollama e pnpm. `bash -n start.sh scripts/provision-offline.sh` — PASS; `git diff --check` — PASS. Sem download, processo Ollama real ou tráfego externo.

**Riscos OLL-05:** o passo explícito de provisionamento precisa de acesso ao registry npm e ao registry do Ollama quando o usuário escolhe baixar pesos; ele deve ser executado antes de desconectar. A inicialização em si não tenta essas conexões. O teste mockado não confirma inicialização real/inferência Ollama; smoke real e captura de egress permanecem no OLL-06/07. O modelo verificado no bootstrap não substitui a checagem dinâmica de cada workspace.

**Decisão OLL-06:** Compose executa `web` no namespace de rede do serviço Ollama, conectado somente a uma rede `internal: true`. O endereço `127.0.0.1:11434` continua passando pela allowlist privada; apenas a UI é publicada em `127.0.0.1:3000`, na configuração do serviço Ollama. Os caminhos persistentes anteriores (`./data`, `./models`, `./models/ollama`) são preservados como bind mounts padrão, com variáveis para override. Cada geração revalida `/api/tags`, modelo exato e metadata cloud/proxy; `/api/tags` e `/api/chat` usam redirect manual e bloqueiam 3xx antes do envio de contexto. O smoke faz cópia do diretório de modelos fonte para diretórios temporários exclusivos, usa imagem local da aplicação/Ollama e chama Compose com `--pull never --no-build`; teardown é restrito ao projeto aleatório do teste.

**Verificações OLL-06:** `pnpm exec vitest run packages/evals/test/security-benchmark.test.ts packages/ai-core/tests/ollama-llm.test.ts` — PASS (38/38); inclui host remoto, porta não allowlisted, redirect, metadata proxy antes do POST e erro `OLLAMA_UNAVAILABLE` sem destino alternativo. `pnpm --filter @speclens/evals typecheck` e `pnpm exec tsc --noEmit -p packages/ai-core/tsconfig.json` — PASS; `docker compose config --quiet`, `bash -n scripts/test-ollama-docker.sh` e `git diff --check` — PASS. `bash scripts/test-ollama-docker.sh` — NÃO EXECUTADO: Docker daemon acessível com elevação, mas a imagem `ollama/ollama:latest` não está local; o preflight saiu antes de criar containers/volumes e não fez pull/build. Inferência, egress runtime e teardown após subida permanecem sem evidência; OLL-06 não está aceita.

**Pendência registrada antes da revalidação OLL-06:** disponibilizar localmente as imagens `ollama/ollama:latest` e `speclens-web` (ou configurar as tags locais), além do diretório `models/ollama` com o modelo já provisionado; então executar `bash scripts/test-ollama-docker.sh`. A revalidação abaixo confirmou o smoke e o teardown.

**Próxima tarefa (registro de 2026-10-11):** OLL-06, dependente de OLL-01 a OLL-05 concluídas; foi concluída na revalidação em 2026-10-12.

## Revisão do escopo 1–OLL-06 — 2026-10-11

**Resultado naquele registro (2026-10-11):** lacunas de implementação corrigidas; OLL-06 continuava PARCIAL por ausência de imagens Docker locais. OLL-07 ainda não havia iniciado.

- **OLL-02:** o resolver agora valida e persiste a seleção inicial por workspace antes de retornar. Antes, a documentação afirmava persistência, mas o resolver só retornava o bootstrap; um reinício/alteração de ambiente podia mudar a seleção sem PATCH. Teste cobre alteração de ambiente após a primeira resolução. O teste de troca de modelo agora consome o stream inteiro e verifica o `model` do POST, em vez de passar só por um fetch de metadata que falhava. Readiness usa transporte mockado, sem acessar o Ollama pessoal.
- **OLL-03:** configuração privada insegura mantém código `PRIVACY_POLICY_VIOLATION` e mensagem segura no chat; primeiro final validado encerra o provider e impede finais duplicados. Corrigido o teste de HTTP 404 para responder tags válidas e simular 404 realmente em `/api/chat`. Removidos detalhes brutos de erros de transporte/schema/statusText do readiness.
- **OLL-04:** timeout e cancelamento durante o corpo de `/api/tags` preservam a causa; metadata inválida tem diagnóstico próprio. Fechar o iterator após token cancela também o transporte, com limpeza de timer. O timeout não substitui um abort já ocorrido.
- **OLL-06:** allowlist exige origem exata sem credenciais, caminho de proxy, query ou fragmento. Smoke usa porta efêmera loopback, propaga imagens/mounts para todos os comandos Compose, monitora delta TX das interfaces não-loopback durante inferência e executa probe de saída antes de parar Ollama. Teardown só roda após tentativa de subida, verifica recursos remanescentes e falha explicitamente preservando mounts se a remoção falhar. `ECONNREFUSED` não é aceito como prova de isolamento.

**Arquivos alterados nesta revisão:** `packages/ai-core/src/llm/{ollama-provider,policy}.ts`, `packages/ai-core/tests/ollama-llm.test.ts`, `apps/web/src/lib/server/providers.ts`, `apps/web/src/app/api/chat/route.ts`, `apps/web/src/__tests__/{api-routes,llm-settings}.test.ts`, `docker-compose.yml`, `scripts/test-ollama-docker.sh`, `tests/ollama-docker-script.test.ts`, este documento, `plan.md` e notas das fases 07/10/11. A suíte de avaliações também atualizou os baselines locais em `packages/evals/baselines/`.

**Evidências executadas:**

- Suíte focada OLL-01–06: **96/96 PASS**, sete arquivos; inclui startup (7), harness Docker falso (5), storage (20), benchmark/policy (8), provider (38), settings (4), rotas (14).
- Regressão `pnpm test`: **200/200 PASS**, 19 arquivos, antes do teste adicional de final duplicado. Revalidação final: `pnpm exec vitest run packages/ai-core/tests/ollama-llm.test.ts apps/web/src/__tests__/api-routes.test.ts apps/web/src/__tests__/llm-settings.test.ts` — **57/57 PASS** (38 provider, 15 rotas, 4 settings), incluindo final duplicado.
- TypeScript ai-core e web: **PASS**. `pnpm lint`: **PASS**, zero erros e 61 warnings existentes na base atual; não alegamos ausência de warnings.
- `docker compose config --quiet`, `bash -n start.sh scripts/provision-offline.sh scripts/test-ollama-docker.sh` e `git diff --check`: **PASS**.
- Smoke real: preflight executado com Docker acessível; **inferência/monitor/probe/teardown runtime NÃO EXECUTADOS**. Saída 1: imagem `ollama/ollama:latest` ausente. Listagem de imagens também não contém `speclens-web`. Nenhuma imagem foi baixada e nenhum container foi criado.

**Limites:** testes com Docker falso comprovam seleção do projeto, configuração isolada e caminhos de cleanup, não inferência ou isolamento real. O monitor de contadores reprova qualquer TX não-loopback durante a janela da consulta; pode reprovar tráfego incidental e não substitui auditoria geral do host. Build e E2E da OLL-07 não foram executados nesta revisão. Não foi alterado `privateMode=true`, nem executada API documentada.

**Próximo item (registro histórico de 2026-10-11):** provisionar imagens/pesos e rodar o smoke Docker. Essa pendência foi concluída na revalidação OLL-06 de 2026-10-12, registrada abaixo.

## OLL-07 — Jornada automatizada e atualização das evidências — 2026-10-12

**Resultado:** concluída. O E2E passou com servidor Ollama falso, SQLite temporário, porta exclusiva para o mock e porta exclusiva do Next.js. A configuração do Playwright não reutiliza serviços existentes por padrão. A jornada importou uma OpenAPI sintética, salvou e usou os modelos A e B em consultas consecutivas sem reiniciar o app. Ao selecionar modelo ausente, a UI mostrou a limitação de fallback e a fonte OpenAPI, sem enviar POST de inferência para o modelo ausente. `privateMode=true` foi confirmado e a página não emitiu requisições externas.

**Smoke Ollama real:** `OLLAMA_MODEL_ID=llama3.2:3b bash scripts/test-ollama-local.sh` — **PASS**. O script apontou para os pesos já provisionados em `models/ollama/models`, iniciou SpecLens com SQLite temporário, importou fixture sintética e validou 29 eventos de token, envelope final, uma fonte `/smoke-products` e três snippets. O daemon local foi iniciado para a execução e encerrado ao final; não houve pull ou envio de documentação real.

**Regressão e gates:**

- `bash scripts/test-ollama-e2e.sh` — **PASS, 1/1** (Chrome instalado; mock e app em loopback efêmero).
- `pnpm test` — **PASS, 203/203**, 19 arquivos; inclui casos de policy, SSRF, redaction, prompt injection e Docker harness.
- `pnpm lint` — **PASS**, zero erros, 61 warnings preexistentes.
- `pnpm build` — **PASS**; Next.js reportou warnings de dependências dinâmicas já existentes nos providers Laya e Transformers.
- `pnpm exec vitest run tests/startup.test.ts packages/evals/test/security-benchmark.test.ts tests/ollama-docker-script.test.ts` — **PASS, 22/22**.
- `bash -n scripts/test-ollama-e2e.sh scripts/test-ollama-local.sh start.sh scripts/provision-offline.sh scripts/test-ollama-docker.sh`, `node --check scripts/ollama-e2e-fake.mjs` e `git diff --check` — **PASS**.

**Arquivos desta microtarefa:** `apps/web/playwright.config.ts`, `apps/web/e2e/ollama-settings.spec.ts`, `apps/web/src/app/settings/page.tsx`, `apps/web/src/components/chat/{ChatArea,ChatContext}.tsx`, `apps/web/src/lib/server/providers.ts`, `scripts/{ollama-e2e-fake.mjs,test-ollama-e2e.sh,test-ollama-local.sh}`, este documento, `specs/03-storage-settings.md`, `specs/07-ollama-llm.md`, `specs/09-chat-ui.md`, `specs/10-security-evals.md`, `specs/11-release.md` e `plan.md`.

**Decisões e riscos:** a allowlist de origem Ollama pode ser explicitada por `OLLAMA_ALLOWED_BASE_URLS`; `validateOllamaUrl` continua limitando destino efetivo a loopback, sem credenciais, path, query ou fragmento. A UI agora apresenta `answer.limitations` do envelope para que o fallback e seus diagnósticos sejam auditáveis. O E2E usa somente dados sintéticos. O smoke real comprova inferência e contrato, mas não substitui o monitor de egress Docker já registrado na OLL-06.

**Pendências:** nenhuma para OLL-07. Nenhum teste desta tarefa ficou sem execução.

## Revalidação OLL-06 — 2026-10-12

**Resultado:** OLL-06 concluída. `llama3.2:3b` foi baixado explicitamente para `models/ollama`; imagens `ollama/ollama:latest` e `speclens-web:oll06` já estavam locais. Quando `start.sh` inicia seu próprio daemon, configura o armazenamento do Ollama em `./models/ollama/models`, permitindo reutilizar os pesos locais do projeto. O monitor foi ajustado após duas execuções identificarem 42 e 126 bytes em `eth0`, interface da rede Docker interna. A validação final confirmou ausência de rota default, TX somente em interface dessa rede privada e falha da tentativa externa com `ENETUNREACH`.

**Evidências executadas:**

- `pnpm exec vitest run packages/evals/test/security-benchmark.test.ts tests/ollama-docker-script.test.ts` — **PASS, 13/13**. Avalia policy/segurança e o harness com Docker falso; o smoke real abaixo fornece a evidência de isolamento runtime.
- `pnpm exec vitest run tests/startup.test.ts packages/evals/test/security-benchmark.test.ts tests/ollama-docker-script.test.ts` — **PASS, 22/22**, incluindo 9 casos de startup, 8 de segurança e 5 do harness Docker isolado.
- `pnpm lint` — **PASS**, 0 erros e 61 warnings existentes na base.
- `docker compose config --quiet`, `bash -n scripts/test-ollama-docker.sh` e `git diff --check` — **PASS**.
- `docker image ls` — confirmou `ollama/ollama:latest` e `speclens-web:oll06` locais; não houve pull nem build.
- `docker run --rm --pull=never --entrypoint sh --volume "$PWD/models/ollama:/root/.ollama" ollama/ollama:latest ... ollama pull llama3.2:3b` — **PASS**; modelo de aproximadamente 2 GB baixado do registry oficial para o diretório local do projeto. Nenhum documento ou consulta foi enviado.
- `OLLAMA_SOURCE_DIR="$PWD/models/ollama" OLLAMA_MODEL_ID=llama3.2:3b SPECLENS_WEB_IMAGE=speclens-web:oll06 bash scripts/test-ollama-docker.sh` — **PASS**: geração local concluída; sem rota default; delta TX restrito a `eth0` da rede interna; probe de egress bloqueado com `ENETUNREACH`; readiness após parar Ollama reportou erro local específico sem fallback remoto; teardown confirmou remoção do projeto temporário.
- `ollama list` — **NÃO EXECUTADO COM SUCESSO**: serviço Ollama local do host não está rodando. O smoke real usou o daemon/container isolado e os pesos locais provisionados.

**Pendência:** nenhuma para OLL-06 nem OLL-07. A nota de pendência escrita antes da execução OLL-07 foi superada pela jornada e pelas evidências registradas acima.
