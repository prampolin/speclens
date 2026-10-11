import type { OperationRepository } from '@speclens/db';
import type { NormalizedOperation } from '@speclens/openapi-core';
import type { RetrievalResult } from './types.js';

/**
 * Hydrates full canonical NormalizedOperation schemas only for selected candidate operations.
 * Enforces lazy hydration (§4 FR-006 & §5):
 * Candidates are scored and ranked first using compact representations;
 * full JSON contracts are fetched strictly for the top-K selected candidates.
 */
export async function hydrateOperations(
  results: RetrievalResult[],
  repository: OperationRepository
): Promise<NormalizedOperation[]> {
  if (results.length === 0) {
    return [];
  }

  const hydratedOps: NormalizedOperation[] = [];

  for (const item of results) {
    const entity = repository.findById(item.operationId);
    if (!entity) {
      continue;
    }

    try {
      const parsed = typeof entity.normalizedJson === 'string'
        ? JSON.parse(entity.normalizedJson)
        : entity.normalizedJson;
      hydratedOps.push(parsed as NormalizedOperation);
    } catch {
      // In case of corrupt JSON, skip or continue safely
      continue;
    }
  }

  return hydratedOps;
}
