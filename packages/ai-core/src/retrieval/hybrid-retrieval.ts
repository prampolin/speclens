import type { HybridQuery, HybridRetrieval, RetrievalResult } from './types.js';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Stub implementation of HybridRetrieval for Phase 05 preparation.
 * Fails explicitly with informative message when called before Phase 05 implementation.
 */
export class StubHybridRetrieval implements HybridRetrieval {
  async search(_query: HybridQuery): Promise<RetrievalResult[]> {
    throw new NotImplementedError('HybridRetrieval not yet implemented — see Fase 05');
  }
}
