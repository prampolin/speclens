export interface WorkspaceEntity {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecificationEntity {
  id: string;
  workspaceId: string;
  title: string;
  version: string;
  dialect: 'swagger_2' | 'openapi_3_0' | 'openapi_3_1';
  sourceChecksum: string;
  sourceContent?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OperationEntity {
  id: string;
  specificationId: string;
  method: string;
  path: string;
  operationId?: string;
  tags: string[];
  normalizedJson: string;
  sourcePointer: string;
  createdAt: string;
}

export interface OperationFtsEntity {
  operationId: string;
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string;
}

export interface VectorNamespaceEntity {
  id: string;
  workspaceId: string;
  specificationId: string;
  providerId: string;
  modelId: string;
  revision: string;
  dimensions: number;
  chunkingVersion: string;
  status: 'pending' | 'ready' | 'stale' | 'failed';
  createdAt: string;
}

export interface WorkspaceSettingsEntity {
  workspaceId: string;
  schemaVersion: number;
  settingsJson: string;
  updatedAt: string;
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type JobLifecycleState =
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type LexicalCapabilityState = 'pending' | 'ready' | 'failed' | 'disabled';

export type VectorCapabilityState =
  | 'pending'
  | 'building'
  | 'ready'
  | 'unavailable'
  | 'stale'
  | 'failed'
  | 'disabled';

export type EffectiveRetrievalMode =
  | 'hybrid'
  | 'lexical_only'
  | 'vector_only'
  | 'unavailable';

export type ExplanationMode = 'llm' | 'contract_only';

export type RagReasonCode =
  | 'MODEL_MISSING'
  | 'MODEL_INVALID'
  | 'EMBEDDING_RUNTIME_UNAVAILABLE'
  | 'EMBEDDING_FAILED'
  | 'INDEX_INCOMPATIBLE'
  | 'INDEX_CORRUPT'
  | 'INDEX_UNVERIFIED'
  | 'JOB_INTERRUPTED'
  | 'JOB_CANCELLED'
  | 'VECTOR_DISABLED'
  | 'LEXICAL_DISABLED'
  | 'LEXICAL_FAILED'
  | 'BOTH_RETRIEVAL_MODES_DISABLED'
  | 'EMPTY_SPECIFICATION'
  | 'PRIVACY_POLICY_VIOLATION'
  | 'WORKSPACE_OWNERSHIP_MISMATCH'
  | 'SPECIFICATION_INACTIVE'
  | 'OLLAMA_UNAVAILABLE'
  | 'OLLAMA_STREAM_INVALID';

export type EmbeddingPoolingMode = 'mean' | 'cls' | 'none';
export type VectorEncodingVersion = 'float32_le_v1';
export type VectorGenerationStatus =
  | 'staging'
  | 'active'
  | 'superseded'
  | 'failed'
  | 'abandoned';

export interface EmbeddingSpaceSpec {
  providerId: string;
  implementationVersion: string;
  modelId: string;
  modelRevision: string;
  assetDigest: string;
  dimensions: number;
  pooling: EmbeddingPoolingMode;
  normalize: boolean;
  preprocessingVersion: string;
  operationTextVersion: string;
  encodingVersion: VectorEncodingVersion;
}

export interface VectorGenerationIdentity {
  generationId: string;
  namespaceId: string;
  workspaceId: string;
  specificationId: string;
  specificationVersion: string;
  sourceChecksum: string;
  embeddingFingerprint: string;
  embeddingSpace: EmbeddingSpaceSpec;
  expectedOperationCount: number;
  embeddedOperationCount: number;
  status: VectorGenerationStatus;
  committedAt: string | null;
  createdAt: string;
}

export interface SpecificationCapabilityDto {
  workspaceId: string;
  specificationId: string;
  specificationVersion: string;
  isActive: boolean;
  operationCount: number;
  embeddedOperationCount: number;
  jobState: JobLifecycleState;
  lexicalCapability: LexicalCapabilityState;
  vectorCapability: VectorCapabilityState;
  effectiveRetrieval: EffectiveRetrievalMode;
  activeGenerationId: string | null;
  generationFingerprint: string | null;
  generationCommitted: boolean;
  retryable: boolean;
  reasonCodes: RagReasonCode[];
  updatedAt: string;
}

export interface IngestionJobEntity {
  id: string;
  workspaceId: string;
  specificationId: string;
  status: JobStatus;
  lifecycleState?: JobLifecycleState;
  progress: number;
  operationCount?: number;
  embeddedCount?: number;
  activeGenerationId?: string | null;
  generationFingerprint?: string | null;
  retryable?: boolean;
  reasonCodes?: RagReasonCode[];
  errors?: string[];
  warnings?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationRunEntity {
  id: string;
  datasetVersion: string;
  configSnapshotJson: string;
  metricsJson: string;
  createdAt: string;
}
