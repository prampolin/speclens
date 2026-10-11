import { z } from 'zod';

export const HttpMethodSchema = z.union([
  z.enum([
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'options',
    'head',
    'trace',
  ]),
  z.enum([
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS',
    'HEAD',
    'TRACE',
  ]),
  z.string(),
]);

export const ParameterInSchema = z.enum(['path', 'query', 'header', 'cookie']);

export const OpenAPIDialectSchema = z.enum([
  'openapi-3.0',
  'openapi-3.1',
  'swagger-2.0',
  'unknown',
  'swagger_2',
  'openapi_3_0',
  'openapi_3_1',
]);

export const NormalizedServerObjectSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
});

export const NormalizedServerSchema = z.union([
  z.string(),
  NormalizedServerObjectSchema,
]);

export const NormalizedExampleSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  value: z.unknown().optional(),
});

export const NormalizedParameterSchema = z.object({
  name: z.string(),
  in: ParameterInSchema,
  required: z.boolean(),
  description: z.string().optional(),
  deprecated: z.boolean().optional(),
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
  examples: z.record(NormalizedExampleSchema).optional(),
});

export const NormalizedMediaTypeSchema = z.object({
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
  examples: z.record(NormalizedExampleSchema).optional(),
});

export const NormalizedRequestBodySchema = z.object({
  description: z.string().optional(),
  required: z.boolean(),
  content: z.record(NormalizedMediaTypeSchema).optional(),
  mediaType: z.string().optional(),
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
});

export const NormalizedResponseObjectSchema = z.object({
  statusCode: z.string().optional(),
  description: z.string(),
  headers: z.record(z.record(z.unknown())).optional(),
  content: z.record(NormalizedMediaTypeSchema).optional(),
  mediaTypes: z.array(z.any()).optional(),
});

export const NormalizedResponseSchema = NormalizedResponseObjectSchema;

export const NormalizedResponsesSchema = z.union([
  z.record(NormalizedResponseObjectSchema),
  z.array(NormalizedResponseObjectSchema),
]);

export const NormalizedSecurityRequirementSchema = z.union([
  z.record(z.array(z.string())),
  z.object({
    schemeName: z.string(),
    scopes: z.array(z.string()),
  }),
]);

export const NormalizedOperationSchema = z.object({
  id: z.string(),
  specId: z.string().optional(),
  specificationId: z.string().optional(),
  method: HttpMethodSchema,
  path: z.string(),
  operationId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  servers: z.array(NormalizedServerSchema),
  parameters: z.array(NormalizedParameterSchema),
  requestBody: NormalizedRequestBodySchema.optional(),
  requestBodies: z.array(z.any()).optional(),
  responses: NormalizedResponsesSchema,
  security: z.array(NormalizedSecurityRequirementSchema).optional(),
  deprecated: z.boolean().optional(),
  sourcePointer: z.string(),
  indexText: z.string().optional(),
});

export const OpenAPIDocumentInfoSchema = z.object({
  title: z.string(),
  version: z.string(),
  description: z.string().optional(),
});

export const MinimalDocumentSchema = z.object({
  openapi: z.string().optional(),
  swagger: z.string().optional(),
  info: z.object({
    title: z.string({ required_error: "Missing required 'info.title'" }),
    version: z.string({ required_error: "Missing required 'info.version'" }),
    description: z.string().optional(),
  }),
  paths: z.record(z.unknown()).optional(),
});

export const specificationSummarySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  title: z.string(),
  version: z.string(),
  dialect: OpenAPIDialectSchema,
  sourceChecksum: z.string(),
  operationCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Backward compatibility aliases
export const openAPIDialectSchema = OpenAPIDialectSchema;
export const httpMethodSchema = HttpMethodSchema;
export const parameterLocationSchema = ParameterInSchema;
export const normalizedParameterSchema = NormalizedParameterSchema;
export const normalizedRequestBodySchema = NormalizedRequestBodySchema;
export const normalizedResponseSchema = NormalizedResponseObjectSchema;
export const normalizedSecurityRequirementSchema = NormalizedSecurityRequirementSchema;
export const normalizedOperationSchema = NormalizedOperationSchema;
