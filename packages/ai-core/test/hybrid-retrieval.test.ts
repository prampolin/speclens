import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, type Database, OperationRepository, WorkspaceRepository, SpecificationRepository } from '@speclens/db';
import type { NormalizedOperation } from '@speclens/openapi-core';
import {
  HybridRetrievalImpl,
  indexOperations,
  hydrateOperations,
  LocalFlatVectorIndex,
  type EmbeddingProvider,
  type RetrievalResult,
} from '../src/index.js';

describe('Fase 05 — Hybrid Retrieval & RAG Inspector', () => {
  let db: Database;
  let vectorIndex: LocalFlatVectorIndex;

  // Mock embedding provider with deterministic semantic mapping
  const mockEmbeddingProvider: EmbeddingProvider = {
    manifest: {
      id: 'mock-local-embed',
      kind: 'embedding',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'test-semantic-embed',
      modelRevision: 'v1.0',
      supportsOffline: true,
    },
    dimensions: async () => 3,
    readiness: async () => ({ ready: true }),
    embed: async (text: string) => {
      const lower = text.toLowerCase();
      // Dimension 0: Users / accounts
      // Dimension 1: Pets / animals / dogs / cats
      // Dimension 2: Orders / payments
      let d0 = 0.05;
      let d1 = 0.05;
      let d2 = 0.05;

      if (lower.includes('user') || lower.includes('usuário') || lower.includes('conta')) {
        d0 += 0.9;
      }
      if (
        lower.includes('pet') ||
        lower.includes('animal') ||
        lower.includes('cachorro') ||
        lower.includes('gato')
      ) {
        d1 += 0.9;
      }
      if (
        lower.includes('order') ||
        lower.includes('pedido') ||
        lower.includes('pagamento') ||
        lower.includes('compra')
      ) {
        d2 += 0.9;
      }

      // Normalize L2
      const norm = Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2);
      return [d0 / norm, d1 / norm, d2 / norm];
    },
    embedBatch: async function (texts: string[]) {
      return Promise.all(texts.map((t) => this.embed(t)));
    },
  };

  const sampleOps: NormalizedOperation[] = [
    {
      id: 'op-list-pets',
      specId: 'spec-petstore',
      method: 'get',
      path: '/pets',
      operationId: 'listPets',
      summary: 'List all pets in store',
      description: 'Returns a paged list of pets and animals',
      tags: ['pets'],
      servers: [],
      parameters: [],
      responses: {},
      security: [],
      sourcePointer: '#/paths/~1pets/get',
    },
    {
      id: 'op-create-pet',
      specId: 'spec-petstore',
      method: 'post',
      path: '/pets',
      operationId: 'createPet',
      summary: 'Create a new pet',
      description: 'Registers a new animal in inventory',
      tags: ['pets'],
      servers: [],
      parameters: [],
      responses: {},
      security: [],
      sourcePointer: '#/paths/~1pets/post',
    },
    {
      id: 'op-get-pet-by-id',
      specId: 'spec-petstore',
      method: 'get',
      path: '/pets/{petId}',
      operationId: 'showPetById',
      summary: 'Info for a specific pet',
      description: 'Fetch animal profile by its unique identifier',
      tags: ['pets'],
      servers: [],
      parameters: [],
      responses: {},
      security: [],
      sourcePointer: '#/paths/~1pets~1{petId}/get',
    },
    {
      id: 'op-get-users',
      specId: 'spec-petstore',
      method: 'get',
      path: '/users',
      operationId: 'getUsers',
      summary: 'List users and accounts',
      description: 'Retrieve registered users',
      tags: ['users'],
      servers: [],
      parameters: [],
      responses: {},
      security: [],
      sourcePointer: '#/paths/~1users/get',
    },
    {
      id: 'op-create-order',
      specId: 'spec-petstore',
      method: 'post',
      path: '/store/order',
      operationId: 'placeOrder',
      summary: 'Place purchase order for pet',
      description: 'Create an order payment for buying pet',
      tags: ['store'],
      servers: [],
      parameters: [],
      responses: {},
      security: [],
      sourcePointer: '#/paths/~1store~1order/post',
    },
  ];

  beforeEach(() => {
    db = createDatabase(':memory:');

    // Seed workspace & specification
    const wsRepo = new WorkspaceRepository(db);
    wsRepo.create({ id: 'ws-1', title: 'Test Workspace' });

    const specRepo = new SpecificationRepository(db);
    specRepo.create({
      id: 'spec-petstore',
      workspaceId: 'ws-1',
      title: 'Petstore API',
      version: '1.0.0',
      dialect: 'openapi-3.0',
      sourceChecksum: 'chk123',
      isActive: true,
    });

    vectorIndex = new LocalFlatVectorIndex();
  });

  it('05.01 — indexa operações em FTS5 e VectorIndex com progresso e namespace determinístico', async () => {
    const stages: string[] = [];
    const indexResult = await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
      onProgress: (p) => stages.push(p.stage),
    });

    expect(indexResult.indexedCount).toBe(5);
    expect(indexResult.namespace).toContain('ns_mock-local-embed_');
    expect(stages).toContain('fts');
    expect(stages).toContain('embedding');
    expect(stages).toContain('complete');

    // Check FTS count
    const opRepo = new OperationRepository(db);
    const ftsResults = opRepo.fullTextSearch('pets', { workspaceId: 'ws-1' });
    expect(ftsResults.length).toBeGreaterThan(0);

    // Check VectorIndex count
    expect(vectorIndex.count(indexResult.namespace)).toBe(5);
  });

  it('05.02 — busca exata por termo exato coloca operação correta no top-1', async () => {
    await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
    });

    const retriever = new HybridRetrievalImpl({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
    });

    const results = await retriever.search({
      text: 'showPetById',
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      topK: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.operationId).toBe('op-get-pet-by-id');
    expect(results[0]!.rank).toBe(1);
    expect(results[0]!.lexicalScore).not.toBeNull();
  });

  it('05.02 — busca semântica por sinônimo (animal / cachorro) traz candidato relevante no top-3', async () => {
    await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
    });

    const retriever = new HybridRetrievalImpl({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
    });

    const results = await retriever.search({
      text: 'cadastrar um novo animal cachorro',
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      topK: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    const topIds = results.slice(0, 3).map((r) => r.operationId);
    expect(topIds).toContain('op-create-pet');
    // Verify RAG Inspector metadata
    expect(results[0]!.vectorScore).toBeGreaterThan(0);
    expect(results[0]!.fusedScore).toBeGreaterThan(0);
  });

  it('05.02 — filtro por method="POST" retorna somente operações POST', async () => {
    await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
    });

    const retriever = new HybridRetrievalImpl({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
    });

    const results = await retriever.search({
      text: 'pet',
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      filters: { methods: ['POST'] },
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.method).toBe('POST');
    }
  });

  it('05.04 — busca vazia ou sem matches retorna [] sem erro (nunca inventa)', async () => {
    await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
    });

    const retriever = new HybridRetrievalImpl({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
    });

    // Query nonexistent with strict filter that eliminates all
    const results = await retriever.search({
      text: 'unmatched query string',
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      filters: { methods: ['DELETE'] },
      topK: 5,
    });

    expect(results).toEqual([]);
  });

  it('05.04 — RRF é determinístico para mesmos inputs', async () => {
    await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
    });

    const retriever = new HybridRetrievalImpl({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
    });

    const query = {
      text: 'buscar dados do usuario',
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      topK: 5,
    };

    const run1 = await retriever.search(query);
    const run2 = await retriever.search(query);

    expect(run1).toEqual(run2);
  });

  it('05.03 — hydrateOperations retorna JSON canônico completo apenas para candidatos selecionados', async () => {
    await indexOperations({
      db,
      vectorIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'ws-1',
      specificationId: 'spec-petstore',
      operations: sampleOps,
    });

    const mockResults: RetrievalResult[] = [
      {
        operationId: 'op-list-pets',
        specificationId: 'spec-petstore',
        method: 'GET',
        path: '/pets',
        lexicalScore: 0.1,
        vectorScore: 0.9,
        fusedScore: 0.03,
        rank: 1,
        lexicalRank: 1,
        vectorRank: 1,
      },
      {
        operationId: 'op-create-order',
        specificationId: 'spec-petstore',
        method: 'POST',
        path: '/store/order',
        lexicalScore: 0.1,
        vectorScore: 0.8,
        fusedScore: 0.02,
        rank: 2,
        lexicalRank: 2,
        vectorRank: 2,
      },
    ];

    const repo = new OperationRepository(db);
    const hydrated = await hydrateOperations(mockResults, repo);

    expect(hydrated).toHaveLength(2);
    expect(hydrated[0]!.operationId).toBe('listPets');
    expect(hydrated[0]!.path).toBe('/pets');
    expect(hydrated[1]!.operationId).toBe('placeOrder');
    expect(hydrated[1]!.path).toBe('/store/order');
  });
});
