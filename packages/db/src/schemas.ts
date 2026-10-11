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

export const ingestionJobEntitySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  specificationId: z.string().min(1),
  status: jobStatusSchema,
  progress: z.number().min(0).max(100),
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
