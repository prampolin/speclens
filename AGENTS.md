# SpecLens — AGENTS.md

## Missão
Construir o SpecLens conforme [`spec.md`](./spec.md), [`plan.md`](./plan.md) e as tarefas de `specs/` sem perder privacidade, rastreabilidade ou fidelidade ao OpenAPI.

## Obrigatório antes de qualquer alteração
1. Ler `spec.md`, `plan.md`, a fase atual em `specs/NN-*.md` e `SKILL.md`.
2. Conferir se a tarefa pertence à fase atual, se suas dependências foram concluídas e se o escopo está explícito.
3. Consultar a estrutura/código real antes de alterar. Não presumir que arquivos, serviços ou modelos existem.
4. Se houver inconsistência entre documentos, anotar o conflito e usar `spec.md` como contrato funcional; nunca mudar escopo silenciosamente.

## Forma de trabalhar
- Uma tarefa pequena por vez, sem iniciar fase seguinte automaticamente.
- Fazer a menor mudança suficiente, adicionar teste e executar os comandos aplicáveis.
- Não marcar `[x]` sem evidência de execução; quando teste não rodou, registrar **NÃO EXECUTADO** e motivo.
- Atualizar checklist da fase e `plan.md` somente após validação.
- Sempre informar: arquivos alterados, decisões, testes, riscos, próximo item.
- Preferir código tipado, Zod nas fronteiras, interfaces substituíveis e SDKs diretos.
- Não introduzir LangChain, dependência cloud ou telemetria sem decisão arquitetural explícita.

## Segurança / privacidade (falhar fechado)
- Configuração inicial: `privateMode=true`, embeddings locais, `decision=laya`, `llm=ollama`.
- No privado: bloquear endpoints remotos, proxies cloud, downloads automáticos, `$ref` remoto e qualquer saída de documentos/consultas/embeddings/contexto.
- Não confiar apenas em manifestos fornecidos por plugins nem no prefixo `localhost`; verificar destino efetivo e configuração do modelo.
- Não persistir segredos em logs, dados de avaliação, exemplos, banco de configurações ou repositório.
- Nunca executar snippets gerados ou chamar APIs documentadas sem novo escopo e autorização.
- Sanitizar caminhos, limites de arquivo, carga de YAML/JSON e conteúdo de prompt injection.

## Contratos de IA
- Provedores: `EmbeddingProvider`, `DecisionProvider`, `LLMProvider` e `ProviderManifest` versionados.
- Vetores compatíveis exigem mesmo modelo/revisão/dimensões/pré-processamento; mudança de embedding => novo índice.
- Classificação Laya usa pequeno enum fixo, confiança quando disponível e fallback local por regras.
- Resposta do Ollama é baseada em fontes e validada por schema; material OpenAPI nunca é instrução do sistema.
- Gerador cURL/fetch/Python é determinístico e só utiliza operações/schemas canônicos.

## Conclusão da tarefa
- [ ] Testes relevantes executados e anotados.
- [ ] `privateMode=true` preservado e novas rotas cobertas por verificação de egress.
- [ ] Nenhuma informação inventada como parte do contrato da API.
- [ ] `specs/NN-*.md` atualizado com evidência, riscos e pendências.
- [ ] `plan.md` atualizado, sem avançar de fase sem gate aprovado.
