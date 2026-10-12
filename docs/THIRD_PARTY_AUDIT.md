# Auditoria de Licenças e Dependências — 2UU (SpecLens)

> **Aviso Legal:** Este documento constitui uma auditoria técnica de conformidade de engenharia de software e segurança de dependências. Não constitui aconselhamento jurídico formal ou certificação advocatícia.

---

## Sumário Executivo

Esta auditoria analisa a conformidade legal, os riscos de propriedade intelectual e a viabilidade de distribuição pública em código aberto (open source) do projeto **2UU** (desenvolvido no repositório como SpecLens) sob a licença **MIT**, com ênfase na integração de modelos de inteligência artificial locais (Laya, Ollama, Transformers), bibliotecas de terceiros e arquivos do repositório.

### Conclusões Objetivas

1. **O 2UU pode ser distribuído na configuração atual?**
   **PARCIALMENTE / COM RESSALVAS CRÍTICAS ANTES DO PUSH PÚBLICO.**
   - O código-fonte autoral e as bibliotecas em JavaScript/TypeScript possuem alta compatibilidade jurídica (majoritariamente MIT, Apache-2.0, ISC e BSD).
   - **Bloqueio Crítico Operacional:** Foram detectados arquivos de banco de dados SQLite Write-Ahead Log (`apps/web/.speclens/speclens.db-shm` e `apps/web/.speclens/speclens.db-wal`) atualmente rastreados pelo Git. Esses arquivos contêm estado de migrações locais e devem ser removidos do índice do Git e purgados antes da publicação para evitar vazamento de dados locais ou corrupção de estado.
   - **Reserva do Laya e Pesos de IA:** Nenhum peso binário de IA está commitado no repositório, o que é excelente para distribuição e evita problemas de licenças binárias proprietárias. O Laya está integrado apenas como um adaptador de contrato (*honest stub*).

2. **Quais componentes estão legalmente liberados?**
   - **CONFIRMADO:** Todas as 11 dependências diretas de produção (`@apidevtools/swagger-parser`, `yaml`, `zod`, `better-sqlite3`, `clsx`, `lucide-react`, `next`, `react`, `react-dom`, `shiki`, `tailwind-merge`).
   - **CONFIRMADO:** As 14 dependências diretas de desenvolvimento (`eslint`, `prettier`, `typescript`, `vitest`, `@playwright/test`, `tailwindcss`, etc.).
   - **CONFIRMADO:** Código-fonte do Laya upstream (`NandhaKishorM/laya`) e seus pesos oficiais no Hugging Face (`convaiinnovations/laya` e `convaiinnovations/laya-multilingual`), ambos sob **Apache License 2.0**.
   - **CONFIRMADO:** Mecanismo SQLite embutido no `better-sqlite3` (Dedicado ao Domínio Público / Public Domain).

3. **Quais componentes exigem verificação adicional ou atenção?**
   - **REQUER ATENÇÃO — Dependência LGPL-3.0-or-later:** `@img/sharp-libvips-darwin-arm64` (transitiva opcional puxada por `next` via `sharp`). Exige conformidade com a LGPL-3.0 caso imagens Docker compiladas sejam distribuídas publicamente.
   - **REQUER ATENÇÃO — Llama 3.2 Community License:** O modelo padrão sugerido em documentação e scripts de inicialização (`llama3.2:3b`) possui licença customizada da Meta (não OSI) com cláusulas de restrição de uso aceitável (AUP) e limite de 700M usuários ativos mensais.
   - **REQUER ATENÇÃO — Arquivos Locais no Git:** `apps/web/.speclens/speclens.db-shm` e `speclens.db-wal`.
   - **REQUER ATENÇÃO — CC-BY-4.0:** `caniuse-lite` (transitivo) exige preservação de atribuição aos autores da base de dados.

4. **Quais mudanças são recomendadas antes da publicação?**
   - Remover os arquivos SQLite (`.db-shm`, `.db-wal`) do índice do Git (`git rm --cached`) e assegurar que `.speclens/` esteja presente no `.gitignore`.
   - Publicar o arquivo `THIRD_PARTY_LICENSES.md` com a relação de atribuições e avisos de direitos autorais de terceiros.
   - Documentar explicitamente a política *Bring Your Own Model* (BYOM), alertando que o download de modelos como Llama 3.2 implica concordância com os termos de licença de seus respectivos autores.
   - Se distribuir imagens Docker pré-construídas, incluir avisos de licença para libvips (LGPL-3.0) ou desabilitar o empacotamento do `sharp` caso a otimização dinâmica de imagens não seja estritamente requerida no contêiner.

5. **Qual estratégia de distribuição é recomendada?**
   - **Estratégia C (Desacoplada / Bring Your Own Model — BYOM):** Manter o repositório 100% livre de pesos binários de modelos e sem downloads automáticos em runtime, operando com o classificador baseado em regras locais e permitindo que o usuário provisione modelos locais (Laya, Ollama) via comandos explícitos (`scripts/provision-offline.sh`).

---

## 1. Inventário Completo de Dependências e Componentes

### 1.1 Dependências de Runtime (Produção — Diretas)

Todas as dependências diretas de produção foram verificadas diretamente no manifesto dos pacotes e no gerenciador de pacotes `pnpm`.

| Componente | Versão Resolvida | Licença | Autor / Mantenedor | Uso Comercial | Redistribuição | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `@apidevtools/swagger-parser` | 10.1.1 | **MIT** | James Messinger | Sim | Sim | **CONFIRMADO** |
| `yaml` | 2.9.1 | **ISC** | Eemeli Aro | Sim | Sim | **CONFIRMADO** |
| `zod` | 3.25.76 | **MIT** | Colin McDonnell | Sim | Sim | **CONFIRMADO** |
| `better-sqlite3` | 11.10.0 | **MIT** (SQLite: Public Domain) | Joshua Wise | Sim | Sim | **CONFIRMADO** |
| `clsx` | 2.1.1 | **MIT** | Luke Edwards | Sim | Sim | **CONFIRMADO** |
| `lucide-react` | 0.475.0 | **ISC** | Eric Fennis | Sim | Sim | **CONFIRMADO** |
| `next` | 15.2.1 | **MIT** | Vercel, Inc. | Sim | Sim | **CONFIRMADO** |
| `react` | 19.3.0 | **MIT** | Meta Platforms, Inc. | Sim | Sim | **CONFIRMADO** |
| `react-dom` | 19.3.0 | **MIT** | Meta Platforms, Inc. | Sim | Sim | **CONFIRMADO** |
| `shiki` | 4.5.0 | **MIT** | Pine Wu | Sim | Sim | **CONFIRMADO** |
| `tailwind-merge` | 3.7.0 | **MIT** | Dany Castillo | Sim | Sim | **CONFIRMADO** |

---

### 1.2 Dependências de Desenvolvimento (Diretas)

| Componente | Versão Resolvida | Licença | Mantenedor | Status |
| :--- | :--- | :--- | :--- | :---: |
| `@eslint/js` | 9.39.5 | **MIT** | ESLint Team | **CONFIRMADO** |
| `@types/node` | 22.20.5 | **MIT** | DefinitelyTyped | **CONFIRMADO** |
| `eslint` | 9.39.5 | **MIT** | Nicholas C. Zakas | **CONFIRMADO** |
| `prettier` | 3.9.9 | **MIT** | James Long / Prettier Team | **CONFIRMADO** |
| `typescript` | 5.9.3 | **Apache-2.0** | Microsoft Corp. | **CONFIRMADO** |
| `typescript-eslint` | 8.71.1 | **MIT** | typescript-eslint Team | **CONFIRMADO** |
| `vitest` | 3.2.7 | **MIT** | Anthony Fu / Vitest Team | **CONFIRMADO** |
| `@types/better-sqlite3` | 7.6.13 | **MIT** | DefinitelyTyped | **CONFIRMADO** |
| `@playwright/test` | 1.64.0 | **Apache-2.0** | Microsoft Corporation | **CONFIRMADO** |
| `@types/react` | 19.3.0 | **MIT** | DefinitelyTyped | **CONFIRMADO** |
| `@types/react-dom` | 19.3.0 | **MIT** | DefinitelyTyped | **CONFIRMADO** |
| `autoprefixer` | 10.6.1 | **MIT** | Andrey Sitnik | **CONFIRMADO** |
| `postcss` | 8.4.31 | **MIT** | Andrey Sitnik | **CONFIRMADO** |
| `tailwindcss` | 3.4.19 | **MIT** | Tailwind Labs | **CONFIRMADO** |

---

### 1.3 Dependências Transitivas: Distribuição de Licenças

A varredura completa da árvore transitiva gerada pelo `pnpm-lock.yaml` (totalizando 358 pacotes únicos no lockfile) identificou as seguintes categorias de licenciamento:

1. **Licenças Permissivas Predominantes:**
   - **MIT:** 279 pacotes (ex.: React, Next.js, Zod, Shikijs, SWC crates, Vitest).
   - **Apache-2.0:** 25 pacotes (ex.: TypeScript, Playwright, `@img/sharp-darwin-arm64`, Sharp, ESLint core).
   - **ISC:** 19 pacotes (ex.: `lucide-react`, `yaml`, `picocolors`, `semver`).
   - **BSD-2-Clause:** 6 pacotes (`eslint-scope`, `espree`, `esrecurse`, `estraverse`, `esutils`, `uri-js`).
   - **BSD-3-Clause:** 4 pacotes (`esquery`, `fast-uri`, `ieee754`, `source-map-js`).
   - **0BSD:** 1 pacote (`tslib`).
   - **BlueOak-1.0.0:** 1 pacote (`minimatch`).
   - **Python-2.0:** 1 pacote (`argparse` v2.0.1 - porte puro em JS da biblioteca de argumentos do Python).
   - **Dupla Licença:** `expand-template` (MIT ou WTFPL); `rc` (BSD-2-Clause, MIT ou Apache-2.0).

2. **Licenças de Dados / Conteúdo:**
   - **CC-BY-4.0:** 1 pacote (`caniuse-lite` v1.0.30001815) — utilizado para compatibilidade de CSS em navegadores.

3. **Licenças Copyleft Fraco (Atenção):**
   - **LGPL-3.0-or-later:** 1 pacote (`@img/sharp-libvips-darwin-arm64` v1.0.4) — binário do libvips empacotado como dependência opcional do `sharp` para processamento de imagens no Next.js.

---

### 1.4 Dependências Python

- **Dependências de Produção em Python:** **NENHUMA**. O projeto não utiliza Python no backend nem em microsserviços em produção.
- **Ambiente de Build Docker (`Dockerfile`):** O comando `apt-get install -y python3 make g++` é executado temporariamente no estágio intermediário `deps` exclusivamente como ferramenta de compilação C/C++ para o `node-gyp` (compilação do módulo nativo `better-sqlite3`). Esse binário do interpretador Python não é propagado para o estágio final de execução (`runner`), que usa exclusivamente a imagem base `node:24-slim`.

---

### 1.5 Binários, Executáveis e Artefatos Pré-Compilados

1. **`better-sqlite3` (`better_sqlite3.node`):**
   - Módulo nativo C++ compilado dinamicamente durante o `pnpm install` contra o código fonte do SQLite.
   - O código SQLite é expressamente dedicado ao **Domínio Público** (*Public Domain*), sem restrições de uso, cópia, modificação ou comercialização.
2. **`@next/swc-*`:**
   - Binários pré-compilados em Rust para transpilação e bundling do Next.js. Licenciados sob **Apache-2.0**.
3. **`@img/sharp-libvips-*`:**
   - Binário compilado da biblioteca gráfica `libvips` sob **LGPL-3.0-or-later**.
4. **Arquivos SQLite Rastreando no Repositório:**
   - Arquivos `apps/web/.speclens/speclens.db-shm` e `apps/web/.speclens/speclens.db-wal` estão rastreados no Git por acidente. Não são código de terceiros, mas sim resíduos de testes locais.

---

## 2. Investigação Aprofundada do Laya

| Questão | Resultado da Investigação | Evidência Técnica |
| :--- | :--- | :--- |
| **Como está integrado ao 2UU?** | Via adaptador tipado (`LayaLocalProvider`) que implementa a interface `DecisionProvider`. Integrado ao `DecisionOrchestrator` com fallback automático para regras determinísticas (`RuleDecisionProvider`). | `packages/ai-core/src/providers/decision/laya-local.ts` |
| **Código-fonte do Laya está incluído?** | **NÃO.** O código do projeto Laya original não foi copiado nem embutido no repositório. O arquivo existente é uma classe TypeScript original do 2UU. | Inexistência de arquivos externos ou submódulos Git |
| **Pesos do modelo estão incluídos?** | **NÃO.** Os diretórios `models/laya/` e `.speclens/models/` estão vazios e devidamente listados no `.gitignore`. | `find models`, verificação do arquivo `.gitignore` |
| **O projeto baixa arquivos automaticamente?** | **NÃO.** O projeto opera sob a diretriz `privateMode=true`, com verificação explícita que bloqueia downloads silenciosos e exige arquivos prévios no disco. | `packages/ai-core/src/providers/embedding/transformers-local.ts` e `scripts/provision-offline.sh` |
| **Qual versão/checkpoint está configurado?** | `convaiinnovations/laya` (inglês) e `convaiinnovations/laya-multilingual` (multilíngue v1.0). | `packages/db/src/settings-schema.ts`, `spec.md:421` |
| **Qual licença se aplica ao código do Laya?** | **Apache License 2.0**. | Repositório oficial: [NandhaKishorM/laya](https://github.com/NandhaKishorM/laya) |
| **Qual licença se aplica aos pesos do modelo?** | **Apache License 2.0**. | Model Card Hugging Face: [convaiinnovations/laya](https://huggingface.co/convaiinnovations/laya) e [convaiinnovations/laya-multilingual](https://huggingface.co/convaiinnovations/laya-multilingual) |
| **Restrições de redistribuição de pesos?** | A Apache 2.0 autoriza redistribuição (inclusive comercial), desde que mantidos avisos de copyright e arquivo NOTICE. No entanto, o envio de pesos (~400MB a ~1GB) para o Git viola boas práticas do GitHub e cotas de repositório. | Termos da Licença Apache 2.0, Cláusula 4 |

---

## 3. Matriz de Compatibilidade Jurídica

Esta matriz analisa as categorias de licenças presentes em relação à distribuição do 2UU sob a licença **MIT**:

| Categoria de Licença | Permite Uso Comercial? | Permite Redistribuição? | Exige Atribuição? | Exige Código-Fonte Aberto (Copyleft)? | Necessita LICENSE / NOTICE? | Compatibilidade com MIT do 2UU | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MIT** | Sim | Sim | Sim | Não | Sim | 100% Compatível | **CONFIRMADO** |
| **ISC** | Sim | Sim | Sim | Não | Sim | 100% Compatível | **CONFIRMADO** |
| **Apache-2.0** | Sim | Sim | Sim | Não | Sim (Preservar NOTICE) | Compatível (Subcomponente / Dep) | **CONFIRMADO** |
| **BSD-2-Clause** | Sim | Sim | Sim | Não | Sim | 100% Compatível | **CONFIRMADO** |
| **BSD-3-Clause** | Sim | Sim | Sim (Sem endosso promocional) | Não | Sim | 100% Compatível | **CONFIRMADO** |
| **0BSD / BlueOak-1.0.0** | Sim | Sim | Opcional | Não | Não | 100% Compatível | **CONFIRMADO** |
| **Python-2.0** | Sim | Sim | Sim | Não | Sim | 100% Compatível | **CONFIRMADO** |
| **CC-BY-4.0** | Sim | Sim | Sim | Não | Sim | Compatível (Dados de compatibilidade) | **CONFIRMADO** |
| **Public Domain (SQLite)** | Sim | Sim | Não | Não | Não | 100% Compatível | **CONFIRMADO** |
| **LGPL-3.0-or-later** (libvips) | Sim | Sim | Sim | Sim (Apenas para a libvips se modificada) | Sim (Texto da LGPL e instruções de relink) | Compatível via linkagem dinâmica | **REQUER ATENÇÃO** |
| **Llama 3.2 Community License** | Condicional (<700M MAU) | Não redistribuir no repo | Sim ("Built with Llama") | Não | Sim | O 2UU não distribui o modelo | **REQUER ATENÇÃO** |

---

## 4. Avaliação Arquitetural de Distribuição do Laya

Avaliamos as três alternativas de arquitetura para a distribuição do modelo de classificação Laya no 2UU:

| Critério | Opção A: Laya Embutido no 2UU (Pesos no Git/NPM) | Opção B: Download Automático na Instalação (Postinstall/Boot) | Opção C: Instalação Separada / BYOM (Estratégia Recomendada) |
| :--- | :--- | :--- | :--- |
| **Licenciamento** | Complexo. Mistura código MIT com pesos Apache 2.0 e exige gestão de avisos de atribuição volumosos. | Médio. Transfere download para o usuário final, mas introduz termos de terceiros no processo de setup. | **Excelente**. O 2UU distribui exclusivamente seu código-fonte autoral MIT. Isenta o projeto de licenças de terceiros sobre pesos. |
| **Experiência do Usuário (UX)** | Clone extremamente lento; falha potencial em conexões lentas. | Instalação longa, frágil e sujeita a quebra caso a rede/Hugging Face falhe. | **Consistente**. O sistema funciona imediatamente usando regras locais (`RuleDecisionProvider`), sem surpresas. |
| **Privacidade e Modo Offline** | Totalmente offline, mas contraria a premissa de distribuição enxuta. | **VIOLAÇÃO GRAVE**: Quebra o princípio fundamental de `privateMode=true` do projeto ao conectar sem consentimento explícito. | **Perfeito**. Respeita o modo privado "fail-closed". Zero chamadas remotas sem autorização explícita. |
| **Facilidade de Manutenção** | Péssima. Cada atualização de modelo gera gigabytes no histórico Git permanente. | Ruim. Requer manutenção contínua de scripts de download, URLs e tokens. | **Alta**. Código e pesos são desacoplados; modelos podem ser atualizados independentemente. |
| **Tamanho da Distribuição** | Inviável (~500MB a 1.5GB apenas de binários no Git/pacote). | Repositório leve, mas consome largura de banda imprevisível na máquina do usuário. | **Excelente**. Repositório ultraleve (< 20MB de código-fonte). Clone e build em poucos segundos. |

### Decisão Arquitetural Recomendada: **Opção C (Desacoplamento / BYOM)**

O 2UU já possui arquitetado o `DecisionOrchestrator`, que garante funcionamento determinístico via `RuleDecisionProvider` (regras regex multilíngues) sem requerer pesos de IA para iniciar. A recomendação enfática é:
1. **Não commitar pesos de modelo no repositório.**
2. **Não realizar downloads automáticos durante a instalação ou inicialização.**
3. Manter o script explícito `scripts/provision-offline.sh` para que desenvolvedores que desejem o modelo neural possam baixá-lo voluntariamente em um ambiente com conexão antes de operar offline.

---

## 5. Riscos Identificados e Ações Mitigatórias

### Risco 1: Presença de Artefatos SQLite Rastreando no Repositório
- **Severidade:** **ALTA (Operacional / Higiene)**
- **Detalhes:** Os arquivos `apps/web/.speclens/speclens.db-shm` e `apps/web/.speclens/speclens.db-wal` estão atualmente rastreados pelo Git (`git ls-files`). Eles contêm registros de operações e migrações locais executadas durante o desenvolvimento.
- **Ação Mitigatória:** Antes do push público no GitHub, executar `git rm --cached apps/web/.speclens/speclens.db-shm apps/web/.speclens/speclens.db-wal` e garantir que o padrão `**/.speclens/` esteja configurado no `.gitignore`.

### Risco 2: Dependência Transitiva LGPL-3.0 (`libvips`) em Imagens Docker
- **Severidade:** **MÉDIA**
- **Detalhes:** O pacote `@img/sharp-libvips-darwin-arm64` (e seus correspondentes Linux em containers) possui licença LGPL-3.0. Ao compilar uma imagem Docker (`Dockerfile`) contendo a pasta `node_modules` com o `sharp`, essa imagem passa a conter binários LGPL.
- **Ação Mitigatória:** A LGPL-3.0 permite redistribuição comercial de binários vinculados dinamicamente desde que seja incluído o texto da licença LGPL e as instruções/capacidade de o usuário substituir a biblioteca `libvips`. Caso a aplicação não dependa estritamente de processamento avançado de imagens, o Next.js pode operar sem o pacote opcional `sharp` ou deve-se documentar o uso da LGPL no `THIRD_PARTY_LICENSES.md`.

### Risco 3: Dependência Transitiva CC-BY-4.0 (`caniuse-lite`)
- **Severidade:** **BAIXA**
- **Detalhes:** O pacote `caniuse-lite` é licenciado sob Creative Commons Attribution 4.0.
- **Ação Mitigatória:** Incluir o aviso de atribuição aos mantenedores do projeto Browserslist / Can I Use no arquivo `THIRD_PARTY_LICENSES.md`.

---

## 6. Recomendações Práticas para Publicação no GitHub

1. **Higienização de Repositório Git:**
   - Remover os arquivos `.speclens/speclens.db-*` do rastreamento Git.
   - Garantir que diretórios de dados temporários (`data/`, `models/`, `.speclens/`) permaneçam estritamente ignorados.

2. **Inclusão do Arquivo de Licenças de Terceiros:**
   - Adicionar o arquivo `THIRD_PARTY_LICENSES.md` na raiz do repositório contendo os avisos e textos de licenças das dependências distribuídas, cumprindo a exigência de atribuição das licenças MIT, Apache-2.0, ISC e BSD.

3. **Clareza no README e Documentação de IA:**
   - Documentar que o 2UU é fornecido sob licença MIT.
   - Informar expressamente que modelos de IA utilizados opcionalmente (Laya sob Apache-2.0; Llama sob Meta Community License) são produtos de terceiros e estão sujeitos aos seus próprios termos de licenciamento e uso responsável.

---

## 7. Proposta de Conteúdo para `THIRD_PARTY_LICENSES.md`

Abaixo apresentamos a proposta textual completa pronta para inclusão no arquivo `THIRD_PARTY_LICENSES.md`:

```markdown
# Third-Party Software Licenses and Notices

This project, 2UU, is licensed under the MIT License.
Below is an inventory of third-party software, libraries, and components utilized directly or transitively by this project, along with their respective licenses and attribution notices.

---

## 1. Direct Production Dependencies

### @apidevtools/swagger-parser
- **Version:** 10.1.1
- **License:** MIT
- **Copyright:** (c) James Messinger
- **Repository:** https://github.com/APIDevTools/swagger-parser

### better-sqlite3
- **Version:** 11.10.0
- **License:** MIT (Embedded SQLite is dedicated to the Public Domain)
- **Copyright:** (c) Joshua Wise
- **Repository:** https://github.com/WiseLibs/better-sqlite3

### clsx
- **Version:** 2.1.1
- **License:** MIT
- **Copyright:** (c) Luke Edwards
- **Repository:** https://github.com/lukeed/clsx

### lucide-react
- **Version:** 0.475.0
- **License:** ISC
- **Copyright:** (c) Eric Fennis, Lucide Contributors
- **Repository:** https://github.com/lucide-icons/lucide

### next
- **Version:** 15.2.1
- **License:** MIT
- **Copyright:** (c) Vercel, Inc.
- **Repository:** https://github.com/vercel/next.js

### react / react-dom
- **Version:** 19.3.0
- **License:** MIT
- **Copyright:** (c) Meta Platforms, Inc. and affiliates
- **Repository:** https://github.com/facebook/react

### shiki
- **Version:** 4.5.0
- **License:** MIT
- **Copyright:** (c) Pine Wu, Anthony Fu
- **Repository:** https://github.com/shikijs/shiki

### tailwind-merge
- **Version:** 3.7.0
- **License:** MIT
- **Copyright:** (c) Dany Castillo
- **Repository:** https://github.com/dcastil/tailwind-merge

### yaml
- **Version:** 2.9.1
- **License:** ISC
- **Copyright:** (c) Eemeli Aro
- **Repository:** https://github.com/eemeli/yaml

### zod
- **Version:** 3.25.76
- **License:** MIT
- **Copyright:** (c) Colin McDonnell
- **Repository:** https://github.com/colinhacks/zod

---

## 2. Artificial Intelligence Models and Runtimes (Bring Your Own Model - BYOM)

The 2UU repository does NOT distribute binary weights for artificial intelligence models. Users may provision the following models locally:

### Laya Model (convaiinnovations/laya & convaiinnovations/laya-multilingual)
- **Author:** ConvAI Innovations / NandhaKishorM
- **License:** Apache License 2.0
- **Upstream Code:** https://github.com/NandhaKishorM/laya
- **Model Checkpoints:** https://huggingface.co/convaiinnovations/laya

### Llama 3.2 (Meta)
- **Provider:** Meta Platforms, Inc.
- **License:** Llama 3.2 Community License Agreement
- **Use Restrictions:** Subject to Meta's Acceptable Use Policy and monthly active user limitations.
- **Repository:** https://github.com/meta-llama/llama-models

---

## 3. Special Licenses and Notices

### caniuse-lite
- **License:** Creative Commons Attribution 4.0 International (CC-BY-4.0)
- **Copyright:** (c) Alexis Deveria, Ben Briggs
- **Notice:** This project incorporates browser support data from Can I Use (caniuse.com).

### libvips (@img/sharp-libvips-*)
- **License:** GNU Lesser General Public License v3.0 or later (LGPL-3.0-or-later)
- **Copyright:** (c) John Cupitt, libvips contributors
- **Notice:** libvips is dynamically linked and utilized via sharp/next for optional image optimization. Users may obtain the source code of libvips at https://github.com/libvips/libvips.

---

## 4. Full License Texts

### MIT License
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### ISC License
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### Apache License 2.0 (Summary)
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
