import { describe, it, expect } from 'vitest';
import {
  RuleDecisionProvider,
  LayaLocalProvider,
  DecisionOrchestrator,
  DecisionProvider,
  ProviderManifest,
} from '../src/index.js';

describe('Decision Providers & DecisionOrchestrator', () => {
  describe('RuleDecisionProvider', () => {
    const ruleProvider = new RuleDecisionProvider();

    it('declares local manifest with no network requirements', () => {
      expect(ruleProvider.manifest.executionLocation).toBe('local');
      expect(ruleProvider.manifest.requiresNetwork).toBe(false);
      expect(ruleProvider.manifest.supportsOffline).toBe(true);
    });

    it('classifies generate_code in PT and EN', async () => {
      const pt1 = await ruleProvider.classify('gerar exemplo em curl para criar produto');
      expect(pt1.intent).toBe('generate_code');
      expect(pt1.confidence).toBeNull();
      expect(pt1.abstained).toBe(false);

      const en1 = await ruleProvider.classify('generate fetch code snippet');
      expect(en1.intent).toBe('generate_code');

      const pt2 = await ruleProvider.classify('como gerar payload do pedido em python');
      expect(pt2.intent).toBe('generate_code');
    });

    it('classifies explain_schema in PT and EN', async () => {
      const pt1 = await ruleProvider.classify('o que é o campo discountPercentage?');
      expect(pt1.intent).toBe('explain_schema');

      const en1 = await ruleProvider.classify('explain the User schema model details');
      expect(en1.intent).toBe('explain_schema');

      const pt2 = await ruleProvider.classify('explique a estrutura da resposta');
      expect(pt2.intent).toBe('explain_schema');
    });

    it('classifies compare_endpoints in PT and EN', async () => {
      const pt1 = await ruleProvider.classify('qual a diferença entre /v1/users e /v2/users?');
      expect(pt1.intent).toBe('compare_endpoints');

      const en1 = await ruleProvider.classify('compare /checkout vs /payment endpoints');
      expect(en1.intent).toBe('compare_endpoints');

      const pt2 = await ruleProvider.classify('comparar endpoints de consulta');
      expect(pt2.intent).toBe('compare_endpoints');
    });

    it('defaults to search_endpoint for general queries', async () => {
      const pt = await ruleProvider.classify('como listar todos os clientes cadastrados?');
      expect(pt.intent).toBe('search_endpoint');

      const en = await ruleProvider.classify('find endpoint to delete account');
      expect(en.intent).toBe('search_endpoint');
    });
  });

  describe('LayaLocalProvider', () => {
    it('returns ready=false with clear reason when weights do not exist', async () => {
      const laya = new LayaLocalProvider({
        modelPath: '/nonexistent/path/to/laya-onnx',
      });

      const readiness = await laya.readiness();
      expect(readiness.ready).toBe(false);
      expect(readiness.reason).toContain('Laya weights not found');
    });

    it('refuses to classify without weights and throws clear error', async () => {
      const laya = new LayaLocalProvider({
        modelPath: '/nonexistent/path/to/laya-onnx',
      });

      await expect(laya.classify('test input')).rejects.toThrow(
        /LayaLocalProvider not ready.*Cannot classify without weights/
      );
    });
  });

  describe('DecisionOrchestrator Fallback Handling', () => {
    const fallbackProvider = new RuleDecisionProvider();

    it('uses fallback automatically when primary is not ready', async () => {
      const unreadyLaya = new LayaLocalProvider({
        modelPath: '/nonexistent/weights',
      });

      const orchestrator = new DecisionOrchestrator(
        unreadyLaya,
        fallbackProvider
      );

      const result = await orchestrator.classify('gerar curl para criar pedido');
      expect(result.intent).toBe('generate_code');
      expect(result.providerId).toBe('rule-based');
    });

    it('uses fallback when primary throws an error during classification', async () => {
      const throwingPrimary: DecisionProvider = {
        manifest: {
          id: 'faulty-laya',
          kind: 'decision',
          implementationVersion: '1.0.0',
          executionLocation: 'local',
          requiresNetwork: false,
          modelId: 'laya',
          modelRevision: '1.0',
          supportsOffline: true,
        },
        readiness: async () => ({ ready: true }),
        classify: async () => {
          throw new Error('Runtime ONNX crash');
        },
      };

      const orchestrator = new DecisionOrchestrator(
        throwingPrimary,
        fallbackProvider
      );

      const result = await orchestrator.classify('o que é este endpoint?');
      expect(result.intent).toBe('explain_schema');
      expect(result.providerId).toBe('rule-based');
    });

    it('uses fallback when primary confidence is below threshold (0.7)', async () => {
      const lowConfidencePrimary: DecisionProvider = {
        manifest: {
          id: 'low-conf-primary',
          kind: 'decision',
          implementationVersion: '1.0.0',
          executionLocation: 'local',
          requiresNetwork: false,
          modelId: 'laya',
          modelRevision: '1.0',
          supportsOffline: true,
        },
        readiness: async () => ({ ready: true }),
        classify: async () => ({
          intent: 'search_endpoint',
          confidence: 0.55, // Below 0.7
          abstained: false,
        }),
      };

      const orchestrator = new DecisionOrchestrator(
        lowConfidencePrimary,
        fallbackProvider,
        { confidenceThreshold: 0.7 }
      );

      const result = await orchestrator.classify('gerar snippet python');
      expect(result.intent).toBe('generate_code');
      expect(result.providerId).toBe('rule-based');
    });

    it('uses primary when primary is ready and confidence meets threshold', async () => {
      const confidentPrimary: DecisionProvider = {
        manifest: {
          id: 'confident-primary',
          kind: 'decision',
          implementationVersion: '1.0.0',
          executionLocation: 'local',
          requiresNetwork: false,
          modelId: 'laya',
          modelRevision: '1.0',
          supportsOffline: true,
        },
        readiness: async () => ({ ready: true }),
        classify: async () => ({
          intent: 'compare_endpoints',
          confidence: 0.92,
          abstained: false,
        }),
      };

      const orchestrator = new DecisionOrchestrator(
        confidentPrimary,
        fallbackProvider,
        { confidenceThreshold: 0.7 }
      );

      const result = await orchestrator.classify('qual a diferenca');
      expect(result.intent).toBe('compare_endpoints');
      expect(result.confidence).toBe(0.92);
      expect(result.providerId).toBe('confident-primary');
    });

    it('uses fallback when primary explicitly abstains', async () => {
      const abstainingPrimary: DecisionProvider = {
        manifest: {
          id: 'abstaining-primary',
          kind: 'decision',
          implementationVersion: '1.0.0',
          executionLocation: 'local',
          requiresNetwork: false,
          modelId: 'laya',
          modelRevision: '1.0',
          supportsOffline: true,
        },
        readiness: async () => ({ ready: true }),
        classify: async () => ({
          intent: null,
          confidence: null,
          abstained: true,
        }),
      };

      const orchestrator = new DecisionOrchestrator(
        abstainingPrimary,
        fallbackProvider
      );

      const result = await orchestrator.classify('gerar curl');
      expect(result.intent).toBe('generate_code');
      expect(result.providerId).toBe('rule-based');
    });
  });
});
