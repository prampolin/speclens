import type { ExplanationEvent } from '../types.js';
import type { QueryOrchestrator, OrchestrationQuery } from './types.js';

export class StubOrchestrator implements QueryOrchestrator {
  async *streamQuery(
    _input: OrchestrationQuery,
    _signal?: AbortSignal,
  ): AsyncIterable<ExplanationEvent> {
    yield {
      type: 'status',
      stage: 'orchestration',
      message: 'Orchestration pipeline initialized...',
    };
    throw new Error('QueryOrchestrator not yet fully implemented — awaiting full retrieval integration');
  }
}
