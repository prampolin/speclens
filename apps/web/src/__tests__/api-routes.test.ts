import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createDatabase, type Database } from '@speclens/db';
import { setTestDatabase } from '@/lib/server/db';
import {
  setEmbeddingProvider,
  setDecisionProvider,
  setLLMProvider,
  setVectorIndex,
} from '@/lib/server/providers';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as providersGet } from '@/app/api/providers/route';
import { GET as settingsGet, PATCH as settingsPatch } from '@/app/api/settings/route';
import { GET as specsGet, POST as specsPost } from '@/app/api/specifications/route';
import { POST as chatPost } from '@/app/api/chat/route';
import { GET as operationGet } from '@/app/api/operations/[id]/route';
import {
  LocalFlatVectorIndex,
  type EmbeddingProvider,
  type DecisionProvider,
  type LLMProvider,
  type ExplanationEvent,
} from '@speclens/ai-core';

describe('Fase 09 — API Routes Vitest Unit Tests', () => {
  let testDb: Database;

  // Mock Providers for deterministic testing
  const mockEmbeddingProvider: EmbeddingProvider = {
    manifest: {
      id: 'mock-embed',
      kind: 'embedding',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'test-embed',
      modelRevision: '1.0',
      supportsOffline: true,
    },
    dimensions: async () => 3,
    readiness: async () => ({ ready: true }),
    embed: async () => [0.1, 0.2, 0.3],
    embedBatch: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
  };

  const mockDecisionProvider: DecisionProvider = {
    manifest: {
      id: 'mock-decision',
      kind: 'decision',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'test-decision',
      modelRevision: '1.0',
      supportsOffline: true,
    },
    readiness: async () => ({ ready: true }),
    classify: async () => ({
      intent: 'search_endpoint',
      confidence: 0.95,
      abstained: false,
    }),
  };

  const mockLLMProvider: LLMProvider = {
    manifest: {
      id: 'mock-llm',
      kind: 'llm',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'test-llm',
      modelRevision: '1.0',
      supportsOffline: true,
    },
    readiness: async () => ({ ready: true }),
    async *streamExplanation(input): AsyncIterable<ExplanationEvent> {
      yield {
        type: 'status',
        stage: 'grounding',
        message: 'Fundamentando...',
      };
      yield {
        type: 'sources',
        sources: input.groundedOperations.map((op) => ({
          specificationId: op.specId || 'spec-1',
          operationId: op.operationId,
          method: op.method,
          path: op.path,
          sourcePointer: op.sourcePointer,
        })),
      };
      yield {
        type: 'token',
        token: 'Esta operação ',
        content: 'Esta operação ',
      };
      yield {
        type: 'token',
        token: 'lista itens do catálogo.',
        content: 'lista itens do catálogo.',
      };
      yield {
        type: 'final',
        envelope: {
          schemaVersion: 1,
          query: input.query,
          answer: {
            locale: input.locale,
            explanation: 'Esta operação lista itens do catálogo.',
            limitations: [],
          },
          sources: input.groundedOperations.map((op) => ({
            specificationId: op.specId || 'spec-1',
            operationId: op.operationId,
            method: op.method,
            path: op.path,
            sourcePointer: op.sourcePointer,
          })),
          snippets: [],
        },
      };
    },
  };

  beforeEach(() => {
    testDb = createDatabase(':memory:');
    setTestDatabase(testDb);
    setVectorIndex(new LocalFlatVectorIndex());
    setEmbeddingProvider(mockEmbeddingProvider);
    setDecisionProvider(mockDecisionProvider);
    setLLMProvider(mockLLMProvider);
  });

  afterEach(() => {
    try {
      testDb.close();
    } catch {
      // Ignore cleanup error
    }
    setTestDatabase(null);
  });

  describe('GET /api/health', () => {
    it('deve retornar 200 com status do DB e provedores sem vazar documentos', async () => {
      const response = await healthGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe('ok');
      expect(json.db).toBe(true);
      expect(Array.isArray(json.providers)).toBe(true);
      expect(json.providers.length).toBe(3);

      // Verify no sensitive document data or prompt content is leaked
      expect(json).not.toHaveProperty('documents');
      expect(json).not.toHaveProperty('queries');
      expect(json).not.toHaveProperty('prompts');
    });
  });

  describe('GET /api/providers', () => {
    it('deve retornar lista de provedores registrados com readiness status', async () => {
      const response = await providersGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(Array.isArray(json.providers)).toBe(true);
      expect(json.providers[0]).toHaveProperty('id');
      expect(json.providers[0]).toHaveProperty('kind');
      expect(json.providers[0]).toHaveProperty('executionLocation');
      expect(json.providers[0]).toHaveProperty('ready');
    });
  });

  describe('Settings API (GET & PATCH /api/settings)', () => {
    it('deve ler configurações padrão via GET', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings?workspaceId=default');
      const res = await settingsGet(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.settings).toBeDefined();
      expect(json.settings.privateMode).toBe(true);
      expect(json.settings.embedding.providerId).toBeDefined();
    });

    it('deve salvar configurações e detectar reindexRequired quando embedding muda', async () => {
      const patchReq = new NextRequest('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          settings: {
            embedding: {
              providerId: 'new-local-embed',
              modelId: 'new-model-v2',
              revision: 'v2.0',
            },
          },
        }),
      });

      const res = await settingsPatch(patchReq);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.reindexRequired).toBe(true);
      expect(json.settings.embedding.providerId).toBe('new-local-embed');
    });

    it('deve rejeitar schema inválido com status 400', async () => {
      const patchReq = new NextRequest('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          settings: {
            schemaVersion: 'invalid-string', // should be number
          },
        }),
      });

      const res = await settingsPatch(patchReq);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/specifications', () => {
    it('deve rejeitar arquivo inválido com erro acionável', async () => {
      const req = new NextRequest('http://localhost:3000/api/specifications', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'invalid-content-not-openapi',
      });

      const res = await specsPost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBeDefined();
      expect(json.message).toBeDefined();
      expect(json.retryable).toBe(false);
    });

    it('deve importar especificação válida YAML e persistir operações', async () => {
      const petstoreYaml = `
openapi: "3.0.0"
info:
  title: "Petstore Mini"
  version: "1.0.0"
paths:
  /pets:
    get:
      summary: "List all pets"
      operationId: "listPets"
      responses:
        "200":
          description: "A paged array of pets"
`;

      const req = new NextRequest('http://localhost:3000/api/specifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-yaml' },
        body: petstoreYaml,
      });

      const res = await specsPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.specificationId).toBeDefined();
      expect(json.title).toBe('Petstore Mini');
      expect(json.operationCount).toBe(1);
      expect(json.jobId).toBeDefined();

      // List specs via GET
      const listReq = new NextRequest('http://localhost:3000/api/specifications?workspaceId=default');
      const listRes = await specsGet(listReq);
      const listJson = await listRes.json();
      expect(listJson.specifications.length).toBe(1);
      expect(listJson.specifications[0].operationCount).toBe(1);
    });
  });

  describe('GET /api/operations/:id', () => {
    it('deve retornar NormalizedOperation por ID e validar workspace', async () => {
      // First import a valid spec
      const petstoreYaml = `
openapi: "3.0.0"
info:
  title: "Petstore"
  version: "1.0.0"
paths:
  /pets:
    get:
      summary: "List all pets"
      operationId: "listPets"
      responses:
        "200":
          description: "OK"
`;
      const importReq = new NextRequest('http://localhost:3000/api/specifications', {
        method: 'POST',
        body: petstoreYaml,
      });
      const importRes = await specsPost(importReq);
      const importJson = await importRes.json();
      const specId = importJson.specificationId;

      // Operation ID convention: {specId}:get:/pets
      const opId = `${specId}:get:/pets`;

      const opReq = new NextRequest(`http://localhost:3000/api/operations/${opId}?workspaceId=default`);
      const opRes = await operationGet(opReq, { params: Promise.resolve({ id: opId }) });
      expect(opRes.status).toBe(200);

      const opJson = await opRes.json();
      expect(opJson.operation.method).toBe('get');
      expect(opJson.operation.path).toBe('/pets');
      expect(opJson.operation.operationId).toBe('listPets');
      expect(opJson.specification.title).toBe('Petstore');
    });

    it('deve retornar 404 para operação inexistente', async () => {
      const opReq = new NextRequest(`http://localhost:3000/api/operations/nonexistent?workspaceId=default`);
      const opRes = await operationGet(opReq, { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(opRes.status).toBe(404);
    });
  });

  describe('POST /api/chat (SSE streaming)', () => {
    it('deve emitir fluxo SSE estruturado com status, intent, sources e final', async () => {
      // Import a spec first
      const petstoreYaml = `
openapi: "3.0.0"
info:
  title: "Petstore"
  version: "1.0.0"
paths:
  /pets:
    get:
      summary: "List all pets"
      operationId: "listPets"
      responses:
        "200":
          description: "OK"
`;
      const importReq = new NextRequest('http://localhost:3000/api/specifications', {
        method: 'POST',
        body: petstoreYaml,
      });
      await specsPost(importReq);

      const chatReq = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'list all pets',
          workspaceId: 'default',
        }),
      });

      const response = await chatPost(chatReq);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      // Consume stream text
      const bodyText = await response.text();
      expect(bodyText).toContain('data: ');

      // Parse individual SSE events
      const events: any[] = [];
      const lines = bodyText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          events.push(JSON.parse(line.slice(6)));
        }
      }

      const types = events.map((e) => e.type);
      expect(types).toContain('status');
      expect(types).toContain('intent');
      expect(types).toContain('retrieval');
      expect(types).toContain('sources');
      expect(types).toContain('final');

      // Verify the final envelope structure
      const finalEvent = events.find((e) => e.type === 'final');
      expect(finalEvent).toBeDefined();
      expect(finalEvent.envelope.schemaVersion).toBe(1);
      expect(finalEvent.envelope.answer.locale).toBe('pt-BR');
      expect(finalEvent.envelope.sources.length).toBeGreaterThan(0);
      expect(finalEvent.envelope.sources[0].path).toBe('/pets');
    });

    it('deve retornar 400 para query vazia', async () => {
      const chatReq = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '   ',
          workspaceId: 'default',
        }),
      });

      const res = await chatPost(chatReq);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('EMPTY_QUERY');
    });
  });
});
