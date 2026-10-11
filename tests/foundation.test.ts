import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../apps/web/src/lib/config';
import {
  workspaceSettingsSchema,
  providerManifestSchema,
  intentSchema,
  explanationEventSchema,
  responseEnvelopeSchema,
  normalizedOperationSchema,
  executionLocationSchema,
  providerKindSchema,
} from '../packages/ai-core/src/index';

describe('Fase 01 — Foundation Tests', () => {
  describe('Configuração de Privacidade', () => {
    it('deve ter privateMode ativado por padrão em DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG.privateMode).toBe(true);
      expect(DEFAULT_CONFIG.schemaVersion).toBe(1);
    });

    it('deve validar DEFAULT_CONFIG contra workspaceSettingsSchema', () => {
      const parsed = workspaceSettingsSchema.safeParse(DEFAULT_CONFIG);
      expect(parsed.success).toBe(true);
    });

    it('deve rejeitar workspaceSettings com topK não-positivo ou campos ausentes', () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        retrieval: {
          ...DEFAULT_CONFIG.retrieval,
          topK: -1,
        },
      };
      const parsed = workspaceSettingsSchema.safeParse(invalidConfig);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Contratos Centrais @speclens/ai-core', () => {
    it('deve validar e rejeitar executionLocation', () => {
      expect(executionLocationSchema.safeParse('local').success).toBe(true);
      expect(executionLocationSchema.safeParse('remote').success).toBe(true);
      expect(executionLocationSchema.safeParse('unknown').success).toBe(true);
      expect(executionLocationSchema.safeParse('cloud-unverified').success).toBe(false);
    });

    it('deve validar ProviderKind enum', () => {
      expect(providerKindSchema.safeParse('embedding').success).toBe(true);
      expect(providerKindSchema.safeParse('decision').success).toBe(true);
      expect(providerKindSchema.safeParse('llm').success).toBe(true);
      expect(providerKindSchema.safeParse('telemetry').success).toBe(false);
    });

    it('deve validar ProviderManifest válido', () => {
      const manifest = {
        id: 'transformers-local',
        kind: 'embedding' as const,
        implementationVersion: '1.0.0',
        executionLocation: 'local' as const,
        requiresNetwork: false,
        modelId: 'Xenova/all-MiniLM-L6-v2',
        modelRevision: 'main',
        supportsOffline: true,
      };
      const parsed = providerManifestSchema.safeParse(manifest);
      expect(parsed.success).toBe(true);
    });

    it('deve validar os quatro Intents controlados e rejeitar outros', () => {
      const validIntents = [
        'search_endpoint',
        'generate_code',
        'explain_schema',
        'compare_endpoints',
      ];
      for (const intent of validIntents) {
        expect(intentSchema.safeParse(intent).success).toBe(true);
      }
      expect(intentSchema.safeParse('arbitrary_chat').success).toBe(false);
    });

    it('deve validar ExplanationEvent discriminated union para cada tipo de evento', () => {
      const statusEvent = { type: 'status', stage: 'retrieval', message: 'Buscando endpoints' };
      const tokenEvent = { type: 'token', token: 'Olá' };
      const sourcesEvent = {
        type: 'sources',
        sources: [
          {
            specificationId: 'spec-1',
            operationId: 'listItems',
            method: 'GET',
            path: '/items',
            sourcePointer: '#/paths/~1items/get',
          },
        ],
      };
      const snippetsEvent = {
        type: 'snippets',
        snippets: [
          {
            language: 'curl',
            label: 'cURL',
            code: 'curl http://localhost/items',
            validated: true,
            validationWarnings: [],
          },
        ],
      };
      const finalEvent = {
        type: 'final',
        envelope: {
          schemaVersion: 1,
          query: 'Como listar itens?',
          answer: {
            locale: 'pt-BR',
            explanation: 'Use GET /items',
            limitations: [],
          },
          sources: sourcesEvent.sources,
          snippets: snippetsEvent.snippets,
        },
      };
      const errorEvent = {
        type: 'error',
        code: 'NOT_FOUND',
        message: 'Endpoint não localizado',
        recoverable: true,
      };

      expect(explanationEventSchema.safeParse(statusEvent).success).toBe(true);
      expect(explanationEventSchema.safeParse(tokenEvent).success).toBe(true);
      expect(explanationEventSchema.safeParse(sourcesEvent).success).toBe(true);
      expect(explanationEventSchema.safeParse(snippetsEvent).success).toBe(true);
      expect(explanationEventSchema.safeParse(finalEvent).success).toBe(true);
      expect(explanationEventSchema.safeParse(errorEvent).success).toBe(true);

      // Rejeitar evento com tipo desconhecido
      expect(explanationEventSchema.safeParse({ type: 'unknown_event' }).success).toBe(false);
    });

    it('deve validar NormalizedOperation canônica', () => {
      const op = {
        id: 'op-1',
        specificationId: 'spec-1',
        method: 'POST',
        path: '/v1/catalog/items',
        operationId: 'createCatalogItem',
        summary: 'Cadastra item no catálogo',
        description: 'Endpoint para criação de produto',
        tags: ['catalog'],
        servers: ['http://127.0.0.1:8080'],
        parameters: [
          {
            name: 'workspaceId',
            in: 'header' as const,
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBodies: [
          {
            required: true,
            mediaType: 'application/json',
            schema: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        ],
        responses: [
          {
            statusCode: '201',
            description: 'Criado com sucesso',
          },
        ],
        security: [{ schemeName: 'bearerAuth', scopes: [] }],
        sourcePointer: '#/paths/~1v1~1catalog~1items/post',
      };

      const parsed = normalizedOperationSchema.safeParse(op);
      expect(parsed.success).toBe(true);
    });

    it('deve validar ResponseEnvelope e rejeitar schemaVersion inválido', () => {
      const envelope = {
        schemaVersion: 1,
        query: 'Como cadastrar um produto?',
        answer: {
          locale: 'pt-BR' as const,
          explanation: 'Chame POST /v1/catalog/items.',
          limitations: [],
        },
        sources: [
          {
            specificationId: 'spec-1',
            operationId: 'createCatalogItem',
            method: 'POST',
            path: '/v1/catalog/items',
            sourcePointer: '#/paths/~1v1~1catalog~1items/post',
          },
        ],
        snippets: [
          {
            language: 'curl',
            label: 'cURL',
            code: 'curl -X POST http://localhost/v1/catalog/items',
            validated: true,
            validationWarnings: [],
          },
        ],
      };

      expect(responseEnvelopeSchema.safeParse(envelope).success).toBe(true);
      expect(responseEnvelopeSchema.safeParse({ ...envelope, schemaVersion: 0 }).success).toBe(
        false,
      );
    });
  });
});
