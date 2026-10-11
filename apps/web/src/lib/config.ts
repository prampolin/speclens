import type { WorkspaceSettings } from '@speclens/ai-core';

export const DEFAULT_CONFIG: WorkspaceSettings = {
  schemaVersion: 1,
  workspaceId: 'default',
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
    modelId: 'llama3.2:latest',
  },
  retrieval: {
    lexicalEnabled: true,
    vectorEnabled: true,
    topK: 5,
  },
};
