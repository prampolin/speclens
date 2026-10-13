import { z } from 'zod';
import {
  effectiveRetrievalModeSchema,
  explanationModeSchema,
  ragReasonCodeSchema,
} from './schemas.js';

export const retrievalSettingsSchema = z
  .object({
    lexicalEnabled: z.boolean().default(true),
    vectorEnabled: z.boolean().default(true),
    topK: z.number().int().positive(),
  })
  .refine((r) => r.lexicalEnabled || r.vectorEnabled, {
    message:
      'At least one retrieval mode (lexicalEnabled or vectorEnabled) must be enabled.',
    path: ['vectorEnabled'],
  });

export const inferenceSettingsSchema = z.object({
  layaEnabled: z.boolean(),
  llmEnabled: z.boolean(),
}).refine((value) => value.layaEnabled || value.llmEnabled, {
  message: 'At least one of Laya or LLM must be enabled.',
  path: ['llmEnabled'],
});

export const workspaceSettingsSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  workspaceId: z.string().min(1),
  privateMode: z.boolean().default(true),
  inference: inferenceSettingsSchema.optional(),
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
  retrieval: retrievalSettingsSchema,
});

export const WorkspaceSettingsSchema = workspaceSettingsSchema;

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

const MUTABLE_REVISIONS = new Set(['main', 'master', 'latest', 'head']);

export function isPinnedModelRevision(revision: string): boolean {
  const normalized = revision.trim().toLowerCase();
  return normalized.length > 0 && !MUTABLE_REVISIONS.has(normalized);
}

export const requestedVsEffectiveSettingsSchema = z
  .object({
    workspaceId: z.string().min(1),
    requested: workspaceSettingsSchema,
    effective: z.object({
      privateMode: z.boolean(),
      embedding: z.object({
        providerId: z.string().min(1),
        modelId: z.string().min(1),
        revision: z.string().min(1),
        activeGenerationId: z.string().min(1).nullable(),
        fingerprint: z.string().min(1).nullable(),
        verified: z.boolean(),
      }),
      decision: z.object({
        providerId: z.string().min(1),
        modelId: z.string().min(1),
      }),
      llm: z.object({
        providerId: z.string().min(1),
        modelId: z.string().min(1),
        explanationMode: explanationModeSchema,
      }),
      retrieval: z.object({
        lexicalEnabled: z.boolean(),
        vectorEnabled: z.boolean(),
        topK: z.number().int().positive(),
        mode: effectiveRetrievalModeSchema,
        degradedReason: ragReasonCodeSchema.optional(),
      }),
    }),
    reindexRequired: z.boolean(),
    reasonCodes: z.array(ragReasonCodeSchema),
  })
  .superRefine((val, ctx) => {
    if (val.requested.workspaceId !== val.workspaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'requested.workspaceId must match workspaceId',
        path: ['requested', 'workspaceId'],
      });
    }
    if (
      val.effective.retrieval.mode === 'hybrid' ||
      val.effective.retrieval.mode === 'vector_only'
    ) {
      if (
        !val.effective.embedding.verified ||
        !val.effective.embedding.activeGenerationId ||
        !val.effective.embedding.fingerprint
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Vector-participating effective retrieval requires a verified embedding generation and fingerprint',
          path: ['effective', 'embedding', 'verified'],
        });
      }
    }
    if (
      val.effective.retrieval.mode === 'hybrid' &&
      (!val.effective.retrieval.lexicalEnabled || !val.effective.retrieval.vectorEnabled)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'hybrid retrieval mode requires both lexicalEnabled and vectorEnabled',
        path: ['effective', 'retrieval', 'mode'],
      });
    }
    if (
      val.effective.retrieval.mode === 'lexical_only' &&
      !val.effective.retrieval.lexicalEnabled
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lexical_only retrieval mode requires lexicalEnabled=true',
        path: ['effective', 'retrieval', 'mode'],
      });
    }
  });

export type RequestedVsEffectiveSettings = z.infer<
  typeof requestedVsEffectiveSettingsSchema
>;

export const DEFAULT_WORKSPACE_SETTINGS: Omit<WorkspaceSettings, 'workspaceId'> = {
  schemaVersion: 1,
  privateMode: true,
  inference: { layaEnabled: true, llmEnabled: true },
  embedding: {
    providerId: 'transformers-local',
    modelId: 'Xenova/all-MiniLM-L6-v2',
    revision: 'main',
  },
  decision: {
    providerId: 'laya-local',
    modelId: 'convaiinnovations/laya',
  },
  llm: {
    providerId: 'ollama-local',
    modelId: 'llama3.2:3b',
  },
  retrieval: {
    lexicalEnabled: true,
    vectorEnabled: true,
    topK: 5,
  },
};

export function createDefaultWorkspaceSettings(workspaceId: string): WorkspaceSettings {
  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    workspaceId,
  };
}

export interface LegacySettingsMigrationResult {
  settings: WorkspaceSettings;
  migrated: boolean;
  warnings: string[];
}

/**
 * Parses and migrates legacy or partially persisted workspace settings into the
 * canonical validated WorkspaceSettings schema while preserving privateMode=true
 * fail-closed semantics.
 */
export function migrateLegacyWorkspaceSettings(
  raw: unknown,
  fallbackWorkspaceId?: string
): LegacySettingsMigrationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid legacy workspace settings payload: expected an object');
  }

  const input = raw as Record<string, unknown>;
  const warnings: string[] = [];
  let migrated = false;

  const workspaceId =
    typeof input.workspaceId === 'string' && input.workspaceId.trim().length > 0
      ? input.workspaceId.trim()
      : fallbackWorkspaceId;

  if (!workspaceId) {
    throw new Error('WorkspaceSettings migration requires a non-empty workspaceId');
  }
  if (input.workspaceId !== workspaceId) {
    migrated = true;
  }

  let schemaVersion = input.schemaVersion;
  if (schemaVersion === undefined || schemaVersion === null || schemaVersion === 0) {
    schemaVersion = 1;
    migrated = true;
    warnings.push('MIGRATED_MISSING_SCHEMA_VERSION');
  }

  let privateMode = input.privateMode;
  if (privateMode === undefined) {
    privateMode = true;
    migrated = true;
    warnings.push('DEFAULTED_PRIVATE_MODE_TRUE');
  }

  const rawEmbedding =
    input.embedding && typeof input.embedding === 'object'
      ? (input.embedding as Record<string, unknown>)
      : {};
  const embedding = {
    providerId:
      typeof rawEmbedding.providerId === 'string' && rawEmbedding.providerId.length > 0
        ? rawEmbedding.providerId
        : DEFAULT_WORKSPACE_SETTINGS.embedding.providerId,
    modelId:
      typeof rawEmbedding.modelId === 'string' && rawEmbedding.modelId.length > 0
        ? rawEmbedding.modelId
        : DEFAULT_WORKSPACE_SETTINGS.embedding.modelId,
    revision:
      typeof rawEmbedding.revision === 'string' && rawEmbedding.revision.length > 0
        ? rawEmbedding.revision
        : DEFAULT_WORKSPACE_SETTINGS.embedding.revision,
  };

  if (
    rawEmbedding.providerId !== embedding.providerId ||
    rawEmbedding.modelId !== embedding.modelId ||
    rawEmbedding.revision !== embedding.revision
  ) {
    migrated = true;
  }

  if (!isPinnedModelRevision(embedding.revision)) {
    warnings.push('UNPINNED_MODEL_REVISION');
  }

  const rawDecision =
    input.decision && typeof input.decision === 'object'
      ? (input.decision as Record<string, unknown>)
      : {};
  const decision = {
    providerId:
      typeof rawDecision.providerId === 'string' && rawDecision.providerId.length > 0
        ? rawDecision.providerId
        : DEFAULT_WORKSPACE_SETTINGS.decision.providerId,
    modelId:
      typeof rawDecision.modelId === 'string' && rawDecision.modelId.length > 0
        ? rawDecision.modelId
        : DEFAULT_WORKSPACE_SETTINGS.decision.modelId,
  };
  if (
    rawDecision.providerId !== decision.providerId ||
    rawDecision.modelId !== decision.modelId
  ) {
    migrated = true;
  }

  const rawLlm =
    input.llm && typeof input.llm === 'object'
      ? (input.llm as Record<string, unknown>)
      : {};
  const llm = {
    providerId:
      typeof rawLlm.providerId === 'string' && rawLlm.providerId.length > 0
        ? rawLlm.providerId
        : DEFAULT_WORKSPACE_SETTINGS.llm.providerId,
    modelId:
      typeof rawLlm.modelId === 'string' && rawLlm.modelId.length > 0
        ? rawLlm.modelId
        : DEFAULT_WORKSPACE_SETTINGS.llm.modelId,
  };
  if (rawLlm.providerId !== llm.providerId || rawLlm.modelId !== llm.modelId) {
    migrated = true;
  }

  const rawRetrieval =
    input.retrieval && typeof input.retrieval === 'object'
      ? (input.retrieval as Record<string, unknown>)
      : {};
  let lexicalEnabled =
    typeof rawRetrieval.lexicalEnabled === 'boolean'
      ? rawRetrieval.lexicalEnabled
      : true;
  const vectorEnabled =
    typeof rawRetrieval.vectorEnabled === 'boolean'
      ? rawRetrieval.vectorEnabled
      : true;
  const topK =
    typeof rawRetrieval.topK === 'number'
      ? rawRetrieval.topK
      : DEFAULT_WORKSPACE_SETTINGS.retrieval.topK;

  if (
    rawRetrieval.lexicalEnabled === undefined ||
    rawRetrieval.vectorEnabled === undefined ||
    rawRetrieval.topK === undefined
  ) {
    migrated = true;
  }

  if (!lexicalEnabled && !vectorEnabled) {
    lexicalEnabled = true;
    migrated = true;
    warnings.push('REPAIRED_BOTH_RETRIEVAL_MODES_DISABLED');
  }

  const settings = workspaceSettingsSchema.parse({
    schemaVersion,
    workspaceId,
    privateMode,
    inference: input.inference,
    embedding,
    decision,
    llm,
    retrieval: {
      lexicalEnabled,
      vectorEnabled,
      topK,
    },
  });

  return {
    settings,
    migrated,
    warnings,
  };
}
