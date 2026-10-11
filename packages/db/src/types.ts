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

export interface IngestionJobEntity {
  id: string;
  workspaceId: string;
  specificationId: string;
  status: JobStatus;
  progress: number;
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
