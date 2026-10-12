import type {
  LLMProvider,
  ProviderManifest,
  ProviderReadiness,
  StreamExplanationInput,
  ExplanationEvent,
  SourceCitation,
  ResponseEnvelope,
  OllamaProviderConfig,
} from './types.js';
import { ollamaTagsResponseSchema, responseEnvelopeSchema } from './schemas.js';
import {
  validateOllamaUrl,
  isCloudBackedModel,
  rejectOllamaRedirect,
} from './policy.js';
import { buildExplanationPrompt } from './prompt.js';
import { parseOllamaStream } from './stream-parser.js';

export const DEFAULT_OLLAMA_MODEL_ID = 'llama3.2:3b';

export function normalizeOllamaModelId(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return trimmed;
  const lastSegment = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return lastSegment.includes(':') ? trimmed : `${trimmed}:latest`;
}

export class OllamaLLMProvider implements LLMProvider {
  public readonly manifest: ProviderManifest;
  public readonly baseUrl: string;
  public readonly modelId: string;
  public readonly privateMode: boolean;
  public readonly allowedBaseUrls: string[];
  public readonly timeoutMs: number;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://127.0.0.1:11434';
    this.modelId = normalizeOllamaModelId(config.modelId ?? DEFAULT_OLLAMA_MODEL_ID);
    this.privateMode = config.privateMode ?? true;
    this.allowedBaseUrls = config.allowedBaseUrls ?? [
      'http://127.0.0.1:11434',
      'http://localhost:11434',
    ];
    this.timeoutMs = config.timeoutMs ?? 30000;

    this.manifest = {
      id: 'ollama-local',
      kind: 'llm',
      implementationVersion: config.implementationVersion ?? '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: this.modelId,
      modelRevision: 'latest',
      supportsOffline: true,
    };
  }

  /**
   * Checks whether the local Ollama runtime and configured model are ready for offline inference.
   */
  async readiness(): Promise<ProviderReadiness> {
    try {
      validateOllamaUrl(this.baseUrl, this.privateMode, this.allowedBaseUrls);
    } catch (err) {
      return {
        ready: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'manual',
      });
      rejectOllamaRedirect(response);

      if (!response.ok) {
        return {
          ready: false,
          reason: `Ollama returned HTTP status ${response.status}.`,
        };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return {
          ready: false,
          reason: 'Invalid JSON response from Ollama /api/tags.',
        };
      }
      const parsedTags = ollamaTagsResponseSchema.safeParse(body);

      if (!parsedTags.success) {
        return {
          ready: false,
          reason: 'Invalid response format from Ollama /api/tags.',
        };
      }

      const normalizedTarget = normalizeOllamaModelId(this.modelId).toLowerCase();

      const foundModel = parsedTags.data.models.find((m) => {
        return normalizeOllamaModelId(m.name).toLowerCase() === normalizedTarget;
      });

      if (!foundModel) {
        return {
          ready: false,
          code: 'MODEL_UNAVAILABLE',
          reason: `Model not found: "${this.modelId}" on Ollama runtime at ${this.baseUrl}.`,
        };
      }

      if (this.privateMode && isCloudBackedModel(foundModel)) {
        return {
          ready: false,
          reason: `[PrivateMode] Model "${this.modelId}" is cloud-backed or proxied, violating locality policy.`,
        };
      }

      return { ready: true };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          ready: false,
          reason: `Connection to Ollama timed out after ${this.timeoutMs}ms.`,
        };
      }
      return {
        ready: false,
        reason: `Failed to connect to Ollama runtime at ${this.baseUrl}.`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Streams an explanation for the user query, grounded strictly on the retrieved operations.
   */
  async *streamExplanation(
    input: StreamExplanationInput,
    signal?: AbortSignal,
  ): AsyncIterable<ExplanationEvent> {
    try {
      validateOllamaUrl(this.baseUrl, this.privateMode, this.allowedBaseUrls);
    } catch (err) {
      yield {
        type: 'error',
        code: 'PRIVACY_POLICY_VIOLATION',
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
        retryable: false,
      };
      return;
    }

    if (signal?.aborted) {
      yield {
        type: 'error',
        code: 'ABORTED',
        message: 'Stream cancelled before start.',
        recoverable: false,
        retryable: false,
      };
      return;
    }

    yield {
      type: 'status',
      stage: 'grounding',
      message: 'Grounding explanation on retrieved canonical operations...',
    };

    const sources: SourceCitation[] = input.groundedOperations.map((op) => ({
      specificationId: (op as { specificationId?: string }).specificationId || 'active-spec',
      operationId: op.operationId,
      method: op.method,
      path: op.path,
      sourcePointer:
        (op as { sourcePointer?: string }).sourcePointer || `/paths/${op.path}/${op.method}`,
    }));

    yield {
      type: 'sources',
      sources,
    };

    yield {
      type: 'status',
      stage: 'generating',
      message: `Requesting explanation from local Ollama model (${this.modelId})...`,
    };

    const prompt = buildExplanationPrompt(input.query, input.groundedOperations, input.locale);
    const generationController = new AbortController();
    let timedOut = false;
    const abortForClient = () => generationController.abort(signal?.reason);
    signal?.addEventListener('abort', abortForClient, { once: true });
    const timeoutId = setTimeout(() => {
      if (generationController.signal.aborted) return;
      timedOut = true;
      generationController.abort(new Error('Ollama generation deadline exceeded.'));
    }, this.timeoutMs);

    try {
      if (signal?.aborted) abortForClient();

      // Verify the selected model's runtime metadata on every generation. A
      // manifest and a previous readiness check are not proof of locality.
      let tagsResponse: Response;
      try {
        tagsResponse = await fetch(`${this.baseUrl}/api/tags`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: generationController.signal,
          redirect: 'manual',
        });
        rejectOllamaRedirect(tagsResponse);
      } catch (err) {
        if (err instanceof Error && err.name === 'PrivacyViolationError') {
          yield {
            type: 'error',
            code: 'PRIVACY_POLICY_VIOLATION',
            message: err.message,
            recoverable: false,
            retryable: false,
          };
        } else if (timedOut || signal?.aborted) {
          yield {
            type: 'error',
            code: timedOut ? 'OLLAMA_TIMEOUT' : 'ABORTED',
            message: timedOut
              ? `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`
              : 'Request was cancelled by client.',
            recoverable: timedOut,
            retryable: timedOut,
          };
        } else {
          yield {
            type: 'error',
            code: 'OLLAMA_UNAVAILABLE',
            message: 'Não foi possível validar o modelo no Ollama local.',
            recoverable: true,
            retryable: true,
          };
        }
        return;
      }

      if (!tagsResponse.ok) {
        yield {
          type: 'error',
          code: tagsResponse.status === 404 ? 'MODEL_UNAVAILABLE' : 'OLLAMA_HTTP_ERROR',
          message:
            tagsResponse.status === 404
              ? 'O modelo selecionado não está disponível no Ollama local.'
              : `Ollama retornou HTTP ${tagsResponse.status} ao validar o modelo.`,
          recoverable: true,
          retryable: tagsResponse.status !== 404,
        };
        return;
      }

      let tagsBody: unknown;
      try {
        tagsBody = await tagsResponse.json();
      } catch {
        yield {
          type: 'error',
          code: timedOut ? 'OLLAMA_TIMEOUT' : signal?.aborted ? 'ABORTED' : 'OLLAMA_INVALID_MODEL_METADATA',
          message: timedOut
            ? `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`
            : signal?.aborted ? 'Request was cancelled by client.' : 'Ollama retornou metadata inválida ao validar o modelo local.',
          recoverable: !signal?.aborted,
          retryable: !signal?.aborted,
        };
        return;
      }
      const parsedTags = ollamaTagsResponseSchema.safeParse(tagsBody);
      if (!parsedTags.success) {
        yield { type: 'error', code: 'OLLAMA_INVALID_MODEL_METADATA', message: 'Ollama retornou metadata inválida ao validar o modelo local.', recoverable: true, retryable: true };
        return;
      }
      if (generationController.signal.aborted) {
        yield { type: 'error', code: timedOut ? 'OLLAMA_TIMEOUT' : 'ABORTED', message: timedOut ? 'Ollama generation deadline exceeded.' : 'Request was cancelled by client.', recoverable: timedOut, retryable: timedOut };
        return;
      }
      const selectedModel = parsedTags.data.models.find(
            (model) =>
              normalizeOllamaModelId(model.name).toLowerCase() ===
              normalizeOllamaModelId(this.modelId).toLowerCase(),
          );
      if (!selectedModel) {
        yield {
          type: 'error',
          code: 'MODEL_UNAVAILABLE',
          message: `O modelo ${this.modelId} não está disponível no Ollama local.`,
          recoverable: true,
          retryable: false,
        };
        return;
      }
      if (this.privateMode && isCloudBackedModel(selectedModel)) {
        yield {
          type: 'error',
          code: 'PRIVACY_POLICY_VIOLATION',
          message: 'O modelo selecionado é cloud-backed ou usa proxy remoto; geração bloqueada.',
          recoverable: false,
          retryable: false,
        };
        return;
      }

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/x-ndjson, application/json',
          },
          body: JSON.stringify({
            model: this.modelId,
            messages: prompt.messages,
            stream: true,
            options: { temperature: 0.2 },
          }),
          signal: generationController.signal,
          redirect: 'manual',
        });
        rejectOllamaRedirect(response);
      } catch (err) {
        if (err instanceof Error && err.name === 'PrivacyViolationError') {
          yield {
            type: 'error',
            code: 'PRIVACY_POLICY_VIOLATION',
            message: err.message,
            recoverable: false,
            retryable: false,
          };
          return;
        }
        if (timedOut || signal?.aborted) {
          yield {
            type: 'error',
            code: timedOut ? 'OLLAMA_TIMEOUT' : 'ABORTED',
            message: timedOut
              ? `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`
              : 'Request was cancelled by client.',
            recoverable: timedOut,
            retryable: timedOut,
          };
          return;
        }
        // Other transport failures are reported without exposing response data.
        yield {
          type: 'error',
          code: 'OLLAMA_UNAVAILABLE',
          message: 'Não foi possível conectar ao serviço Ollama local.',
          recoverable: true,
          retryable: true,
        };
        return;
      }

      if (timedOut || signal?.aborted) {
        yield timedOut
          ? {
              type: 'error',
              code: 'OLLAMA_TIMEOUT',
              message: `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`,
              recoverable: true,
              retryable: true,
            }
          : {
              type: 'error',
              code: 'ABORTED',
              message: 'Request was cancelled by client.',
              recoverable: false,
              retryable: false,
            };
        return;
      }

      if (!response.ok) {
        yield {
          type: 'error',
          code: response.status === 404 ? 'MODEL_UNAVAILABLE' : 'OLLAMA_HTTP_ERROR',
          message:
            response.status === 404
              ? `O modelo ${this.modelId} não está disponível no Ollama local. Confira a seleção e os modelos instalados.`
              : `Ollama retornou HTTP ${response.status}.`,
          recoverable: true,
          retryable: response.status !== 404,
        };
        return;
      }

      let fullExplanation = '';
      let completed = false;

      try {
        for await (const chunk of parseOllamaStream(response, generationController.signal)) {
          if (timedOut || signal?.aborted) break;
          if (chunk.done) completed = true;
          const tokenContent = chunk.message?.content || chunk.response || '';
          if (tokenContent) {
            fullExplanation += tokenContent;
            yield { type: 'token', token: tokenContent, content: tokenContent };
          }
        }
      } catch {
        if (timedOut) {
          yield {
            type: 'error',
            code: 'OLLAMA_TIMEOUT',
            message: `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`,
            recoverable: true,
            retryable: true,
          };
        } else if (signal?.aborted) {
          yield {
            type: 'error',
            code: 'ABORTED',
            message: 'Stream cancelled by client.',
            recoverable: false,
            retryable: false,
          };
        } else {
          yield {
            type: 'error',
            code: 'STREAM_DECODE_ERROR',
            message: 'O stream do Ollama contém dados inválidos.',
            recoverable: true,
            retryable: true,
          };
        }
        return;
      }

      if (timedOut) {
        yield {
          type: 'error',
          code: 'OLLAMA_TIMEOUT',
          message: `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`,
          recoverable: true,
          retryable: true,
        };
        return;
      }
      if (signal?.aborted) {
        yield {
          type: 'error',
          code: 'ABORTED',
          message: 'Stream cancelled by client.',
          recoverable: false,
          retryable: false,
        };
        return;
      }

      if (!completed) {
        yield {
          type: 'error',
          code: 'STREAM_INCOMPLETE',
          message: 'O stream do Ollama terminou sem confirmação de conclusão.',
          recoverable: true,
          retryable: true,
        };
        return;
      }

      const limitations: string[] = [];
      if (input.groundedOperations.length === 0) {
        limitations.push('Nenhuma operação OpenAPI foi fornecida para fundamentar esta resposta.');
      }

      const finalEnvelope: ResponseEnvelope = {
        schemaVersion: 1,
        query: input.query,
        answer: {
          locale: input.locale,
          explanation: fullExplanation.trim(),
          limitations,
        },
        sources,
        snippets: [],
      };

      // Strict Zod validation of the final response before yielding.
      const parsedEnvelope = responseEnvelopeSchema.safeParse(finalEnvelope);
      if (!parsedEnvelope.success) {
        yield {
          type: 'error',
          code: 'INVALID_FINAL_ENVELOPE',
          message: 'A resposta final do Ollama não passou na validação.',
          recoverable: false,
          retryable: false,
        };
        return;
      }

      if (timedOut || signal?.aborted) {
        yield timedOut
          ? {
              type: 'error',
              code: 'OLLAMA_TIMEOUT',
              message: `A geração do Ollama excedeu o limite de ${this.timeoutMs}ms.`,
              recoverable: true,
              retryable: true,
            }
          : {
              type: 'error',
              code: 'ABORTED',
              message: 'Stream cancelled by client.',
              recoverable: false,
              retryable: false,
            };
        return;
      }

      yield { type: 'final', envelope: parsedEnvelope.data, response: parsedEnvelope.data };
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortForClient);
      // Closing the iterator early must also stop the underlying inference.
      if (!generationController.signal.aborted) generationController.abort();
    }
  }
}
