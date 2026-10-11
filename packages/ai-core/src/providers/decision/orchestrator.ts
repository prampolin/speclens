import {
  ClassifyResult,
  DecisionProvider,
  Intent,
} from '../types.js';

export interface DecisionOrchestratorOptions {
  confidenceThreshold?: number; // Default 0.7
}

export class DecisionOrchestrator {
  public readonly confidenceThreshold: number;

  constructor(
    public readonly primary: DecisionProvider,
    public readonly fallback: DecisionProvider,
    options?: DecisionOrchestratorOptions
  ) {
    this.confidenceThreshold = options?.confidenceThreshold ?? 0.7;
  }

  /**
   * Classifies input with automatic graceful fallback:
   * 1. If primary provider is not ready -> use fallback
   * 2. If primary throws or errors -> use fallback
   * 3. If primary abstains or confidence < threshold -> use fallback
   * 4. Tracks which provider produced the final decision in providerId
   */
  public async classify(
    input: string,
    candidates?: Intent[],
    signal?: AbortSignal
  ): Promise<ClassifyResult> {
    if (signal?.aborted) {
      throw new Error('Classification aborted by signal.');
    }

    // 1. Check primary readiness
    const readiness = await this.primary.readiness();
    if (!readiness.ready) {
      const fallbackResult = await this.fallback.classify(
        input,
        candidates,
        signal
      );
      return {
        ...fallbackResult,
        providerId: this.fallback.manifest.id,
      };
    }

    // 2. Execute primary with error handling
    try {
      const primaryResult = await this.primary.classify(
        input,
        candidates,
        signal
      );

      // Check abstention or low confidence
      const belowThreshold =
        primaryResult.confidence !== null &&
        primaryResult.confidence < this.confidenceThreshold;

      if (primaryResult.abstained || belowThreshold) {
        const fallbackResult = await this.fallback.classify(
          input,
          candidates,
          signal
        );
        return {
          ...fallbackResult,
          providerId: this.fallback.manifest.id,
        };
      }

      return {
        ...primaryResult,
        providerId: this.primary.manifest.id,
      };
    } catch {
      // Primary threw error -> use safe offline fallback
      const fallbackResult = await this.fallback.classify(
        input,
        candidates,
        signal
      );
      return {
        ...fallbackResult,
        providerId: this.fallback.manifest.id,
      };
    }
  }
}
