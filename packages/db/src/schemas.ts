import { z } from 'zod';

export const jobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export const workspaceEntitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const specificationEntitySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string().min(1),
  version: z.string().min(1),
  dialect: z.enum(['swagger_2', 'openapi_3_0', 'openapi_3_1']),
  sourceChecksum: z.string().min(1),
  sourceContent: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const operationEntitySchema = z.object({
  id: z.string().min(1),
  specificationId: z.string().min(1),
  method: z.string().min(1),
  path: z.string().min(1),
  operationId: z.string().optional(),
  tags: z.array(z.string()),
  normalizedJson: z.string(),
  sourcePointer: z.string().min(1),
  createdAt: z.string(),
});

export const vectorNamespaceEntitySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  specificationId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  revision: z.string().min(1),
  dimensions: z.number().int().positive(),
  chunkingVersion: z.string().min(1),
  status: z.enum(['pending', 'ready', 'stale', 'failed']),
  createdAt: z.string(),
});

export const workspaceSettingsEntitySchema = z.object({
  workspaceId: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  settingsJson: z.string(),
  updatedAt: z.string(),
});

export const jobLifecycleStateSchema = z.enum([
  'queued',
  'running',
  'completed',
  'completed_with_warnings',
  'failed',
  'cancelled',
  'interrupted',
]);

export const lexicalCapabilityStateSchema = z.enum([
  'pending',
  'ready',
  'failed',
  'disabled',
]);

export const vectorCapabilityStateSchema = z.enum([
  'pending',
  'building',
  'ready',
  'unavailable',
  'stale',
  'failed',
  'disabled',
]);

export const effectiveRetrievalModeSchema = z.enum([
  'hybrid',
  'lexical_only',
  'vector_only',
  'unavailable',
]);

export const explanationModeSchema = z.enum(['llm', 'contract_only']);

export const ragReasonCodeSchema = z.enum([
  'MODEL_MISSING',
  'MODEL_INVALID',
  'EMBEDDING_RUNTIME_UNAVAILABLE',
  'EMBEDDING_FAILED',
  'INDEX_INCOMPATIBLE',
  'INDEX_CORRUPT',
  'INDEX_UNVERIFIED',
  'JOB_INTERRUPTED',
  'JOB_CANCELLED',
  'VECTOR_DISABLED',
  'LEXICAL_DISABLED',
  'LEXICAL_FAILED',
  'BOTH_RETRIEVAL_MODES_DISABLED',
  'EMPTY_SPECIFICATION',
  'PRIVACY_POLICY_VIOLATION',
  'WORKSPACE_OWNERSHIP_MISMATCH',
  'SPECIFICATION_INACTIVE',
  'OLLAMA_UNAVAILABLE',
  'OLLAMA_STREAM_INVALID',
]);

export const embeddingPoolingModeSchema = z.enum(['mean', 'cls', 'none']);
export const vectorEncodingVersionSchema = z.literal('float32_le_v1');
export const vectorGenerationStatusSchema = z.enum([
  'staging',
  'active',
  'superseded',
  'failed',
  'abandoned',
]);

export const embeddingSpaceSpecSchema = z.object({
  providerId: z.string().min(1),
  implementationVersion: z.string().min(1),
  modelId: z.string().min(1),
  modelRevision: z.string().min(1),
  assetDigest: z.string().min(1),
  dimensions: z.number().int().positive(),
  pooling: embeddingPoolingModeSchema,
  normalize: z.boolean(),
  preprocessingVersion: z.string().min(1),
  operationTextVersion: z.string().min(1),
  encodingVersion: vectorEncodingVersionSchema,
});

export const vectorGenerationIdentitySchema = z
  .object({
    generationId: z.string().min(1),
    namespaceId: z.string().min(1),
    workspaceId: z.string().min(1),
    specificationId: z.string().min(1),
    specificationVersion: z.string().min(1),
    sourceChecksum: z.string().min(1),
    embeddingFingerprint: z.string().min(1),
    embeddingSpace: embeddingSpaceSpecSchema,
    expectedOperationCount: z.number().int().min(0),
    embeddedOperationCount: z.number().int().min(0),
    status: vectorGenerationStatusSchema,
    committedAt: z.string().nullable(),
    createdAt: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    if (val.embeddedOperationCount > val.expectedOperationCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'embeddedOperationCount cannot exceed expectedOperationCount',
        path: ['embeddedOperationCount'],
      });
    }
    if (val.status === 'active') {
      if (val.expectedOperationCount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Zero-operation generation cannot be marked active',
          path: ['status'],
        });
      }
      if (val.embeddedOperationCount !== val.expectedOperationCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Active generation requires all expected operations to be embedded',
          path: ['embeddedOperationCount'],
        });
      }
      if (!val.committedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Active generation requires a non-null committedAt timestamp',
          path: ['committedAt'],
        });
      }
    }
  });

export const specificationCapabilityDtoSchema = z
  .object({
    workspaceId: z.string().min(1),
    specificationId: z.string().min(1),
    specificationVersion: z.string().min(1),
    isActive: z.boolean(),
    operationCount: z.number().int().min(0),
    embeddedOperationCount: z.number().int().min(0),
    jobState: jobLifecycleStateSchema,
    lexicalCapability: lexicalCapabilityStateSchema,
    vectorCapability: vectorCapabilityStateSchema,
    effectiveRetrieval: effectiveRetrievalModeSchema,
    activeGenerationId: z.string().min(1).nullable(),
    generationFingerprint: z.string().min(1).nullable(),
    generationCommitted: z.boolean(),
    retryable: z.boolean(),
    reasonCodes: z.array(ragReasonCodeSchema),
    updatedAt: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    if (val.embeddedOperationCount > val.operationCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'embeddedOperationCount cannot exceed operationCount',
        path: ['embeddedOperationCount'],
      });
    }

    if (val.operationCount === 0) {
      if (val.vectorCapability === 'ready') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Zero-operation document cannot claim vectorCapability=ready',
          path: ['vectorCapability'],
        });
      }
      if (val.lexicalCapability === 'ready') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Zero-operation document cannot claim lexicalCapability=ready',
          path: ['lexicalCapability'],
        });
      }
      if (val.effectiveRetrieval !== 'unavailable') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Zero-operation document must report effectiveRetrieval=unavailable',
          path: ['effectiveRetrieval'],
        });
      }
      if (
        (val.jobState === 'completed' || val.jobState === 'completed_with_warnings') &&
        !val.reasonCodes.includes('EMPTY_SPECIFICATION')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Completed zero-operation document must include EMPTY_SPECIFICATION reasonCode',
          path: ['reasonCodes'],
        });
      }
    }

    if (val.vectorCapability === 'ready') {
      if (val.embeddedOperationCount !== val.operationCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Cannot claim vectorCapability=ready unless embeddedOperationCount equals operationCount',
          path: ['embeddedOperationCount'],
        });
      }
      if (!val.generationCommitted || !val.activeGenerationId || !val.generationFingerprint) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Cannot claim vectorCapability=ready without committed activeGenerationId and generationFingerprint',
          path: ['generationCommitted'],
        });
      }
    }

    if (
      val.jobState === 'completed' &&
      val.lexicalCapability === 'ready' &&
      (val.vectorCapability === 'unavailable' ||
        val.vectorCapability === 'failed' ||
        val.vectorCapability === 'stale')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Completed lexical import with unavailable/failed/stale vectors must use jobState=completed_with_warnings',
        path: ['jobState'],
      });
    }

    if (val.vectorCapability === 'disabled' && !val.reasonCodes.includes('VECTOR_DISABLED')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Intentional vector disablement must include VECTOR_DISABLED reasonCode',
        path: ['reasonCodes'],
      });
    }

    if (val.effectiveRetrieval === 'hybrid') {
      if (val.lexicalCapability !== 'ready' || val.vectorCapability !== 'ready') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'effectiveRetrieval=hybrid requires both lexicalCapability=ready and vectorCapability=ready',
          path: ['effectiveRetrieval'],
        });
      }
    } else if (val.effectiveRetrieval === 'vector_only') {
      if (val.vectorCapability !== 'ready') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'effectiveRetrieval=vector_only requires vectorCapability=ready',
          path: ['effectiveRetrieval'],
        });
      }
    } else if (val.effectiveRetrieval === 'lexical_only') {
      if (val.lexicalCapability !== 'ready') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'effectiveRetrieval=lexical_only requires lexicalCapability=ready',
          path: ['effectiveRetrieval'],
        });
      }
    }

    if (
      val.lexicalCapability === 'disabled' &&
      val.vectorCapability !== 'ready' &&
      val.effectiveRetrieval !== 'unavailable'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'When lexical retrieval is disabled and vectors are not ready, effectiveRetrieval must be unavailable',
        path: ['effectiveRetrieval'],
      });
    }

    if (
      val.reasonCodes.includes('PRIVACY_POLICY_VIOLATION') &&
      (val.jobState === 'completed' || val.jobState === 'completed_with_warnings' || val.retryable)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Privacy policy violations must fail closed and cannot be marked completed or automatically retryable',
        path: ['reasonCodes'],
      });
    }
  });

export const ingestionJobEntitySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  specificationId: z.string().min(1),
  status: jobStatusSchema,
  lifecycleState: jobLifecycleStateSchema.optional(),
  progress: z.number().min(0).max(100),
  operationCount: z.number().int().min(0).optional(),
  embeddedCount: z.number().int().min(0).optional(),
  activeGenerationId: z.string().min(1).nullable().optional(),
  generationFingerprint: z.string().min(1).nullable().optional(),
  retryable: z.boolean().optional(),
  reasonCodes: z.array(ragReasonCodeSchema).optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const evaluationRunEntitySchema = z.object({
  id: z.string().min(1),
  datasetVersion: z.string().min(1),
  configSnapshotJson: z.string(),
  metricsJson: z.string(),
  createdAt: z.string(),
});
