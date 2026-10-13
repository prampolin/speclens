import type {
  NormalizedOperation,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSecurityRequirement,
} from '@speclens/openapi-core';

export type {
  NormalizedOperation,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSecurityRequirement,
};

export type ExecutionLocation = 'local' | 'remote' | 'unknown';
export type ProviderKind = 'embedding' | 'decision' | 'llm';

export interface ProviderManifest {
  id: string;
  kind: ProviderKind;
  implementationVersion: string;
  executionLocation: ExecutionLocation;
  requiresNetwork: boolean;
  modelId: string;
  modelRevision: string;
  supportsOffline: boolean;
}

export interface ProviderReadiness {
  ready: boolean;
  reason?: string;
  code?: 'MODEL_UNAVAILABLE';
}

export interface EmbeddingProvider {
  manifest: ProviderManifest;
  dimensions(): Promise<number>;
  embed(text: string, signal?: AbortSignal): Promise<number[]>;
  embedBatch(texts: string[], signal?: AbortSignal): Promise<number[][]>;
  readiness(): Promise<ProviderReadiness>;
}

export type Intent = 'search_endpoint' | 'generate_code' | 'explain_schema' | 'compare_endpoints';

export interface DecisionResult {
  intent: Intent | null;
  confidence: number | null;
  abstained: boolean;
}

export type ReadinessResult = ProviderReadiness;

export interface ClassifyResult extends DecisionResult {
  providerId?: string;
}

export interface DecisionProvider {
  manifest: ProviderManifest;
  classify(input: string, candidates?: Intent[], signal?: AbortSignal): Promise<ClassifyResult>;
  readiness(): Promise<ProviderReadiness>;
}

export interface StreamExplanationInput {
  query: string;
  groundedOperations: NormalizedOperation[];
  locale: 'pt-BR' | 'en-US';
}

export interface LLMProvider {
  manifest: ProviderManifest;
  streamExplanation(
    input: StreamExplanationInput,
    signal?: AbortSignal,
  ): AsyncIterable<ExplanationEvent>;
  readiness(): Promise<ProviderReadiness>;
}

export interface IndexedVector {
  id: string;
  operationId?: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorHit {
  id: string;
  operationId?: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorIndex {
  upsert(namespace: string, vectors: IndexedVector[]): Promise<void>;
  search(namespace: string, vector: number[], limit: number): Promise<VectorHit[]>;
  deleteNamespace(namespace: string): Promise<void>;
}

export interface VectorNamespaceKey {
  workspaceId: string;
  specificationId: string;
  providerId: string;
  modelId: string;
  modelRevision: string;
  dimensions: number;
  chunkingVersion: string;
  implementationVersion?: string;
  assetDigest?: string;
  pooling?: 'mean' | 'cls' | 'none';
  normalize?: boolean;
  preprocessingVersion?: string;
  operationTextVersion?: string;
  encodingVersion?: 'float32_le_v1';
}

export type {
  JobLifecycleState,
  LexicalCapabilityState,
  VectorCapabilityState,
  EffectiveRetrievalMode,
  ExplanationMode,
  RagReasonCode,
  EmbeddingPoolingMode,
  VectorEncodingVersion,
  VectorGenerationStatus,
  EmbeddingSpaceSpec,
  VectorGenerationIdentity,
  SpecificationCapabilityDto,
  RequestedVsEffectiveSettings,
  LegacySettingsMigrationResult,
} from '@speclens/db';

export interface SourceCitation {
  specificationId: string;
  operationId?: string;
  method: string;
  path: string;
  sourcePointer: string;
}

export interface CodeSnippet {
  language: 'curl' | 'javascript' | 'python' | string;
  label: string;
  code: string;
  validated: boolean;
  validationWarnings: string[];
}

export interface ResponseEnvelope {
  schemaVersion: number;
  query: string;
  answer: {
    locale: 'pt-BR' | 'en-US';
    explanation: string;
    limitations: string[];
  };
  sources: SourceCitation[];
  snippets: CodeSnippet[];
}

export type ExplanationEvent =
  | { type: 'status'; stage: string; message: string }
  | { type: 'token'; token: string }
  | { type: 'sources'; sources: SourceCitation[] }
  | { type: 'snippets'; snippets: CodeSnippet[] }
  | { type: 'final'; envelope: ResponseEnvelope }
  | { type: 'error'; code: string; message: string; recoverable: boolean };

export interface WorkspaceSettings {
  inference?: { layaEnabled: boolean; llmEnabled: boolean };
  schemaVersion: number;
  workspaceId: string;
  privateMode: boolean;
  embedding: {
    providerId: string;
    modelId: string;
    revision: string;
  };
  decision: {
    providerId: string;
    modelId: string;
  };
  llm: {
    providerId: string;
    modelId: string;
  };
  retrieval: {
    lexicalEnabled: boolean;
    vectorEnabled: boolean;
    topK: number;
  };
}
