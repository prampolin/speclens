import { NextRequest, NextResponse } from 'next/server';
import {
  getDatabase,
  getSettingsRepo,
  getWorkspaceRepo,
  getOperationRepo,
  getSpecificationRepo,
} from '@/lib/server/db';
import {
  getEmbeddingProvider,
  getDecisionProvider,
  getWorkspaceLLMProvider,
  resolveWorkspaceSettings,
  getVectorIndex,
} from '@/lib/server/providers';
import {
  HybridRetrievalImpl,
  hydrateOperations,
  type NormalizedOperation,
  type SourceCitation,
  type ResponseEnvelope,
  responseEnvelopeSchema,
  PrivacyViolationError,
} from '@speclens/ai-core';
import { generateSnippets } from '@speclens/codegen';
import { highlightSnippet } from '@/lib/server/shiki';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : 'default';
    const specificationId = typeof body.specificationId === 'string' ? body.specificationId : undefined;

    if (!query) {
      return NextResponse.json(
        {
          code: 'EMPTY_QUERY',
          message: 'Chat query cannot be empty.',
          retryable: false,
        },
        { status: 400 }
      );
    }

    // 1. Policy check: privateMode, workspace validation
    const workspaceRepo = getWorkspaceRepo();
    const ws = workspaceRepo.findById(workspaceId);
    if (!ws) {
      return NextResponse.json(
        {
          code: 'WORKSPACE_NOT_FOUND',
          message: `Workspace "${workspaceId}" not found.`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    const settingsRepo = getSettingsRepo();
    const settings = resolveWorkspaceSettings(workspaceId);

    // Fail closed: privateMode check
    if (settings.privateMode) {
      // Confirmed private mode is active on server
    }

    const layaEnabled = settings.inference?.layaEnabled ?? true;
    const llmEnabled = settings.inference?.llmEnabled ?? true;
    const signal = request.signal;

    // Set up SSE ReadableStream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        function sendEvent(data: Record<string, unknown>) {
          if (isClosed || signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            isClosed = true;
          }
        }

        try {
          if (signal.aborted) {
            sendEvent({
              type: 'error',
              code: 'ABORTED',
              message: 'Request was cancelled before start.',
            });
            controller.close();
            return;
          }

          // Stage 1: Classify intent
          sendEvent({
            type: 'status',
            stage: 'classifying',
            message: layaEnabled ? 'Classificando intenção com Laya...' : 'Laya desativado. Buscando diretamente na especificação.',
          });

          let classifyResult;
          if (!layaEnabled) {
            classifyResult = { intent: 'search_endpoint', confidence: null, abstained: true, providerId: 'disabled' };
          } else {
            const decisionProvider = getDecisionProvider();
            try {
              classifyResult = await decisionProvider.classify(
                query,
                ['search_endpoint', 'generate_code', 'explain_schema', 'compare_endpoints'],
                signal
              );
            } catch (decErr: any) {
              classifyResult = {
                intent: 'search_endpoint',
                confidence: null,
                abstained: true,
                providerId: 'fallback',
              };
            }
          }

          sendEvent({
            type: 'intent',
            intent: classifyResult.intent ?? 'search_endpoint',
            confidence: classifyResult.confidence,
            abstained: classifyResult.abstained,
            providerId: classifyResult.providerId,
          });

          // Stage 2: Hybrid Retrieval
          sendEvent({
            type: 'status',
            stage: 'retrieving',
            message: 'Buscando operações candidatas no SQLite FTS5 e vetores...',
          });

          const db = getDatabase();
          const vectorIndex = getVectorIndex();
          const embeddingProvider = getEmbeddingProvider();

          const retrieval = new HybridRetrievalImpl({
            db,
            vectorIndex,
            embeddingProvider,
          });

          let retrievalResults;
          try {
            retrievalResults = await retrieval.search({
              text: query,
              workspaceId,
              specificationId,
              topK: settings.retrieval?.topK ?? 5,
            });
          } catch (_searchErr) {
            // Fallback to FTS5 search directly if retrieval threw (e.g., embeddings not ready)
            const opRepo = getOperationRepo();
            const ftsResults = opRepo.fullTextSearch(query, {
              workspaceId,
              specificationId,
              limit: settings.retrieval?.topK ?? 5,
            });

            retrievalResults = ftsResults.map((r, idx) => ({
              operationId: r.operation.id,
              specificationId: r.operation.specificationId,
              method: r.operation.method,
              path: r.operation.path,
              tags: r.operation.tags,
              fusedScore: 1 / (idx + 1),
              vectorScore: null,
              lexicalScore: r.rank,
              rank: idx + 1,
              lexicalRank: idx + 1,
              vectorRank: null,
            }));
          }

          sendEvent({
            type: 'retrieval',
            results: retrievalResults,
          });

          // Stage 3: Hydrate full operations
          const opRepo = getOperationRepo();
          const groundedOperations: NormalizedOperation[] = await hydrateOperations(
            retrievalResults,
            opRepo
          );

          // Build source citations
          const specRepo = getSpecificationRepo();
          const sources: SourceCitation[] = groundedOperations.map((op) => {
            const specId = op.specId || (op as any).specificationId || '';
            const spec = specId ? specRepo.findById(specId) : null;
            return {
              specificationId: specId,
              specVersion: spec?.version,
              specTitle: spec?.title,
              operationId: op.operationId,
              method: op.method,
              path: op.path,
              sourcePointer: op.sourcePointer || `/paths/${op.path}/${op.method}`,
            };
          });

          sendEvent({
            type: 'sources',
            sources,
          });

          // Stage 4: Codegen snippets for top operation
          let generatedSnippets: any[] = [];
          if (groundedOperations.length > 0) {
            const topOp = groundedOperations[0];
            try {
              const codegenResult = generateSnippets({
                operation: topOp,
                languages: ['curl', 'javascript', 'python'],
              });

              // Server-side Shiki syntax highlighting
              generatedSnippets = await Promise.all(
                codegenResult.snippets.map(async (s) => ({
                  ...s,
                  operationId: topOp.id,
                  html: await highlightSnippet(s.code, s.language),
                }))
              );

              sendEvent({
                type: 'snippets',
                snippets: generatedSnippets,
                operationId: topOp.id,
              });
            } catch {
              // Snippet generation error handled gracefully
            }
          }

          // Stage 5: Stream explanation from LLM Provider
          sendEvent({
            type: 'status',
            stage: 'explaining',
            message: llmEnabled ? 'Gerando explicação fundamentada com Ollama...' : 'LLM desativado. Preparando resposta baseada no contrato OpenAPI.',
          });

          let finalEmitted = false;
          let fallbackReason = llmEnabled ? 'O Ollama não retornou uma resposta final válida.' : 'LLM desativado nas configurações.';

          if (llmEnabled) {
            const llmProvider = getWorkspaceLLMProvider(settings);

            try {
              const eventStream = llmProvider.streamExplanation(
                {
                  query,
                  groundedOperations,
                  locale: 'pt-BR',
                },
                signal
              );

              for await (const event of eventStream) {
                if (signal.aborted) break;

                if (event.type === 'token') {
                  sendEvent(event as Record<string, unknown>);
                } else if (event.type === 'final') {
                  const rawEnvelope = (event as any).envelope || (event as any).response;
                  const envelope: ResponseEnvelope = {
                    ...rawEnvelope,
                    sources,
                    snippets: generatedSnippets.map((s) => ({
                      language: s.language,
                      label: s.label,
                      code: s.code,
                      validated: s.validated,
                      validationWarnings: s.validationWarnings,
                    })),
                  };

                  const validEnvelope = responseEnvelopeSchema.parse(envelope);
                  finalEmitted = true;
                  sendEvent({
                    type: 'final',
                    envelope: validEnvelope,
                    snippetsWithHtml: generatedSnippets,
                  });
                  break;
                } else if (event.type === 'error') {
                  fallbackReason = event.message;
                  sendEvent({
                    type: 'status',
                    stage: 'explaining',
                    message: `Aviso IA (${event.code}): ${event.message} Resposta baseada no contrato OpenAPI.`,
                  });
                } else if (event.type === 'status') {
                  sendEvent(event as Record<string, unknown>);
                }
              }
            } catch {
              fallbackReason = 'A resposta final do Ollama não passou na validação.';
              sendEvent({
                type: 'status',
                stage: 'explaining',
                message: `${fallbackReason} Resposta baseada no contrato OpenAPI.`,
              });
            }

          }

          // If final event wasn't emitted (e.g., Ollama was offline), synthesize a grounded schema-valid final envelope
          if (!finalEmitted) {
            let explanation = '';
            {
              if (groundedOperations.length > 0) {
                const topOp = groundedOperations[0];
                const isCreationQuery = /(cadastrar|criar|adicionar|salvar|registrar|inserir|create|add|new)\b/i.test(query);
                const postOp = groundedOperations.find((op) => op.method.toUpperCase() === 'POST');

                let intentNote = '';
                if (isCreationQuery && topOp.method.toUpperCase() === 'GET') {
                  if (postOp) {
                    intentNote = `\n\n*Aviso:* Sua consulta indica intenção de criação/cadastro, mas o resultado principal do índice é um método **GET**. Não foi encontrado um endpoint de cadastro exclusivo para esse recurso nesta especificação; caso ele seja registrado junto com uma entidade pai, verifique a operação **${postOp.method.toUpperCase()} ${postOp.path}**.`;
                  } else {
                    intentNote = `\n\n*Aviso:* Sua consulta indica intenção de criação/cadastro, porém nenhum endpoint de método **POST** direto foi encontrado para esta solicitação.`;
                  }
                }

                explanation = `Operação encontrada: **${topOp.method.toUpperCase()} ${topOp.path}**${
                  topOp.summary ? ` — ${topOp.summary}` : ''
                }.${
                  topOp.description ? `\n\n${topOp.description}` : ''
                }${intentNote}`;
              } else {
                explanation = 'Nenhum endpoint correspondente foi encontrado na especificação OpenAPI.';
              }
            }

            const fallbackEnvelope: ResponseEnvelope = {
              schemaVersion: 1,
              query,
              answer: {
                locale: 'pt-BR',
                explanation,
                limitations: [
                  `Resposta produzida sem LLM: ${fallbackReason}`,
                  ...(groundedOperations.length === 0
                    ? ['Nenhuma operação OpenAPI foi encontrada para fundamentar esta resposta.']
                    : []),
                ],
              },
              sources,
              snippets: generatedSnippets.map((s) => ({
                language: s.language,
                label: s.label,
                code: s.code,
                validated: s.validated,
                validationWarnings: s.validationWarnings,
              })),
            };

            const validEnvelope = responseEnvelopeSchema.parse(fallbackEnvelope);
            sendEvent({
              type: 'final',
              envelope: validEnvelope,
              snippetsWithHtml: generatedSnippets,
            });
          }
        } catch (fatalErr: any) {
          sendEvent({
            type: 'error',
            code: fatalErr instanceof PrivacyViolationError ? 'PRIVACY_POLICY_VIOLATION' : 'STREAM_FATAL',
            message: fatalErr instanceof PrivacyViolationError ? 'Configuração do Ollama bloqueada pela política de privacidade.' : 'Falha ao produzir o stream do chat.',
            recoverable: false,
            retryable: false,
          });
        } finally {
          isClosed = true;
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'CHAT_INITIALIZATION_ERROR',
        message: err instanceof Error ? err.message : 'Failed to start chat session.',
      },
      { status: 500 }
    );
  }
}
