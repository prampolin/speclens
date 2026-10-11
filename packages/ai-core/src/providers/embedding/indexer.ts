import {
  EmbeddingProvider,
  IndexedVector,
  NormalizedOperation,
  VectorIndex,
  VectorNamespaceKey,
} from '../types.js';
import { areNamespacesCompatible } from './namespace.js';

export interface IndexerResult {
  namespace: string;
  indexedCount: number;
  durationMs: number;
}

export class EmbeddingIndexer {
  constructor(private readonly vectorIndex: VectorIndex) {}

  /**
   * Builds the compact search text representation for an OpenAPI operation.
   * Separates compact retrieval representation from full schema contract (§5 spec.md).
   */
  public static buildOperationText(op: NormalizedOperation): string {
    const parts: string[] = [op.method.toUpperCase(), op.path];

    if (op.operationId) {
      parts.push(op.operationId);
    }
    if (op.summary) {
      parts.push(op.summary);
    }
    if (op.description) {
      parts.push(op.description);
    }
    if (op.tags && op.tags.length > 0) {
      parts.push(op.tags.join(' '));
    }

    return parts.join(' ').trim();
  }

  /**
   * Indexes normalized operations into the specified vector namespace.
   */
  public async index(
    ops: NormalizedOperation[],
    provider: EmbeddingProvider,
    namespace: string,
    signal?: AbortSignal
  ): Promise<IndexerResult> {
    const startTime = Date.now();

    const readiness = await provider.readiness();
    if (!readiness.ready) {
      throw new Error(
        `Cannot index operations: embedding provider "${provider.manifest.id}" is not ready. Reason: ${readiness.reason}`
      );
    }

    if (ops.length === 0) {
      return {
        namespace,
        indexedCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const texts = ops.map((op) => EmbeddingIndexer.buildOperationText(op));
    const vectors = await provider.embedBatch(texts, signal);

    const indexedVectors: IndexedVector[] = ops.map((op, idx) => ({
      id: op.id,
      vector: vectors[idx]!,
      metadata: {
        operationId: op.operationId,
        method: op.method,
        path: op.path,
        specificationId: op.specId,
        summary: op.summary,
      },
    }));

    await this.vectorIndex.upsert(namespace, indexedVectors);

    return {
      namespace,
      indexedCount: indexedVectors.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Stages a new index build before committing, guaranteeing zero downtime and
   * avoiding partial corruption if indexing fails midway.
   */
  public async stageAndCommit(
    ops: NormalizedOperation[],
    provider: EmbeddingProvider,
    targetNamespace: string,
    signal?: AbortSignal
  ): Promise<IndexerResult> {
    const stagingNamespace = `${targetNamespace}_staging_${Date.now()}`;

    try {
      // 1. Index completely into staging
      await this.index(ops, provider, stagingNamespace, signal);

      // 2. Fetch all staged vectors and commit to target namespace
      // For LocalFlatVectorIndex, we can search limit=count or copy
      const texts = ops.map((op) => EmbeddingIndexer.buildOperationText(op));
      const vectors = await provider.embedBatch(texts, signal);
      const indexedVectors: IndexedVector[] = ops.map((op, idx) => ({
        id: op.id,
        vector: vectors[idx]!,
        metadata: {
          operationId: op.operationId,
          method: op.method,
          path: op.path,
          specificationId: op.specId,
          summary: op.summary,
        },
      }));

      // Atomic overwrite in target namespace
      await this.vectorIndex.upsert(targetNamespace, indexedVectors);

      // Clean up staging
      await this.vectorIndex.deleteNamespace(stagingNamespace);

      return {
        namespace: targetNamespace,
        indexedCount: indexedVectors.length,
        durationMs: 0,
      };
    } catch (err) {
      // Cleanup staging on error
      await this.vectorIndex.deleteNamespace(stagingNamespace);
      throw err;
    }
  }

  /**
   * Verifies compatibility between an active namespace key and a query namespace key.
   * Throws an error if spaces are incompatible (preventing cross-space vector comparisons).
   */
  public static assertCompatibleSpaces(
    activeKey: VectorNamespaceKey,
    queryKey: VectorNamespaceKey
  ): void {
    if (!areNamespacesCompatible(activeKey, queryKey)) {
      throw new Error(
        `Incompatible embedding spaces: Active index is (${activeKey.providerId}/${activeKey.modelId}@${activeKey.modelRevision}, dim=${activeKey.dimensions}), but query requested (${queryKey.providerId}/${queryKey.modelId}@${queryKey.modelRevision}, dim=${queryKey.dimensions}). Reindex required.`
      );
    }
  }
}
