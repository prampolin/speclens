import { describe, it, expect } from 'vitest';
import {
  EmbeddingIndexer,
  LocalFlatVectorIndex,
  EmbeddingProvider,
  NormalizedOperation,
  VectorNamespaceKey,
} from '../src/index.js';

describe('EmbeddingIndexer & Reindexing Pipeline', () => {
  const mockProvider: EmbeddingProvider = {
    manifest: {
      id: 'mock-local-embed',
      kind: 'embedding',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'test-embed',
      modelRevision: 'v1.0',
      supportsOffline: true,
    },
    dimensions: async () => 3,
    readiness: async () => ({ ready: true }),
    embed: async () => [0.6, 0.8, 0],
    embedBatch: async (texts) => texts.map((_, i) => [i === 0 ? 1 : 0, i === 1 ? 1 : 0, 0]),
  };

  const sampleOps: NormalizedOperation[] = [
    {
      id: 'op-get-users',
      specificationId: 'spec-1',
      method: 'GET',
      path: '/api/v1/users',
      operationId: 'getUsers',
      summary: 'List users',
      description: 'Returns list of active system users',
      tags: ['Users', 'Admin'],
    },
    {
      id: 'op-post-users',
      specificationId: 'spec-1',
      method: 'POST',
      path: '/api/v1/users',
      operationId: 'createUser',
      summary: 'Create user',
      description: 'Registers a new user account',
      tags: ['Users'],
    },
  ];

  it('builds compact operation search text correctly', () => {
    const text = EmbeddingIndexer.buildOperationText(sampleOps[0]!);
    expect(text).toBe(
      'GET /api/v1/users getUsers List users Returns list of active system users Users Admin'
    );
  });

  it('indexes operations into vector index namespace', async () => {
    const vectorIndex = new LocalFlatVectorIndex();
    const indexer = new EmbeddingIndexer(vectorIndex);

    const result = await indexer.index(sampleOps, mockProvider, 'ns-active');
    expect(result.indexedCount).toBe(2);
    expect(vectorIndex.count('ns-active')).toBe(2);

    const searchHits = await vectorIndex.search('ns-active', [1, 0, 0], 5);
    expect(searchHits).toHaveLength(2);
    expect(searchHits[0]!.id).toBe('op-get-users');
    expect(searchHits[0]!.score).toBeCloseTo(1.0, 5);
  });

  it('supports staging and atomic commit to target namespace', async () => {
    const vectorIndex = new LocalFlatVectorIndex();
    const indexer = new EmbeddingIndexer(vectorIndex);

    const result = await indexer.stageAndCommit(
      sampleOps,
      mockProvider,
      'ns-target'
    );

    expect(result.namespace).toBe('ns-target');
    expect(result.indexedCount).toBe(2);
    expect(vectorIndex.count('ns-target')).toBe(2);

    // Verify staging namespace was cleaned up
    const allNamespaces = vectorIndex.listNamespaces();
    expect(allNamespaces).toEqual(['ns-target']);
  });

  it('asserts compatible spaces and rejects mismatching spaces', () => {
    const keyA: VectorNamespaceKey = {
      workspaceId: 'ws-1',
      specificationId: 'spec-1',
      providerId: 'transformers-local',
      modelId: 'bge-small',
      modelRevision: 'v1.0',
      dimensions: 384,
      chunkingVersion: 'v1.0.0',
    };

    const keyB: VectorNamespaceKey = {
      workspaceId: 'ws-1',
      specificationId: 'spec-1',
      providerId: 'transformers-local',
      modelId: 'bge-small',
      modelRevision: 'v2.0', // Different revision
      dimensions: 384,
      chunkingVersion: 'v1.0.0',
    };

    expect(() => {
      EmbeddingIndexer.assertCompatibleSpaces(keyA, keyB);
    }).toThrow(/Incompatible embedding spaces.*Reindex required/);
  });
});
