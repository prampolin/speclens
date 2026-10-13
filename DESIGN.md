# SpecLens — Diretrizes de design

**Data:** 2026-10-12 · **Status:** proposta visual para implementação futura.

## 1. Objetivo e escopo

Reformular a aparência do SpecLens com forte inspiração na composição do Codex apresentada na imagem `index.png` fornecida pelo usuário: superfícies escuras neutras, navegação compacta à esquerda, conversa como foco e campo de entrada amplo no rodapé. Manter identidade e nome SpecLens.

Este documento define aparência e comportamento visual; não implementa a interface nem aprova gates. O contrato funcional continua sendo [spec.md](./spec.md). A fase corrente é a [Fase 12](./specs/12-rag-reliability.md), com RAG-01 pendente. Esta documentação foi solicitada separadamente; requisitos de estados efetivos dependem de RAG-04 a RAG-08 e não devem ser simulados pelo frontend.

Referência: imagem de 1366 × 768 fornecida nesta conversa. As medidas e cores abaixo são decisões de design aproximadas, não tokens oficiais do Codex. O documento é autossuficiente e não depende do caminho da imagem no computador do autor.

## 2. Direção visual

- Priorizar silêncio visual, alinhamento e espaço livre. A área central deve parecer um ambiente de trabalho, sem banners promocionais ou grandes cartões de boas-vindas.
- Usar cinzas neutros em camadas, substituindo o fundo azulado atual. Reservar cor para estados, foco e pequenos identificadores de métodos HTTP.
- Distinguir regiões principalmente pelo fundo e espaçamento. Bordas discretas apenas onde ajudam a separar controles, código e painéis.
- Concentrar ações contextuais perto do conteúdo. Evitar repetir nome do produto, privacidade e provedores em vários cartões.
- Manter fontes, versão ativa, indisponibilidade e erros legíveis. Minimalismo não pode ocultar evidência necessária à resposta.
- Não copiar logotipo, marca ou controles sem função. O sino e o avatar da referência não justificam adicionar notificações, conta ou sincronização ao produto.

## 3. Composição da tela

```text
┌──────┬──────────────────────┬──────────────────────────────────┐
│ Chat │ Workspaces           │ Contexto ativo / modo privado    │
│ Ajust│ Projeto selecionado  │                                  │
│      │   API · versão       │ Conversa e fontes                │
│      │   Estado de índice   │                     ┌────────────┤
│      │                      │                     │ Inspector  │
│      │ Importar OpenAPI     │                     │ sob demanda│
│      │ Filtros              │                     └────────────┤
│      │                      │ [ Pergunte sobre sua API…       ]│
│      │                      │ [ Decisão · LLM          Enviar ]│
└──────┴──────────────────────┴──────────────────────────────────┘
```

| Região | Diretriz desktop |
|---|---|
| Moldura externa | Cinza médio escuro; respiro de 8 px ao redor do painel quando houver espaço |
| Trilho de navegação | 52 px; ícones de conversa e configurações no topo; botão ativo de 36 × 36 px |
| Sidebar | 204 px iniciais, ajustável visualmente até 260 px conforme conteúdo; recolhível |
| Painel principal | Ocupa o restante; raio externo de 12 px; fundo mais escuro; altura disponível da janela |
| Cabeçalho contextual | Compacto, 40–48 px; workspace/spec e versão ativa, privacidade real e ação para abrir sidebar |
| Conversa | Coluna central de até 760 px, padding horizontal de 24 px; mensagens com ritmo vertical de 24 px |
| Composer | Mesma coluna da conversa; largura de 100% até 760 px; altura inicial de 80–96 px; margem inferior de 16 px |
| Inspector | 360–440 px quando aberto, com cabeçalho fixo e rolagem própria; fechado inicialmente |

A referência deixa cerca de 35 px acima da superfície principal. Na versão web, esse espaço não deve virar uma barra de título falsa: usar apenas o respiro necessário. Não desenhar controles de janela do sistema operacional.

Usar altura dinâmica da viewport e layout flex/grid. A conversa rola; o composer permanece na base, sem cobrir mensagens. Ao abrir o inspector, recalcular a coluna disponível. Se ela ficar estreita demais, apresentar o inspector como sobreposição.

## 4. Tokens visuais propostos

### Cores

| Token | Valor | Uso |
|---|---|---|
| `shell` | `#343434` | Moldura e trilho |
| `sidebar` | `#232323` | Lista de workspaces |
| `canvas` | `#181818` | Conversa e conteúdo principal |
| `surface` | `#252525` | Código e agrupamentos necessários |
| `composer` | `#343434` | Campo de entrada |
| `hover` | `#3D3D3D` | Hover em controles |
| `selected` | `#454545` | Navegação ativa |
| `border-subtle` | `#454545` | Separadores decorativos |
| `border-control` | `#858585` | Limites de controles quando necessários à identificação |
| `text-primary` | `#F2F2F2` | Texto principal |
| `text-secondary` | `#B8B8B8` | Metadados e placeholder |
| `text-muted` | `#A3A3A3` | Informação auxiliar |
| `focus` | `#A8C7FA` | Anel de foco |
| `success` | `#91D5AA` | Pronto, sucesso |
| `warning` | `#E6C384` | Degradação e atenção |
| `danger` | `#F2A1A1` | Erro e ação destrutiva |
| `info` | `#A8C7FA` | Informação e método GET |

Botão primário: fundo `text-primary`, texto `canvas`. Não usar uma cor de destaque saturada em grandes áreas. Cores de estado devem aparecer em texto/ícone ou badges discretos, sempre acompanhadas de rótulo. GET pode usar azul, POST verde, PUT/PATCH âmbar e DELETE vermelho; outros métodos permanecem neutros e todos mantêm seu nome escrito.

Os tokens são candidatos: validar contraste no par real de foreground/background e em todos os estados. O cinza quase apagado da imagem não deve ser reproduzido em textos essenciais.

### Tipografia, espaçamento e forma

- Interface: stack local `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; nenhum download de fonte.
- Código, caminhos e parâmetros: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- Conversa: 15 px / 24 px; navegação e controles: 13–14 px / 20 px; metadados: 12 px / 18 px; título de seção: 16 px / 24 px, peso 600.
- Pesos usuais 400 e 500; 600 para hierarquia. Evitar caixa alta generalizada e texto ultrapequeno.
- Escala de espaçamento: 4, 8, 12, 16, 24 e 32 px.
- Raios: itens e botões 8 px; painéis e código 12 px; composer 16 px; círculo apenas para controles apropriados.
- Ícones: Lucide já presente no projeto, 16–20 px, traço consistente. Botões de ícone precisam de nome acessível e tooltip.
- Evitar gradientes, vidro, brilhos e sombras em cada cartão. Usar sombra suave apenas em menus e sobreposições.

## 5. Componentes e interações

### Navegação e workspaces

Transferir a navegação do cabeçalho horizontal atual para o trilho lateral. Chat e Configurações conservam destinos reconhecíveis. Estado ativo combina fundo, ícone e atributo acessível; hover é distinto de seleção.

Sidebar com título “Workspaces”, ação “Novo workspace” e lista de projetos. O selecionado expõe especificações, versão ativa e estado de indexação. Importação de JSON/YAML por botão e drag-and-drop continua disponível; filtros de método/rota ficam em uma seção compacta expansível. Não adicionar limite de bytes ao upload como parte do redesign.

Nomes longos podem ser truncados com acesso ao nome completo por foco/tooltip. Exclusão fica em menu contextual acessível por teclado, com confirmação identificando o workspace e seus dados locais. Não depender de hover para descobrir ações no toque.

### Área de conversa

Sem histórico: mostrar uma orientação curta e contextual. Sem especificação: “Importe um OpenAPI para começar”, com ação de importação. Com especificação disponível: “O que você quer descobrir nesta API?”. Evitar sugerir endpoints que não vieram do contrato carregado.

Mensagens do usuário usam uma superfície cinza compacta, alinhada à direita. Respostas do assistente ficam diretamente no canvas, com texto selecionável, hierarquia curta e fontes próximas das afirmações. Usar cartões apenas para conteúdos estruturados que precisem de agrupamento.

Cada citação abre o inspector correto e identifica método, caminho e versão da fonte. Código apresenta abas cURL / fetch / Python, realce local, rolagem horizontal própria e botão “Copiar” com confirmação acessível. Nunca apresentar “Executar”.

Durante streaming, mostrar a etapa recebida do backend. Não tratar fragmentos incompletos como resposta final validada. Manter o scroll do usuário ao ler mensagens anteriores; oferecer “Ir para o fim” quando houver conteúdo novo.

### Composer

Textarea com rótulo acessível “Pergunta sobre a API” e placeholder “Pesquise o que quiser na API”. Padding de 16 px; crescimento até aproximadamente 200 px, seguido de rolagem interna. Enter envia e Shift+Enter insere linha, respeitando composição de texto por IME.

Rodapé interno com decisão e LLM em controles discretos, inspirados na referência. Exibir nomes efetivos recebidos do sistema; `Laya` e `llama3.2:3b` na imagem não comprovam disponibilidade. Separar seleção solicitada de configuração efetiva. Se a troca não estiver implementada, usar informação com link para Configurações, sem dropdown fictício.

Botão de envio de 36 × 36 px no desktop, com nome acessível. Estados: vazio, preenchido, foco, envio em andamento, bloqueado e erro. Desabilitar quando necessário com motivo legível; preservar a pergunta em falhas recuperáveis. Oferecer cancelamento apenas quando suportado pelo fluxo real.

### Inspector e configurações

Inspector com método/caminho, API/versão e ação de fechar. Agrupar parâmetros, corpo, respostas, segurança e origem em seções expansíveis; manter campos obrigatórios explícitos. Diagnósticos de busca ficam em seção própria, com modo efetivo, candidatos e scores reais, sem transformar score em probabilidade.

Configurações usam a mesma moldura e coluna de leitura, com grupos para embeddings, classificação, LLM e privacidade. Mostrar disponibilidade local, configuração solicitada versus efetiva e necessidade de reconstrução do índice. Salvar deve produzir feedback real; reindexar/repetir só pode aparecer como ação funcional quando houver suporte validado.

## 6. Estados e microcopy

| Situação confirmada | Apresentação |
|---|---|
| Sem workspace/spec | Orientação curta com ação de criar/importar |
| Importação/indexação | Etapa e contagens reais; progresso indeterminado quando não houver total |
| Índice semântico pronto | “Pronto para busca semântica” apenas após confirmação do backend |
| Somente busca textual | Aviso âmbar “Busca textual disponível” com motivo da ausência de busca semântica |
| Vetores desativados pelo usuário | “Busca semântica desativada”, sem apresentar como falha |
| Reconstrução | “Reconstruindo índice”; informar qual configuração está efetivamente em uso |
| Índice indisponível | Explicar impacto e recuperação disponível; não exibir sucesso visual |
| Ollama indisponível | “Resposta baseada no contrato”, quando houver esse fallback, separado do modo de busca |
| Nenhuma evidência relevante | “Não encontrei uma operação correspondente nesta especificação” |
| Falha de importação | Motivo acionável próximo ao arquivo; manter acesso à versão anterior quando aplicável |
| Política de privacidade bloqueou ação | Informar bloqueio sem sugerir saída cloud automática |

O indicador “Modo privado” é discreto e persistente no contexto ou nas configurações, vinculado ao estado efetivo. Um selo verde estático não constitui prova de isolamento. Desativação exige a confirmação informada prevista em `spec.md`; não deve ser um atalho acidental no composer.

## 7. Responsividade e acessibilidade

- A partir de 1200 px: trilho + sidebar + conversa; inspector lateral quando couber.
- Entre 768 e 1199 px: sidebar recolhível e inspector sobreposto; preservar largura útil da conversa.
- Abaixo de 768 px: navegação por botão no cabeçalho, sidebar em drawer e inspector em tela sobreposta; padding de 16 px e controles de toque de pelo menos 44 × 44 px.
- Em 320 px e com zoom de 200%, não permitir rolagem horizontal da página. Código/tabelas podem ter rolagem própria; seletores do composer quebram linha.
- Menus e drawers operam por teclado, fecham com Escape e devolvem foco ao acionador. Sobreposições modais contêm o foco; painéis não modais não o aprisionam.
- Foco visível de 2 px com offset de 2 px; texto comum com contraste mínimo de 4,5:1, texto grande e indicadores essenciais com 3:1.
- Labels persistentes ou acessíveis para inputs; placeholder nunca é o único rótulo. Estados não dependem apenas de cor.
- Anunciar etapas com região de status, sem narrar cada token. Erros importantes recebem anúncio próprio.
- Transições de 120–180 ms para hover e abertura; respeitar `prefers-reduced-motion`. Não animar dimensões durante a leitura do stream.

## 8. Aplicação ao código existente

| Arquivo existente | Mudança visual futura |
|---|---|
| [globals.css](./apps/web/src/app/globals.css) | Mapear os tokens neutros para as variáveis atuais e padronizar foco/tipografia |
| [Navbar.tsx](./apps/web/src/components/layout/Navbar.tsx) | Redistribuir navegação e privacidade para trilho/contexto, preservando rotas |
| [MainLayout.tsx](./apps/web/src/components/chat/MainLayout.tsx) | Organizar moldura, regiões, alturas e comportamento responsivo |
| [Sidebar.tsx](./apps/web/src/components/chat/Sidebar.tsx) | Compactar workspaces, importação, versões e filtros |
| [ChatArea.tsx](./apps/web/src/components/chat/ChatArea.tsx) | Retirar banner volumoso, reduzir cartões e reorganizar composer/fontes |
| [EndpointInspector.tsx](./apps/web/src/components/chat/EndpointInspector.tsx) | Melhorar hierarquia do contrato e comportamento do painel |
| [settings/page.tsx](./apps/web/src/app/settings/page.tsx) | Aplicar superfícies e grupos consistentes |

Preservar os fluxos do contexto compartilhado, importação, seleção de versão e configurações. Não adicionar bibliotecas, assets remotos, fontes CDN, telemetria ou chamadas de API documentada para obter esse visual. Embeddings locais, `decision=laya`, `llm=ollama` e `privateMode=true` continuam sendo os defaults normativos.

## 9. Critérios para a implementação futura

- [ ] Comparação em 1366 × 768 reconhece as proporções e camadas da referência.
- [ ] Chat é o foco; composer fica acessível e não cobre a última mensagem.
- [ ] Navegação, importação, filtros, versões, fontes, snippets e configurações continuam funcionais.
- [ ] Inspector preserva origem exata, versão e conteúdo canônico.
- [ ] Estados vazio, carregando, degradado, erro e sucesso usam dados reais.
- [ ] Navegação por teclado, foco, contraste, zoom, toque e movimento reduzido foram verificados.
- [ ] Nenhum asset externo ou novo egress é introduzido; defaults privados preservados.
- [ ] Capturas desktop/mobile e testes relevantes são registrados antes de marcar implementação concluída.

## 10. Limitações e próximo passo

A imagem mostra apenas a tela vazia; conversa, inspector, configurações e responsividade são propostas de adaptação ao SpecLens. O status histórico “implementation not started” de `spec.md` diverge do código existente, conforme já registrado em `plan.md`; seus requisitos funcionais continuam prevalecendo.

Validação desta entrega: estrutura Markdown, links locais e whitespace. Testes de runtime, contraste renderizado e comparação visual: **NÃO EXECUTADO**, pois esta entrega altera apenas documentação. Não há alegação de aprovação de segurança ou implementação visual.

Próximo passo visual, quando solicitado: aplicar tokens e moldura em uma microtarefa, preservando os fluxos existentes. A sequência funcional da Fase 12 continua em RAG-01; RAG-08 depende dos gates anteriores.
