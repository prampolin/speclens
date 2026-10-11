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
import {
  ollamaTagsResponseSchema,
  responseEnvelopeSchema,
} from './schemas.js';
import { validateOllamaUrl, isCloudBackedModel } from './policy.js';
import { buildExplanationPrompt } from './prompt.js';
import { parseOllamaStream } from './stream-parser.js';

export class OllamaLLMProvider implements LLMProvider {
  public readonly manifest: ProviderManifest;
  public readonly baseUrl: string;
  public readonly modelId: string;
  public readonly privateMode: boolean;
  public readonly allowedBaseUrls: string[];
  public readonly timeoutMs: number;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://127.0.0.1:11434';
    this.modelId = config.modelId ?? 'llama3:latest';
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
      });

      if (!response.ok) {
        return {
          ready: false,
          reason: `Ollama returned HTTP status ${response.status} (${response.statusText}).`,
        };
      }

      const body = await response.json();
      const parsedTags = ollamaTagsResponseSchema.safeParse(body);

      if (!parsedTags.success) {
        return {
          ready: false,
          reason: `Invalid response format from Ollama /api/tags: ${parsedTags.error.message}`,
        };
      }

      const normalizedTarget = this.modelId.toLowerCase();
      const targetBase = normalizedTarget.split(':')[0];

      const foundModel = parsedTags.data.models.find((m) => {
        const name = m.name.toLowerCase();
        return name === normalizedTarget || name.split(':')[0] === targetBase;
      });

      if (!foundModel) {
        return {
          ready: false,
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
        reason: `Failed to connect to Ollama runtime at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
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
      sourcePointer: (op as { sourcePointer?: string }).sourcePointer || `/paths/${op.path}/${op.method}`,
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
          options: {
            temperature: 0.2, // low temperature for high precision and grounding
          },
        }),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) {
        yield {
          type: 'error',
          code: 'ABORTED',
          message: 'Request was cancelled by client.',
          recoverable: false,
          retryable: false,
        };
        return;
      }
      yield {
        type: 'error',
        code: 'OLLAMA_HTTP_ERROR',
        message: `Failed to communicate with Ollama: ${err instanceof Error ? err.message : String(err)}`,
        recoverable: true,
        retryable: true,
      };
      return;
    }

    if (!response.ok) {
      yield {
        type: 'error',
        code: `HTTP_${response.status}`,
        message: `Ollama returned error HTTP status ${response.status}: ${response.statusText}`,
        recoverable: true,
        retryable: true,
      };
      return;
    }

    let fullExplanation = '';

    try {
      for await (const chunk of parseOllamaStream(response, signal)) {
        const tokenContent = chunk.message?.content || chunk.response || '';
        if (tokenContent) {
          fullExplanation += tokenContent;
          yield {
            type: 'token',
            token: tokenContent,
            content: tokenContent,
          };
        }
      }
    } catch (err) {
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
      yield {
        type: 'error',
        code: 'STREAM_DECODE_ERROR',
        message: `Failed during stream processing: ${err instanceof Error ? err.message : String(err)}`,
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

    // Strict Zod validation of the final response before yielding
    const parsedEnvelope = responseEnvelopeSchema.safeParse(finalEnvelope);
    if (!parsedEnvelope.success) {
      yield {
        type: 'error',
        code: 'INVALID_FINAL_ENVELOPE',
        message: `Failed to produce a schema-compliant ResponseEnvelope: ${parsedEnvelope.error.message}`,
        recoverable: false,
        retryable: false,
      };
      return;
    }

    yield {
      type: 'final',
      envelope: parsedEnvelope.data,
      response: parsedEnvelope.data,
    };
  }
}
