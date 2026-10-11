import type { OllamaStreamChunk } from './types.js';
import { ollamaStreamChunkSchema } from './schemas.js';

export class OllamaStreamParseError extends Error {
  constructor(message: string, public readonly rawLine?: string) {
    super(message);
    this.name = 'OllamaStreamParseError';
  }
}

/**
 * Parses an NDJSON response stream from Ollama line by line.
 * Validates each chunk with Zod schema before yielding.
 * Respects AbortSignal cancellation.
 */
export async function* parseOllamaStream(
  response: Response,
  signal?: AbortSignal,
): AsyncIterable<OllamaStreamChunk> {
  if (!response.body) {
    throw new OllamaStreamParseError('Response body is null or undefined.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw signal.reason || new Error('Stream operation aborted by signal.');
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // The last element is either empty (if ended with \n) or an incomplete line
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (signal?.aborted) {
          throw signal.reason || new Error('Stream operation aborted by signal.');
        }

        let json: unknown;
        try {
          json = JSON.parse(trimmed);
        } catch (err) {
          throw new OllamaStreamParseError(
            `Failed to parse NDJSON line as JSON: ${err instanceof Error ? err.message : String(err)}`,
            trimmed,
          );
        }

        const parseResult = ollamaStreamChunkSchema.safeParse(json);
        if (!parseResult.success) {
          throw new OllamaStreamParseError(
            `Ollama stream chunk validation failed: ${parseResult.error.message}`,
            trimmed,
          );
        }

        yield parseResult.data as OllamaStreamChunk;
      }
    }

    // Flush any remaining buffered line
    const remaining = buffer.trim();
    if (remaining) {
      if (signal?.aborted) {
        throw signal.reason || new Error('Stream operation aborted by signal.');
      }

      let json: unknown;
      try {
        json = JSON.parse(remaining);
      } catch (err) {
        throw new OllamaStreamParseError(
          `Failed to parse remaining NDJSON line as JSON: ${err instanceof Error ? err.message : String(err)}`,
          remaining,
        );
      }

      const parseResult = ollamaStreamChunkSchema.safeParse(json);
      if (!parseResult.success) {
        throw new OllamaStreamParseError(
          `Ollama stream chunk validation failed: ${parseResult.error.message}`,
          remaining,
        );
      }

      yield parseResult.data as OllamaStreamChunk;
    }
  } finally {
    reader.releaseLock();
  }
}
