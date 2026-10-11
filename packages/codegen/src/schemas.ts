import { z } from 'zod';
import type { NormalizedOperation } from '@speclens/openapi-core';

export const supportedLanguageSchema = z.enum(['curl', 'javascript', 'python']);

export const authTypeSchema = z.enum(['bearer', 'apiKey', 'basic', 'unknown']);

export const paramSchema = z.object({
  name: z.string(),
  value: z.string(),
  required: z.boolean(),
  isPlaceholder: z.boolean(),
});

export const authModelSchema = z.object({
  type: authTypeSchema,
  placeholder: z.string(),
  headerName: z.string().optional(),
});

export const bodyModelSchema = z.object({
  schema: z.record(z.unknown()).optional(),
  example: z.record(z.unknown()),
  unknownFields: z.array(z.string()),
});

export const requestModelSchema = z.object({
  method: z.string(),
  url: z.string(),
  queryParams: z.array(paramSchema),
  headers: z.array(paramSchema),
  body: bodyModelSchema.nullable(),
  contentType: z.string().nullable(),
  auth: authModelSchema.nullable(),
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  warnings: z.array(z.string()),
});

export const codeSnippetSchema = z.object({
  language: z.string(),
  label: z.string(),
  code: z.string(),
  validated: z.boolean(),
  validationWarnings: z.array(z.string()),
});

export const codegenRequestSchema = z.object({
  operation: z.custom<NormalizedOperation>((val) => typeof val === 'object' && val !== null),
  languages: z.array(supportedLanguageSchema),
  groundedValues: z.record(z.unknown()).optional(),
  baseUrl: z.string().optional(),
});

export const codegenResultSchema = z.object({
  snippets: z.array(codeSnippetSchema),
  requestModel: requestModelSchema,
});
