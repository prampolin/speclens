import { z } from 'zod';

export const workspaceSettingsSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  workspaceId: z.string().min(1),
  privateMode: z.boolean().default(true),
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
    lexicalEnabled: z.boolean().default(true),
    vectorEnabled: z.boolean().default(true),
    topK: z.number().int().positive(),
  }),
});

export const WorkspaceSettingsSchema = workspaceSettingsSchema;

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export const DEFAULT_WORKSPACE_SETTINGS: Omit<WorkspaceSettings, 'workspaceId'> = {
  schemaVersion: 1,
  privateMode: true,
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
