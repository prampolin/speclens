import { z } from 'zod';
import {
  normalizedOperationSchema,
  normalizedParameterSchema,
  normalizedRequestBodySchema,
  normalizedResponseSchema,
  normalizedSecurityRequirementSchema,
} from '@speclens/openapi-core';

export {
  normalizedOperationSchema,
  normalizedParameterSchema,
  normalizedRequestBodySchema,
  normalizedResponseSchema,
  normalizedSecurityRequirementSchema,
};

export const executionLocationSchema = z.enum(['local', 'remote', 'unknown']);

export const providerKindSchema = z.enum(['embedding', 'decision', 'llm']);

export const providerManifestSchema = z.object({
  id: z.string().min(1),
  kind: providerKindSchema,
  implementationVersion: z.string().min(1),
  executionLocation: executionLocationSchema,
  requiresNetwork: z.boolean(),
  modelId: z.string().min(1),
  modelRevision: z.string().min(1),
  supportsOffline: z.boolean(),
});

export const providerReadinessSchema = z.object({
  ready: z.boolean(),
  reason: z.string().optional(),
  code: z.enum(['MODEL_UNAVAILABLE']).optional(),
});

export const intentSchema = z.enum([
  'search_endpoint',
  'generate_code',
  'explain_schema',
  'compare_endpoints',
]);

export const decisionResultSchema = z.object({
  intent: intentSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  abstained: z.boolean(),
});

export const classifyResultSchema = z.object({
  intent: intentSchema.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  abstained: z.boolean(),
  providerId: z.string().optional(),
});

export const indexedVectorSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().optional(),
  vector: z.array(z.number()),
  metadata: z.record(z.unknown()).optional(),
});

export const vectorHitSchema = z.object({
  id: z.string().min(1),
  operationId: z.string().optional(),
  score: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

export const vectorNamespaceKeySchema = z.object({
  workspaceId: z.string().min(1),
  specificationId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  modelRevision: z.string().min(1),
  dimensions: z.number().int().positive(),
  chunkingVersion: z.string().min(1),
});

export const sourceCitationSchema = z.object({
  specificationId: z.string().min(1),
  operationId: z.string().optional(),
  method: z.string().min(1),
  path: z.string().min(1),
  sourcePointer: z.string().min(1),
});

export const codeSnippetSchema = z.object({
  language: z.string().min(1),
  label: z.string().min(1),
  code: z.string(),
  validated: z.boolean(),
  validationWarnings: z.array(z.string()),
});

export const responseEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  query: z.string().min(1),
  answer: z.object({
    locale: z.enum(['pt-BR', 'en-US']),
    explanation: z.string(),
    limitations: z.array(z.string()),
  }),
  sources: z.array(sourceCitationSchema),
  snippets: z.array(codeSnippetSchema),
});

export const explanationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('status'),
    stage: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('token'),
    token: z.string(),
  }),
  z.object({
    type: z.literal('sources'),
    sources: z.array(sourceCitationSchema),
  }),
  z.object({
    type: z.literal('snippets'),
    snippets: z.array(codeSnippetSchema),
  }),
  z.object({
    type: z.literal('final'),
    envelope: responseEnvelopeSchema,
  }),
  z.object({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
    recoverable: z.boolean(),
  }),
]);

export const workspaceSettingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  workspaceId: z.string().min(1),
  privateMode: z.boolean(),
  embedding: z.object({
    providerId: z.string().min(1),
    modelId: z.string().min(1),
    revision: z.string().min(1),
  }),
  decision: z.object({
    providerId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  llm: z.object({
    providerId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  retrieval: z.object({
    lexicalEnabled: z.boolean(),
    vectorEnabled: z.boolean(),
    topK: z.number().int().positive(),
  }),
});

export {
  executionLocationSchema as ExecutionLocationSchema,
  providerKindSchema as ProviderKindSchema,
  providerManifestSchema as ProviderManifestSchema,
  providerReadinessSchema as ProviderReadinessSchema,
  intentSchema as IntentSchema,
  decisionResultSchema as DecisionResultSchema,
  classifyResultSchema as ClassifyResultSchema,
  indexedVectorSchema as IndexedVectorSchema,
  vectorHitSchema as VectorHitSchema,
  vectorNamespaceKeySchema as VectorNamespaceKeySchema,
  sourceCitationSchema as SourceCitationSchema,
  codeSnippetSchema as CodeSnippetSchema,
  responseEnvelopeSchema as ResponseEnvelopeSchema,
  explanationEventSchema as ExplanationEventSchema,
  workspaceSettingsSchema as WorkspaceSettingsSchema,
};

