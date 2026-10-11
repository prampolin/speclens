import { z } from 'zod';

export const openAPIDialectSchema = z.enum(['swagger_2', 'openapi_3_0', 'openapi_3_1']);

export const httpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'TRACE',
]);

export const parameterLocationSchema = z.enum(['path', 'query', 'header', 'cookie']);

export const normalizedParameterSchema = z.object({
  name: z.string().min(1),
  in: parameterLocationSchema,
  description: z.string().optional(),
  required: z.boolean(),
  deprecated: z.boolean().optional(),
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
});

export const normalizedRequestBodySchema = z.object({
  description: z.string().optional(),
  required: z.boolean(),
  mediaType: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
});

export const normalizedResponseMediaTypeSchema = z.object({
  mediaType: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
});

export const normalizedResponseSchema = z.object({
  statusCode: z.string().min(1),
  description: z.string(),
  mediaTypes: z.array(normalizedResponseMediaTypeSchema).optional(),
});

export const normalizedSecurityRequirementSchema = z.object({
  schemeName: z.string().min(1),
  scopes: z.array(z.string()),
});

export const normalizedOperationSchema = z.object({
  id: z.string().min(1),
  specificationId: z.string().min(1),
  method: z.string().min(1),
  path: z.string().min(1),
  operationId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  servers: z.array(z.string()),
  parameters: z.array(normalizedParameterSchema),
  requestBodies: z.array(normalizedRequestBodySchema),
  responses: z.array(normalizedResponseSchema),
  security: z.array(normalizedSecurityRequirementSchema),
  sourcePointer: z.string().min(1),
});

export const specificationSummarySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string(),
  version: z.string(),
  dialect: openAPIDialectSchema,
  sourceChecksum: z.string(),
  operationCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
