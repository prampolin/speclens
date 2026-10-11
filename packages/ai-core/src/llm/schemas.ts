import { z } from 'zod';
import {
  sourceCitationSchema,
  codeSnippetSchema,
  responseEnvelopeSchema,
  explanationEventSchema,
} from '../schemas.js';

export {
  sourceCitationSchema,
  codeSnippetSchema,
  responseEnvelopeSchema,
  explanationEventSchema,
};

export const operationSourceSchema = sourceCitationSchema;

export const streamExplanationInputSchema = z.object({
  query: z.string().min(1),
  groundedOperations: z.array(z.any()),
  locale: z.enum(['pt-BR', 'en-US']),
});

export const ollamaModelDetailsSchema = z.object({
  parent_model: z.string().optional(),
  format: z.string().optional(),
  family: z.string().optional(),
  families: z.array(z.string()).optional(),
  parameter_size: z.string().optional(),
  quantization_level: z.string().optional(),
  remote_host: z.string().optional(),
}).passthrough();

export const ollamaModelInfoSchema = z.object({
  name: z.string().min(1),
  model: z.string().optional(),
  modified_at: z.string().optional(),
  size: z.number().optional(),
  digest: z.string().optional(),
  details: ollamaModelDetailsSchema.optional(),
  parent_model: z.string().optional(),
  remote_host: z.string().optional(),
}).passthrough();

export const ollamaTagsResponseSchema = z.object({
  models: z.array(ollamaModelInfoSchema),
});

export const ollamaStreamChunkSchema = z.object({
  model: z.string().optional(),
  created_at: z.string().optional(),
  message: z.object({
    role: z.string(),
    content: z.string(),
  }).optional(),
  response: z.string().optional(),
  done: z.boolean(),
  total_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
}).passthrough();

export const ollamaProviderConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  modelId: z.string().min(1).optional(),
  privateMode: z.boolean().optional(),
  allowedBaseUrls: z.array(z.string()).optional(),
  timeoutMs: z.number().positive().optional(),
  implementationVersion: z.string().optional(),
});
