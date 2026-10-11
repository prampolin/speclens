export * from './types.js';
export * from './hybrid-retrieval.js';
export * from './indexer.js';
export * from './schema-hydrator.js';

import type { HybridQuery, HybridRetrieval } from './types.js';

// Backward compatibility alias for stub if needed
export class StubHybridRetrieval implements HybridRetrieval {
  async search(_query?: HybridQuery): Promise<never> {
    throw new NotImplementedError('HybridRetrieval not yet implemented — see Fase 05');
  }
}

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}
