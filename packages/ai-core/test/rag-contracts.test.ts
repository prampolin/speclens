import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '@speclens/db';
import {
  specificationCapabilityDtoSchema,
  vectorGenerationIdentitySchema,
  retrievalExecutionMetadataSchema,
  canTransitionJobLifecycle,
  assertJobLifecycleTransition,
  canTransitionVectorCapability,
  assertVectorCapabilityTransition,
  IllegalStateTransitionError,
  mapLegacyJobStatusToLifecycle,
  deriveLegacyVectorCapability,
  deriveSpecificationCapabilityContract,
  WorkspaceOwnershipError,
  assertSpecificationOwnership,
  assertJobOwnership,
  assertOperationOwnership,
  assertNamespaceOwnership,
  verifyDatabaseSpecificationOwnership,
  verifyDatabaseJobOwnership,
  verifyDatabaseOperationOwnership,
  verifyDatabaseNamespaceOwnership,
  RAG_FIXTURE_IDS,
  PROMPT_INJECTION_SENTINEL,
  buildNormalizedFixtureOperations,
  seedRagRegressionFixtures,
  buildExplanationPrompt,
  workspaceSettingsSchema,
} from '../src/index.js';

describe('Phase 12 — RAG-01 Contracts & Regression Fixtures', () => {
  describe('State Transitions & Legacy Status Mapping', () => {
    it('allows valid job lifecycle transitions and rejects illegal transitions', () => {
      expect(canTransitionJobLifecycle('queued', 'running')).toBe(true);
      expect(canTransitionJobLifecycle('running', 'completed')).toBe(true);
      expect(canTransitionJobLifecycle('running', 'completed_with_warnings')).toBe(true);
      expect(canTransitionJobLifecycle('running', 'interrupted')).toBe(true);
      expect(canTransitionJobLifecycle('interrupted', 'running')).toBe(true);
      expect(canTransitionJobLifecycle('interrupted', 'queued')).toBe(true);

      // Illegal transitions
      expect(canTransitionJobLifecycle('queued', 'completed')).toBe(false);
      expect(canTransitionJobLifecycle('completed', 'running')).toBe(false);
      expect(canTransitionJobLifecycle('failed', 'completed')).toBe(false);
      expect(canTransitionJobLifecycle('cancelled', 'running')).toBe(false);

      expect(() => assertJobLifecycleTransition('queued', 'completed')).toThrow(
        IllegalStateTransitionError
      );
      expect(() => assertJobLifecycleTransition('completed', 'running')).toThrow(
        IllegalStateTransitionError
      );
    });

    it('allows valid vector capability transitions and rejects unbuilt ready jumps', () => {
      expect(canTransitionVectorCapability('pending', 'building')).toBe(true);
      expect(canTransitionVectorCapability('building', 'ready')).toBe(true);
      expect(canTransitionVectorCapability('ready', 'stale')).toBe(true);
      expect(canTransitionVectorCapability('stale', 'building')).toBe(true);

      // Illegal transitions: cannot jump to ready without building
      expect(canTransitionVectorCapability('pending', 'ready')).toBe(false);
      expect(canTransitionVectorCapability('unavailable', 'ready')).toBe(false);
      expect(canTransitionVectorCapability('failed', 'ready')).toBe(false);
      expect(canTransitionVectorCapability('disabled', 'ready')).toBe(false);
      expect(canTransitionVectorCapability('stale', 'ready')).toBe(false);

      expect(() => assertVectorCapabilityTransition('pending', 'ready')).toThrow(
        IllegalStateTransitionError
      );
      expect(() => assertVectorCapabilityTransition('failed', 'ready')).toThrow(
        IllegalStateTransitionError
      );
    });

    it('maps legacy job statuses and downgrades unverified legacy generations honestly', () => {
      expect(mapLegacyJobStatusToLifecycle('pending')).toBe('queued');
      expect(mapLegacyJobStatusToLifecycle('processing')).toBe('running');
      expect(mapLegacyJobStatusToLifecycle('completed')).toBe('completed');

      // Even if legacy status says "ready", without verified persisted generation it starts unavailable
      const unverified = deriveLegacyVectorCapability({
        legacyStatus: 'ready',
        hasVerifiedPersistedGeneration: false,
      });
      expect(unverified.vectorCapability).toBe('unavailable');
      expect(unverified.reasonCodes).toContain('INDEX_UNVERIFIED');

      const verified = deriveLegacyVectorCapability({
        legacyStatus: 'ready',
        hasVerifiedPersistedGeneration: true,
      });
      expect(verified.vectorCapability).toBe('ready');
      expect(verified.reasonCodes).toEqual([]);
    });
  });

  describe('Capability DTOs, Contradictory Readiness & Empty Specifications', () => {
    const validBaseDto = {
      workspaceId: 'ws-alpha',
      specificationId: 'spec-alpha-v2',
      specificationVersion: '2.0.0',
      isActive: true,
      operationCount: 6,
      embeddedOperationCount: 6,
      jobState: 'completed' as const,
      lexicalCapability: 'ready' as const,
      vectorCapability: 'ready' as const,
      effectiveRetrieval: 'hybrid' as const,
      activeGenerationId: 'gen-001',
      generationFingerprint: 'emb_transformers-local_abcdef123456',
      generationCommitted: true,
      retryable: false,
      reasonCodes: [],
      updatedAt: '2026-10-12T22:00:00.000Z',
    };

    it('accepts valid hybrid, degraded lexical_only, and intentionally disabled vector DTOs', () => {
      expect(specificationCapabilityDtoSchema.safeParse(validBaseDto).success).toBe(true);

      const degradedLexical = deriveSpecificationCapabilityContract({
        workspaceId: 'ws-alpha',
        specificationId: 'spec-alpha-v2',
        specificationVersion: '2.0.0',
        isActive: true,
        operationCount: 6,
        embeddedOperationCount: 0,
        lexicalEnabled: true,
        vectorEnabled: true,
        lexicalIndexed: true,
        generationCommitted: false,
        activeGenerationId: null,
        generationFingerprint: null,
        vectorFailureReason: 'MODEL_MISSING',
      });
      expect(degradedLexical.jobState).toBe('completed_with_warnings');
      expect(degradedLexical.lexicalCapability).toBe('ready');
      expect(degradedLexical.vectorCapability).toBe('unavailable');
      expect(degradedLexical.effectiveRetrieval).toBe('lexical_only');
      expect(degradedLexical.reasonCodes).toContain('MODEL_MISSING');

      const intentionalDisable = deriveSpecificationCapabilityContract({
        workspaceId: 'ws-alpha',
        specificationId: 'spec-alpha-v2',
        specificationVersion: '2.0.0',
        isActive: true,
        operationCount: 6,
        embeddedOperationCount: 0,
        lexicalEnabled: true,
        vectorEnabled: false,
        lexicalIndexed: true,
        generationCommitted: false,
        activeGenerationId: null,
        generationFingerprint: null,
      });
      expect(intentionalDisable.jobState).toBe('completed');
      expect(intentionalDisable.vectorCapability).toBe('disabled');
      expect(intentionalDisable.effectiveRetrieval).toBe('lexical_only');
      expect(intentionalDisable.reasonCodes).toContain('VECTOR_DISABLED');
    });

    it('rejects contradictory readiness claims (partial vectors, uncommitted generation, or silent warnings)', () => {
      // Partial vectors claiming ready
      expect(
        specificationCapabilityDtoSchema.safeParse({
          ...validBaseDto,
          embeddedOperationCount: 4,
        }).success
      ).toBe(false);

      // Uncommitted generation claiming ready
      expect(
        specificationCapabilityDtoSchema.safeParse({
          ...validBaseDto,
          generationCommitted: false,
        }).success
      ).toBe(false);

      // Unavailable vectors claiming jobState=completed instead of completed_with_warnings
      expect(
        specificationCapabilityDtoSchema.safeParse({
          ...validBaseDto,
          jobState: 'completed',
          vectorCapability: 'unavailable',
          effectiveRetrieval: 'lexical_only',
          embeddedOperationCount: 0,
          activeGenerationId: null,
          generationFingerprint: null,
          generationCommitted: false,
        }).success
      ).toBe(false);

      // Claiming hybrid retrieval when vectors are unavailable
      expect(
        specificationCapabilityDtoSchema.safeParse({
          ...validBaseDto,
          jobState: 'completed_with_warnings',
          vectorCapability: 'unavailable',
          effectiveRetrieval: 'hybrid',
          embeddedOperationCount: 0,
          activeGenerationId: null,
          generationFingerprint: null,
          generationCommitted: false,
        }).success
      ).toBe(false);

      // Policy violation claiming completed or retryable
      expect(
        specificationCapabilityDtoSchema.safeParse({
          ...validBaseDto,
          jobState: 'completed_with_warnings',
          vectorCapability: 'failed',
          effectiveRetrieval: 'lexical_only',
          embeddedOperationCount: 0,
          activeGenerationId: null,
          generationFingerprint: null,
          generationCommitted: false,
          retryable: true,
          reasonCodes: ['PRIVACY_POLICY_VIOLATION'],
        }).success
      ).toBe(false);
    });

    it('enforces explicit empty outcome for zero-operation specifications', () => {
      const emptyOutcome = deriveSpecificationCapabilityContract({
        workspaceId: 'ws-alpha',
        specificationId: 'spec-empty',
        specificationVersion: '1.0.0',
        isActive: true,
        operationCount: 0,
        embeddedOperationCount: 0,
        lexicalEnabled: true,
        vectorEnabled: true,
        lexicalIndexed: false,
        generationCommitted: false,
        activeGenerationId: null,
        generationFingerprint: null,
      });

      expect(emptyOutcome.operationCount).toBe(0);
      expect(emptyOutcome.vectorCapability).not.toBe('ready');
      expect(emptyOutcome.lexicalCapability).not.toBe('ready');
      expect(emptyOutcome.effectiveRetrieval).toBe('unavailable');
      expect(emptyOutcome.reasonCodes).toContain('EMPTY_SPECIFICATION');

      // Zero-operation spec cannot claim vectorCapability=ready
      expect(
        specificationCapabilityDtoSchema.safeParse({
          ...validBaseDto,
          operationCount: 0,
          embeddedOperationCount: 0,
          vectorCapability: 'ready',
        }).success
      ).toBe(false);
    });

    it('validates vectorGenerationIdentitySchema and retrievalExecutionMetadataSchema invariants', () => {
      const validGen = {
        generationId: 'gen-1',
        namespaceId: 'ns_transformers-local_1234',
        workspaceId: 'ws-alpha',
        specificationId: 'spec-alpha-v2',
        specificationVersion: '2.0.0',
        sourceChecksum: 'sha256:spec',
        embeddingFingerprint: 'emb_transformers-local_1234',
        embeddingSpace: {
          providerId: 'transformers-local',
          implementationVersion: '1.0.0',
          modelId: 'Xenova/all-MiniLM-L6-v2',
          modelRevision: 'rev-pinned',
          assetDigest: 'sha256:weights',
          dimensions: 384,
          pooling: 'mean' as const,
          normalize: true,
          preprocessingVersion: 'v1',
          operationTextVersion: 'v1',
          encodingVersion: 'float32_le_v1' as const,
        },
        expectedOperationCount: 6,
        embeddedOperationCount: 6,
        status: 'active' as const,
        committedAt: '2026-10-12T22:00:00.000Z',
        createdAt: '2026-10-12T21:59:00.000Z',
      };

      expect(vectorGenerationIdentitySchema.safeParse(validGen).success).toBe(true);
      expect(
        vectorGenerationIdentitySchema.safeParse({
          ...validGen,
          embeddedOperationCount: 5, // active generation cannot be partial
        }).success
      ).toBe(false);

      expect(
        retrievalExecutionMetadataSchema.safeParse({
          workspaceId: 'ws-alpha',
          specificationIds: ['spec-alpha-v2'],
          effectiveRetrieval: 'hybrid',
          explanationMode: 'llm',
          activeGenerationIds: [], // invalid for hybrid
          generationFingerprints: [],
          lexicalCandidateCount: 3,
          vectorCandidateCount: 3,
          reasonCodes: [],
        }).success
      ).toBe(false);

      expect(
        workspaceSettingsSchema.safeParse({
          schemaVersion: 1,
          workspaceId: 'ws-alpha',
          privateMode: true,
          embedding: {
            providerId: 'transformers-local',
            modelId: 'Xenova/all-MiniLM-L6-v2',
            revision: 'rev-1',
          },
          decision: {
            providerId: 'laya-local',
            modelId: 'convaiinnovations/laya',
          },
          llm: {
            providerId: 'ollama-local',
            modelId: 'llama3.2:3b',
          },
          retrieval: {
            lexicalEnabled: false,
            vectorEnabled: false,
            topK: 5,
          },
        }).success
      ).toBe(false);
    });
  });

  describe('Workspace Ownership Boundary Guards & Synthetic Regression Fixtures', () => {
    let db: Database;

    beforeEach(() => {
      db = createDatabase(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('builds and seeds synthetic regression fixtures with 2 workspaces, 2 versions, colliding operationIds, CRUD, local refs, nested bodies, responses/auth, and prompt injection', () => {
      const seeded = seedRagRegressionFixtures(db);

      expect(seeded.workspaces.alpha.id).toBe('ws-alpha');
      expect(seeded.workspaces.beta.id).toBe('ws-beta');

      expect(seeded.specifications.alphaV1.isActive).toBe(false);
      expect(seeded.specifications.alphaV2.isActive).toBe(true);
      expect(seeded.specifications.betaV1.isActive).toBe(true);

      // Colliding operationIds across workspaces and versions
      const alphaV1Ids = seeded.operations.alphaV1.map((op) => op.operationId);
      const alphaV2Ids = seeded.operations.alphaV2.map((op) => op.operationId);
      const betaV1Ids = seeded.operations.betaV1.map((op) => op.operationId);

      for (const collidingId of RAG_FIXTURE_IDS.collidingOperationIds) {
        expect(alphaV1Ids).toContain(collidingId);
        expect(alphaV2Ids).toContain(collidingId);
        expect(betaV1Ids).toContain(collidingId);
      }

      // Full CRUD methods in Alpha v2
      const alphaV2Methods = new Set(
        seeded.operations.alphaV2.map((op) => op.method.toUpperCase())
      );
      expect(alphaV2Methods).toEqual(new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']));

      // Local $refs resolved in parameters, nested request bodies (allOf + nested objects), and responses
      const createOrderV2 = seeded.operations.alphaV2.find(
        (op) => op.operationId === 'createOrder'
      )!;
      expect(createOrderV2).toBeDefined();
      expect(createOrderV2.security).toEqual([{ bearerAuth: [] }, { apiKeyAuth: [] }]);

      const jsonSchema = createOrderV2.requestBody?.content?.['application/json']
        ?.schema as Record<string, unknown>;
      expect(jsonSchema).toBeDefined();
      const serializedBodySchema = JSON.stringify(jsonSchema);
      expect(serializedBodySchema).toContain('billingAddress');
      expect(serializedBodySchema).toContain('postalCode');
      expect(serializedBodySchema).toContain('taxId');
      expect(serializedBodySchema).toContain('discount');
      expect(serializedBodySchema).toContain('percentage');

      // Responses & headers resolved from local $ref
      expect(Object.keys(createOrderV2.responses)).toEqual(
        expect.arrayContaining(['201', '400', '401', '422'])
      );
      expect(JSON.stringify(createOrderV2.responses['201'])).toContain('netTotalCents');

      // Prompt-injection string is preserved as untrusted operation data, never injected into system prompt
      expect(createOrderV2.description).toContain(PROMPT_INJECTION_SENTINEL);
      const builtPrompt = buildExplanationPrompt(
        'How do I create an order?',
        [createOrderV2],
        'en-US'
      );
      expect(builtPrompt.systemPrompt).not.toContain(PROMPT_INJECTION_SENTINEL);
      expect(builtPrompt.userPrompt).toContain(PROMPT_INJECTION_SENTINEL);
    });

    it('enforces ownership across specification, job, operation, and namespace boundaries and rejects forged ID prefixes', () => {
      const seeded = seedRagRegressionFixtures(db);

      // Valid ownership checks in ws-alpha for active v2
      expect(
        verifyDatabaseSpecificationOwnership(db, 'spec-alpha-v2', 'ws-alpha', {
          requireActive: true,
        }).verified
      ).toBe(true);
      expect(verifyDatabaseJobOwnership(db, 'job-alpha-v2', 'ws-alpha').verified).toBe(
        true
      );
      expect(
        verifyDatabaseOperationOwnership(
          db,
          'spec-alpha-v2:post:/v2/orders',
          'ws-alpha',
          { requireActiveSpec: true }
        ).verified
      ).toBe(true);
      expect(
        verifyDatabaseNamespaceOwnership(db, 'ns-alpha-v2', 'ws-alpha', {
          requireActiveSpec: true,
        }).verified
      ).toBe(true);

      // Cross-workspace rejection (ws-beta resource accessed from ws-alpha)
      expect(() =>
        verifyDatabaseSpecificationOwnership(db, 'spec-beta-v1', 'ws-alpha')
      ).toThrow(WorkspaceOwnershipError);
      expect(() => verifyDatabaseJobOwnership(db, 'job-beta-v1', 'ws-alpha')).toThrow(
        WorkspaceOwnershipError
      );
      expect(() =>
        verifyDatabaseOperationOwnership(
          db,
          'spec-beta-v1:post:/v1/orders',
          'ws-alpha'
        )
      ).toThrow(WorkspaceOwnershipError);
      expect(() =>
        verifyDatabaseNamespaceOwnership(db, 'ns-beta-v1', 'ws-alpha')
      ).toThrow(WorkspaceOwnershipError);

      // Inactive version rejection when requireActiveSpec=true
      expect(() =>
        verifyDatabaseSpecificationOwnership(db, 'spec-alpha-v1', 'ws-alpha', {
          requireActive: true,
        })
      ).toThrow(/SPECIFICATION_INACTIVE/);
      expect(() =>
        verifyDatabaseOperationOwnership(
          db,
          'spec-alpha-v1:post:/v1/orders',
          'ws-alpha',
          { requireActiveSpec: true }
        )
      ).toThrow(/SPECIFICATION_INACTIVE/);

      // Forged identifier proof: operation.id starts with "spec-alpha-v2:" but its specificationId belongs to ws-beta
      expect(() =>
        assertOperationOwnership(
          {
            id: 'spec-alpha-v2:post:/v2/orders',
            specificationId: 'spec-beta-v1',
          },
          seeded.specifications.alphaV2,
          'ws-alpha'
        )
      ).toThrow(WorkspaceOwnershipError);

      // Forged namespace identifier: namespace ID looks like alpha, but workspaceId/specificationId mismatch
      expect(() =>
        assertNamespaceOwnership(
          {
            id: 'ns_transformers-local_forged',
            workspaceId: 'ws-beta',
            specificationId: 'spec-alpha-v2',
          },
          seeded.specifications.alphaV2,
          'ws-alpha'
        )
      ).toThrow(WorkspaceOwnershipError);

      expect(() =>
        assertJobOwnership(
          {
            id: 'job-forged',
            workspaceId: 'ws-alpha',
            specificationId: 'spec-beta-v1',
          },
          seeded.specifications.betaV1,
          'ws-alpha'
        )
      ).toThrow(WorkspaceOwnershipError);

      expect(() =>
        assertSpecificationOwnership(null, 'ws-alpha', {
          requestedId: 'spec-missing',
        })
      ).toThrow(WorkspaceOwnershipError);
    });

    it('normalizes fixtures deterministically across repeated runs', () => {
      const first = buildNormalizedFixtureOperations();
      const second = buildNormalizedFixtureOperations();
      expect(first).toEqual(second);
    });
  });
});
