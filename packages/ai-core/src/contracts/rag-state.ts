import { z } from 'zod';
import {
  jobLifecycleStateSchema,
  lexicalCapabilityStateSchema,
  vectorCapabilityStateSchema,
  effectiveRetrievalModeSchema,
  explanationModeSchema,
  ragReasonCodeSchema,
  specificationCapabilityDtoSchema,
  type JobLifecycleState,
  type LexicalCapabilityState,
  type VectorCapabilityState,
  type EffectiveRetrievalMode,
  type ExplanationMode,
  type RagReasonCode,
  type SpecificationCapabilityDto,
} from '@speclens/db';

export class IllegalStateTransitionError extends Error {
  public readonly code = 'ILLEGAL_STATE_TRANSITION' as const;
  public readonly dimension: 'job_lifecycle' | 'vector_capability';
  public readonly fromState: string;
  public readonly toState: string;

  constructor(
    dimension: 'job_lifecycle' | 'vector_capability',
    fromState: string,
    toState: string
  ) {
    super(
      `[IllegalStateTransition] Cannot transition ${dimension} from "${fromState}" to "${toState}".`
    );
    this.name = 'IllegalStateTransitionError';
    this.dimension = dimension;
    this.fromState = fromState;
    this.toState = toState;
    Object.setPrototypeOf(this, IllegalStateTransitionError.prototype);
  }
}

export const JOB_LIFECYCLE_TRANSITIONS: Readonly<
  Record<JobLifecycleState, readonly JobLifecycleState[]>
> = {
  queued: ['running', 'cancelled', 'interrupted', 'failed'],
  running: [
    'completed',
    'completed_with_warnings',
    'failed',
    'cancelled',
    'interrupted',
  ],
  interrupted: ['queued', 'running', 'failed', 'cancelled'],
  completed: [],
  completed_with_warnings: [],
  failed: [],
  cancelled: [],
};

export const VECTOR_CAPABILITY_TRANSITIONS: Readonly<
  Record<VectorCapabilityState, readonly VectorCapabilityState[]>
> = {
  pending: ['building', 'unavailable', 'disabled', 'failed'],
  building: ['ready', 'unavailable', 'stale', 'failed', 'disabled'],
  ready: ['building', 'stale', 'unavailable', 'failed', 'disabled'],
  stale: ['building', 'unavailable', 'failed', 'disabled'],
  unavailable: ['pending', 'building', 'disabled', 'failed'],
  failed: ['pending', 'building', 'unavailable', 'disabled'],
  disabled: ['pending', 'building', 'unavailable'],
};

export function canTransitionJobLifecycle(
  from: JobLifecycleState,
  to: JobLifecycleState
): boolean {
  const parsedFrom = jobLifecycleStateSchema.parse(from);
  const parsedTo = jobLifecycleStateSchema.parse(to);
  return JOB_LIFECYCLE_TRANSITIONS[parsedFrom].includes(parsedTo);
}

export function assertJobLifecycleTransition(
  from: JobLifecycleState,
  to: JobLifecycleState
): void {
  if (!canTransitionJobLifecycle(from, to)) {
    throw new IllegalStateTransitionError('job_lifecycle', from, to);
  }
}

export function canTransitionVectorCapability(
  from: VectorCapabilityState,
  to: VectorCapabilityState
): boolean {
  const parsedFrom = vectorCapabilityStateSchema.parse(from);
  const parsedTo = vectorCapabilityStateSchema.parse(to);
  return VECTOR_CAPABILITY_TRANSITIONS[parsedFrom].includes(parsedTo);
}

export function assertVectorCapabilityTransition(
  from: VectorCapabilityState,
  to: VectorCapabilityState
): void {
  if (!canTransitionVectorCapability(from, to)) {
    throw new IllegalStateTransitionError('vector_capability', from, to);
  }
}

export function mapLegacyJobStatusToLifecycle(status: string): JobLifecycleState {
  if (status === 'pending') return 'queued';
  if (status === 'processing') return 'running';
  return jobLifecycleStateSchema.parse(status);
}

/**
 * Existing records with no verified persisted generation start with
 * unavailable semantic capability (never fabricated readiness).
 */
export function deriveLegacyVectorCapability(input: {
  legacyStatus?: string | null;
  hasVerifiedPersistedGeneration: boolean;
  vectorEnabled?: boolean;
}): {
  vectorCapability: VectorCapabilityState;
  reasonCodes: RagReasonCode[];
} {
  if (input.vectorEnabled === false) {
    return {
      vectorCapability: 'disabled',
      reasonCodes: ['VECTOR_DISABLED'],
    };
  }

  if (!input.hasVerifiedPersistedGeneration) {
    return {
      vectorCapability: 'unavailable',
      reasonCodes: ['INDEX_UNVERIFIED'],
    };
  }

  if (input.legacyStatus === 'ready') {
    return {
      vectorCapability: 'ready',
      reasonCodes: [],
    };
  }

  if (input.legacyStatus === 'stale') {
    return {
      vectorCapability: 'stale',
      reasonCodes: ['INDEX_INCOMPATIBLE'],
    };
  }

  if (input.legacyStatus === 'failed') {
    return {
      vectorCapability: 'failed',
      reasonCodes: ['EMBEDDING_FAILED'],
    };
  }

  return {
    vectorCapability: 'unavailable',
    reasonCodes: ['INDEX_UNVERIFIED'],
  };
}

export const retrievalExecutionMetadataSchema = z
  .object({
    workspaceId: z.string().min(1),
    specificationIds: z.array(z.string().min(1)),
    effectiveRetrieval: effectiveRetrievalModeSchema,
    explanationMode: explanationModeSchema,
    activeGenerationIds: z.array(z.string().min(1)),
    generationFingerprints: z.array(z.string().min(1)),
    lexicalCandidateCount: z.number().int().min(0),
    vectorCandidateCount: z.number().int().min(0),
    reasonCodes: z.array(ragReasonCodeSchema),
  })
  .superRefine((val, ctx) => {
    if (
      (val.effectiveRetrieval === 'hybrid' || val.effectiveRetrieval === 'vector_only') &&
      (val.activeGenerationIds.length === 0 || val.generationFingerprints.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Vector-participating retrieval requires at least one activeGenerationId and generationFingerprint',
        path: ['activeGenerationIds'],
      });
    }
    if (val.effectiveRetrieval === 'lexical_only' && val.vectorCandidateCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lexical_only retrieval cannot report positive vectorCandidateCount',
        path: ['vectorCandidateCount'],
      });
    }
    if (val.effectiveRetrieval === 'vector_only' && val.lexicalCandidateCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'vector_only retrieval cannot report positive lexicalCandidateCount',
        path: ['lexicalCandidateCount'],
      });
    }
  });

export type RetrievalExecutionMetadataDto = z.infer<
  typeof retrievalExecutionMetadataSchema
>;

export interface DeriveCapabilityInput {
  workspaceId: string;
  specificationId: string;
  specificationVersion: string;
  isActive: boolean;
  operationCount: number;
  embeddedOperationCount: number;
  lexicalEnabled: boolean;
  vectorEnabled: boolean;
  lexicalIndexed: boolean;
  generationCommitted: boolean;
  activeGenerationId: string | null;
  generationFingerprint: string | null;
  vectorFailureReason?: RagReasonCode;
  policyViolation?: boolean;
  updatedAt?: string;
}

/**
 * Deterministically computes a validated SpecificationCapabilityDto enforcing
 * all Section 4 observable state and fallback rules.
 */
export function deriveSpecificationCapabilityContract(
  input: DeriveCapabilityInput
): SpecificationCapabilityDto {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const reasonCodes: RagReasonCode[] = [];

  if (!input.lexicalEnabled && !input.vectorEnabled) {
    throw new Error(
      'Cannot derive capability when both lexicalEnabled and vectorEnabled are disabled'
    );
  }

  if (input.policyViolation) {
    reasonCodes.push('PRIVACY_POLICY_VIOLATION');
    return specificationCapabilityDtoSchema.parse({
      workspaceId: input.workspaceId,
      specificationId: input.specificationId,
      specificationVersion: input.specificationVersion,
      isActive: input.isActive,
      operationCount: input.operationCount,
      embeddedOperationCount: 0,
      jobState: 'failed',
      lexicalCapability: input.lexicalIndexed ? 'ready' : 'failed',
      vectorCapability: 'failed',
      effectiveRetrieval: input.lexicalIndexed && input.lexicalEnabled ? 'lexical_only' : 'unavailable',
      activeGenerationId: null,
      generationFingerprint: null,
      generationCommitted: false,
      retryable: false,
      reasonCodes,
      updatedAt,
    });
  }

  if (input.operationCount === 0) {
    reasonCodes.push('EMPTY_SPECIFICATION');
    if (!input.vectorEnabled) {
      reasonCodes.push('VECTOR_DISABLED');
    }
    return specificationCapabilityDtoSchema.parse({
      workspaceId: input.workspaceId,
      specificationId: input.specificationId,
      specificationVersion: input.specificationVersion,
      isActive: input.isActive,
      operationCount: 0,
      embeddedOperationCount: 0,
      jobState: 'completed_with_warnings',
      lexicalCapability: input.lexicalEnabled ? 'pending' : 'disabled',
      vectorCapability: input.vectorEnabled ? 'unavailable' : 'disabled',
      effectiveRetrieval: 'unavailable',
      activeGenerationId: null,
      generationFingerprint: null,
      generationCommitted: false,
      retryable: false,
      reasonCodes,
      updatedAt,
    });
  }

  const lexicalCapability: LexicalCapabilityState = !input.lexicalEnabled
    ? 'disabled'
    : input.lexicalIndexed
      ? 'ready'
      : 'failed';

  if (lexicalCapability === 'disabled') {
    reasonCodes.push('LEXICAL_DISABLED');
  } else if (lexicalCapability === 'failed') {
    reasonCodes.push('LEXICAL_FAILED');
  }

  let vectorCapability: VectorCapabilityState;
  const allVectorsCommitted =
    input.vectorEnabled &&
    input.generationCommitted &&
    input.embeddedOperationCount === input.operationCount &&
    Boolean(input.activeGenerationId) &&
    Boolean(input.generationFingerprint);

  if (!input.vectorEnabled) {
    vectorCapability = 'disabled';
    reasonCodes.push('VECTOR_DISABLED');
  } else if (allVectorsCommitted) {
    vectorCapability = 'ready';
  } else if (input.vectorFailureReason === 'EMBEDDING_FAILED' || input.vectorFailureReason === 'INDEX_CORRUPT') {
    vectorCapability = 'failed';
    reasonCodes.push(input.vectorFailureReason);
  } else if (input.vectorFailureReason === 'INDEX_INCOMPATIBLE') {
    vectorCapability = 'stale';
    reasonCodes.push('INDEX_INCOMPATIBLE');
  } else {
    vectorCapability = 'unavailable';
    reasonCodes.push(input.vectorFailureReason ?? 'MODEL_MISSING');
  }

  let effectiveRetrieval: EffectiveRetrievalMode;
  if (lexicalCapability === 'ready' && vectorCapability === 'ready') {
    effectiveRetrieval = 'hybrid';
  } else if (lexicalCapability === 'ready') {
    effectiveRetrieval = 'lexical_only';
  } else if (vectorCapability === 'ready') {
    effectiveRetrieval = 'vector_only';
  } else {
    effectiveRetrieval = 'unavailable';
  }

  let jobState: JobLifecycleState;
  if (lexicalCapability === 'failed' && vectorCapability !== 'ready') {
    jobState = 'failed';
  } else if (
    lexicalCapability === 'ready' &&
    (vectorCapability === 'ready' || vectorCapability === 'disabled')
  ) {
    jobState = 'completed';
  } else if (lexicalCapability === 'ready' || vectorCapability === 'ready') {
    jobState = 'completed_with_warnings';
  } else {
    jobState = 'failed';
  }

  const retryable =
    vectorCapability === 'unavailable' ||
    vectorCapability === 'failed' ||
    vectorCapability === 'stale' ||
    jobState === 'failed';

  return specificationCapabilityDtoSchema.parse({
    workspaceId: input.workspaceId,
    specificationId: input.specificationId,
    specificationVersion: input.specificationVersion,
    isActive: input.isActive,
    operationCount: input.operationCount,
    embeddedOperationCount: allVectorsCommitted ? input.embeddedOperationCount : 0,
    jobState,
    lexicalCapability,
    vectorCapability,
    effectiveRetrieval,
    activeGenerationId: allVectorsCommitted ? input.activeGenerationId : null,
    generationFingerprint: allVectorsCommitted ? input.generationFingerprint : null,
    generationCommitted: allVectorsCommitted,
    retryable,
    reasonCodes,
    updatedAt,
  });
}

export {
  jobLifecycleStateSchema,
  lexicalCapabilityStateSchema,
  vectorCapabilityStateSchema,
  effectiveRetrievalModeSchema,
  explanationModeSchema,
  ragReasonCodeSchema,
  specificationCapabilityDtoSchema,
  type JobLifecycleState,
  type LexicalCapabilityState,
  type VectorCapabilityState,
  type EffectiveRetrievalMode,
  type ExplanationMode,
  type RagReasonCode,
  type SpecificationCapabilityDto,
};
