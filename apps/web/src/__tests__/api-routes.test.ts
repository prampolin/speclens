import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  OllamaLLMProvider,
  responseEnvelopeSchema,
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
      };
      yield {
        type: 'token',
        token: 'lista itens do catálogo.',
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
    vi.restoreAllMocks();
    try {
      testDb.close();
    } catch {
      // Ignore cleanup error
    }
    setTestDatabase(null);
  });

  describe('Inference switches', () => {
    it.each([
      { layaEnabled: false, llmEnabled: true },
      { layaEnabled: true, llmEnabled: false },
      { layaEnabled: true, llmEnabled: true },
    ])('persists and executes only enabled providers: %j', async (inference) => {
      const classify = vi.spyOn(mockDecisionProvider, 'classify');
      const explain = vi.spyOn(mockLLMProvider, 'streamExplanation');
      const decisionReadiness = vi.spyOn(mockDecisionProvider, 'readiness');
      const llmReadiness = vi.spyOn(mockLLMProvider, 'readiness');
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected egress'));
      const patch = await settingsPatch(new NextRequest('http://localhost/api/settings', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'default', settings: { inference } }),
      }));
      expect(patch.status).toBe(200);
      const saved = await patch.json();
      expect(saved.settings.inference).toEqual(inference);
      expect(saved.settings.privateMode).toBe(true);
      expect(saved.reindexRequired).toBe(false);
      const read = await settingsGet(new NextRequest('http://localhost/api/settings'));
      expect((await read.json()).settings.inference).toEqual(inference);
      await providersGet(new NextRequest('http://localhost/api/providers'));
      expect(decisionReadiness).toHaveBeenCalledTimes(inference.layaEnabled ? 1 : 0);
      expect(llmReadiness).toHaveBeenCalledTimes(inference.llmEnabled ? 1 : 0);
      const response = await chatPost(new NextRequest('http://localhost/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId: 'default', query: 'listar produtos' }),
      }));
      const stream = await response.text();
      expect(classify).toHaveBeenCalledTimes(inference.layaEnabled ? 1 : 0);
      expect(explain).toHaveBeenCalledTimes(inference.llmEnabled ? 1 : 0);
      expect(stream).toContain('"type":"retrieval"');
      expect(stream).toContain('"type":"final"');
      if (!inference.llmEnabled) expect(stream).toContain('LLM desativado nas configurações.');
      expect(network).not.toHaveBeenCalled();
    });

    it('rejects both disabled without overwriting saved settings', async () => {
      const before = await (await settingsGet(new NextRequest('http://localhost/api/settings'))).json();
      const response = await settingsPatch(new NextRequest('http://localhost/api/settings', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ settings: { inference: { layaEnabled: false, llmEnabled: false } } }),
      }));
      expect(response.status).toBe(400);
      const after = await (await settingsGet(new NextRequest('http://localhost/api/settings'))).json();
      expect(after).toEqual(before);
    });
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
      const response = await providersGet(new NextRequest('http://localhost:3000/api/providers?workspaceId=default'));
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

    it('deve rejeitar PATCH /api/settings quando lexicalEnabled e vectorEnabled estão ambos false (RAG-01)', async () => {
      const patchReq = new NextRequest('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          settings: {
            retrieval: {
              lexicalEnabled: false,
              vectorEnabled: false,
              topK: 5,
            },
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
    it.each(['multipart', 'raw'])('accepts an upload above 10 MiB via %s', async (mode) => {
      const content = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Large local fixture', version: '1.0.0' },
        paths: {},
        'x-padding': 'x'.repeat(10 * 1024 * 1024),
      });
      const form = new FormData();
      form.set('file', new File([content], 'large.json', { type: 'application/json' }));
      const response = await specsPost(new NextRequest('http://localhost/api/specifications', {
        method: 'POST', body: mode === 'multipart' ? form : content,
      }));
      expect(response.status).toBe(200);
      expect((await response.json()).title).toBe('Large local fixture');
    });

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
    it('integra 404 do Ollama com fallback citado e sem conteúdo sensível nos erros', async () => {
      const fixture = 'openapi: "3.0.0"\ninfo:\n  title: Ficticia\n  version: "1"\npaths:\n  /widgets:\n    get:\n      operationId: listWidgets\n      responses:\n        "200":\n          description: OK\n';
      await specsPost(new NextRequest('http://localhost:3000/api/specifications', { method: 'POST', body: fixture }));
      setLLMProvider(new OllamaLLMProvider({ modelId: 'missing:latest' }));
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url) => String(url).endsWith('/api/tags')
        ? Response.json({ models: [{ name: 'missing:latest' }] })
        : new Response('', { status: 404 });
      try {
        const response = await chatPost(new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST', body: JSON.stringify({ query: 'SENTINELA_CONSULTA widgets', workspaceId: 'default' }),
        }));
        const events = (await response.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
        const finals = events.filter((event) => event.type === 'final');
        expect(finals).toHaveLength(1);
        expect(responseEnvelopeSchema.safeParse(finals[0].envelope).success).toBe(true);
        expect(finals[0].envelope.sources.some((source: { path: string }) => source.path === '/widgets')).toBe(true);
        expect(finals[0].envelope.answer.limitations[0]).toContain('missing:latest');
        expect(finals[0].envelope.answer.explanation).toContain('/widgets');
        expect(events.some((event) => event.type === 'status' && event.message?.includes('MODEL_UNAVAILABLE'))).toBe(true);
        expect(JSON.stringify(events.filter((event) => event.type === 'status' || event.type === 'error'))).not.toContain('SENTINELA_CONSULTA');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
    it('descarta tokens parciais e registra o motivo seguro do fallback no final', async () => {
      setLLMProvider({
        ...mockLLMProvider,
        async *streamExplanation(): AsyncIterable<ExplanationEvent> {
          yield { type: 'token', token: 'SENTINELA_PARCIAL' };
          yield { type: 'error', code: 'MODEL_UNAVAILABLE', message: 'Modelo local ausente.', recoverable: true };
        },
      });
      const response = await chatPost(new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'consulta fictícia', workspaceId: 'default' }),
      }));
      const events = (await response.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
      const finals = events.filter((event) => event.type === 'final');
      expect(finals).toHaveLength(1);
      expect(finals[0].envelope.answer.explanation).not.toContain('SENTINELA_PARCIAL');
      expect(finals[0].envelope.answer.limitations).toContain('Resposta produzida sem LLM: Modelo local ausente.');
      expect(events.find((event) => event.type === 'status' && event.message?.includes('MODEL_UNAVAILABLE'))).toBeDefined();
    });
    it('recupera envelope inválido com um único final fundamentado', async () => {
      setLLMProvider({
        ...mockLLMProvider,
        async *streamExplanation(): AsyncIterable<ExplanationEvent> {
          yield { type: 'final', envelope: { schemaVersion: 2 as 1, query: 'x', answer: { locale: 'pt-BR', explanation: 'inválida', limitations: [] }, sources: [], snippets: [] } };
        },
      });
      const response = await chatPost(new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST', body: JSON.stringify({ query: 'consulta fictícia', workspaceId: 'default' }),
      }));
      const events = (await response.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
      expect(events.filter((event) => event.type === 'final')).toHaveLength(1);
    });
    it('encerra o provider no primeiro final validado e impede finais duplicados', async () => {
      let closed = false;
      let advancedPastFinal = false;
      setLLMProvider({
        ...mockLLMProvider,
        async *streamExplanation(): AsyncIterable<ExplanationEvent> {
          try {
            const envelope = { schemaVersion: 1 as const, query: 'x', answer: { locale: 'pt-BR' as const, explanation: 'Resposta fictícia', limitations: [] }, sources: [], snippets: [] };
            yield { type: 'final', envelope };
            advancedPastFinal = true;
            yield { type: 'final', envelope };
          } finally { closed = true; }
        },
      });
      const response = await chatPost(new NextRequest('http://localhost/api/chat', {
        method: 'POST', body: JSON.stringify({ query: 'consulta fictícia', workspaceId: 'default' }),
      }));
      const events = (await response.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
      expect(events.filter((event) => event.type === 'final')).toHaveLength(1);
      expect(closed).toBe(true);
      expect(advancedPastFinal).toBe(false);
    });
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
      expect(events.filter((e) => e.type === 'final')).toHaveLength(1);
      expect(responseEnvelopeSchema.safeParse(finalEvent.envelope).success).toBe(true);
      expect(finalEvent.envelope.schemaVersion).toBe(1);
      expect(finalEvent.envelope.answer.locale).toBe('pt-BR');
      expect(finalEvent.envelope.sources.length).toBeGreaterThan(0);
      expect(finalEvent.envelope.sources[0].path).toBe('/pets');
      expect(finalEvent.envelope.snippets.length).toBeGreaterThan(0);
      expect(finalEvent.envelope.snippets.every((snippet: { code: string }) => snippet.code.includes('/pets'))).toBe(true);
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
