import type { Database } from 'better-sqlite3';
import { OperationRepository } from '@speclens/db';
import { toIndexText, type NormalizedOperation } from '@speclens/openapi-core';
import type { EmbeddingProvider, VectorIndex, VectorNamespaceKey } from '../types.js';
import { namespaceId } from '../providers/embedding/namespace.js';

export interface IndexingProgress {
  stage: 'fts' | 'embedding' | 'vector_upsert' | 'complete';
  processed: number;
  total: number;
  message: string;
}

export type IndexingProgressCallback = (progress: IndexingProgress) => void;

export interface IndexOperationsOptions {
  db: Database;
  vectorIndex: VectorIndex;
  embeddingProvider: EmbeddingProvider;
  workspaceId: string;
  specificationId: string;
  operations: NormalizedOperation[];
  onProgress?: IndexingProgressCallback;
  signal?: AbortSignal;
  chunkingVersion?: string;
}

export interface IndexOperationsResult {
  indexedCount: number;
  namespace: string;
  durationMs: number;
}

/**
 * Coordinates indexing of operations into SQLite FTS5 (via OperationRepository)
 * and semantic embeddings into VectorIndex (using deterministic namespace fingerprint).
 */
export async function indexOperations(
  options: IndexOperationsOptions
): Promise<IndexOperationsResult> {
  const startTime = Date.now();
  const {
    db,
    vectorIndex,
    embeddingProvider,
    workspaceId,
    specificationId,
    operations,
    onProgress,
    signal,
    chunkingVersion = 'v1.0.0',
  } = options;

  if (signal?.aborted) {
    throw new Error('Indexing was cancelled before starting');
  }

  const total = operations.length;

  if (total === 0) {
    onProgress?.({
      stage: 'complete',
      processed: 0,
      total: 0,
      message: 'No operations to index',
    });
    return {
      indexedCount: 0,
      namespace: '',
      durationMs: Date.now() - startTime,
    };
  }

  // 1. Check readiness of embedding provider
  const readiness = await embeddingProvider.readiness();
  if (!readiness.ready) {
    throw new Error(
      `Embedding provider "${embeddingProvider.manifest.id}" is not ready: ${readiness.reason ?? 'unknown reason'}`
    );
  }

  // 2. FTS5 Indexing via OperationRepository
  onProgress?.({
    stage: 'fts',
    processed: 0,
    total,
    message: `Indexing ${total} operations in FTS5...`,
  });

  const operationRepo = new OperationRepository(db);

  // Prepare batch for repository
  const dbBatch = operations.map((op) => ({
    id: op.id,
    specificationId: op.specId || (op as unknown as { specificationId?: string }).specificationId || specificationId,
    method: op.method,
    path: op.path,
    operationId: op.operationId,
    tags: op.tags,
    normalizedJson: op,
    sourcePointer: op.sourcePointer,
    indexText: toIndexText(op),
  }));

  operationRepo.createBatch(dbBatch);

  onProgress?.({
    stage: 'fts',
    processed: total,
    total,
    message: `Indexed ${total} operations in FTS5`,
  });

  if (signal?.aborted) {
    throw new Error('Indexing cancelled after FTS5 storage');
  }

  // 3. Compute namespace fingerprint from provider manifest + dimensions
  const dims = await embeddingProvider.dimensions();
  const namespaceKey: VectorNamespaceKey = {
    workspaceId,
    specificationId,
    providerId: embeddingProvider.manifest.id,
    modelId: embeddingProvider.manifest.modelId,
    modelRevision: embeddingProvider.manifest.modelRevision,
    dimensions: dims,
    chunkingVersion,
  };
  const targetNamespace = namespaceId(namespaceKey);

  // 4. Generate embeddings
  onProgress?.({
    stage: 'embedding',
    processed: 0,
    total,
    message: `Generating vector embeddings for ${total} operations...`,
  });

  // Dense search text generated via toIndexText for optimal matching consistency
  const searchTexts = operations.map((op) => toIndexText(op));
  const vectors = await embeddingProvider.embedBatch(searchTexts, signal);

  onProgress?.({
    stage: 'vector_upsert',
    processed: 0,
    total,
    message: `Upserting vectors into namespace ${targetNamespace}...`,
  });

  const indexedVectors = operations.map((op, idx) => ({
    id: op.id,
    vector: vectors[idx]!,
    metadata: {
      operationId: op.operationId,
      specificationId: op.specId || (op as unknown as { specificationId?: string }).specificationId || specificationId,
      method: op.method,
      path: op.path,
      tags: op.tags,
      summary: op.summary,
    },
  }));

  await vectorIndex.upsert(targetNamespace, indexedVectors);

  onProgress?.({
    stage: 'complete',
    processed: total,
    total,
    message: `Successfully indexed ${total} operations in FTS5 and vector index`,
  });

  return {
    indexedCount: total,
    namespace: targetNamespace,
    durationMs: Date.now() - startTime,
  };
}
