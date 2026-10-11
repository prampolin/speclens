import type { ExplanationEvent, ResponseEnvelope } from '../types.js';
import type { RetrievalResult, HybridQueryFilters } from '../retrieval/types.js';

export interface OrchestrationQuery {
  workspaceId: string;
  query: string;
  locale: 'pt-BR' | 'en-US';
  filters?: HybridQueryFilters;
}

export interface OrchestrationSummary {
  intent?: string;
  retrievalResults: RetrievalResult[];
  envelope: ResponseEnvelope;
}

export interface QueryOrchestrator {
  streamQuery(
    input: OrchestrationQuery,
    signal?: AbortSignal,
  ): AsyncIterable<ExplanationEvent>;
}
