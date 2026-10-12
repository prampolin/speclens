import {
  LocalFlatVectorIndex,
  TransformersLocalEmbeddingProvider,
  LayaLocalProvider,
  RuleDecisionProvider,
  DecisionOrchestrator,
  OllamaLLMProvider,
  validateOllamaUrl,
  isCloudBackedModel,
  PrivacyViolationError,
  type EmbeddingProvider,
  type DecisionProvider,
  type LLMProvider,
  type VectorIndex,
  type ProviderManifest,
  type ProviderReadiness,
  type Intent,
  type ClassifyResult,
} from '@speclens/ai-core';
import { resolve } from 'node:path';
import { getDatabase } from './db';
import {
  SettingsRepository,
  createDefaultWorkspaceSettings,
  workspaceSettingsSchema,
  type WorkspaceSettings,
} from '@speclens/db';

const DEFAULT_OLLAMA_MODEL_ID = 'llama3.2:3b';

function isCloudBackedModelId(modelId: string): boolean {
  return isCloudBackedModel({ name: modelId });
}

let vectorIndexInstance: VectorIndex = new LocalFlatVectorIndex();

let embeddingProviderInstance: EmbeddingProvider = new TransformersLocalEmbeddingProvider({
  modelPath: resolve(process.cwd(), '.speclens', 'models', 'embedding'),
  revision: 'main',
  privateMode: true,
  dimensions: 384,
  modelId: 'Xenova/all-MiniLM-L6-v2',
});

const defaultOrchestrator = new DecisionOrchestrator(
  new LayaLocalProvider({
    modelPath: resolve(process.cwd(), '.speclens', 'models', 'laya'),
    confidenceThreshold: 0.7,
    privateMode: true,
  }),
  new RuleDecisionProvider()
);

let decisionProviderInstance: DecisionProvider = {
  manifest: defaultOrchestrator.primary.manifest,
  async readiness(): Promise<ProviderReadiness> {
    const primaryReady = await defaultOrchestrator.primary.readiness();
    if (primaryReady.ready) return primaryReady;
    return defaultOrchestrator.fallback.readiness();
  },
  async classify(input: string, candidates?: Intent[], signal?: AbortSignal): Promise<ClassifyResult> {
    return defaultOrchestrator.classify(input, candidates, signal);
  },
};

const defaultOllamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

export function resolveWorkspaceSettings(workspaceId: string): WorkspaceSettings {
  const repository = new SettingsRepository(getDatabase());
  const workspace = getDatabase().prepare('SELECT id FROM workspaces WHERE id = ?').get(workspaceId);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);
  const saved = repository.get(workspaceId);
  if (saved) return workspaceSettingsSchema.parse(saved);

  const defaults = workspaceSettingsSchema.parse(createDefaultWorkspaceSettings(workspaceId));
  const resolved = workspaceSettingsSchema.parse({
    ...defaults,
    llm: { ...defaults.llm, modelId: process.env.OLLAMA_MODEL_ID ?? DEFAULT_OLLAMA_MODEL_ID },
  });
  // Validate before persisting the bootstrap selection.
  createWorkspaceLLMProvider(resolved);
  return repository.save(workspaceId, resolved);
}

export function createWorkspaceLLMProvider(settings: WorkspaceSettings): LLMProvider {
  if (settings.llm.providerId !== 'ollama-local') {
    throw new Error(`Unsupported LLM provider: ${settings.llm.providerId}`);
  }
  validateOllamaUrl(defaultOllamaBaseUrl, settings.privateMode);
  if (settings.privateMode && isCloudBackedModelId(settings.llm.modelId)) {
    throw new PrivacyViolationError('Cloud-backed Ollama models are not allowed in Private Mode.');
  }
  return new OllamaLLMProvider({
    baseUrl: defaultOllamaBaseUrl,
    modelId: settings.llm.modelId,
    privateMode: settings.privateMode,
    timeoutMs: 30000,
  });
}

export function getVectorIndex(): VectorIndex {
  return vectorIndexInstance;
}

export function setVectorIndex(index: VectorIndex): void {
  vectorIndexInstance = index;
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return embeddingProviderInstance;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  embeddingProviderInstance = provider;
}

export function getDecisionProvider(): DecisionProvider {
  return decisionProviderInstance;
}

export function setDecisionProvider(provider: DecisionProvider): void {
  decisionProviderInstance = provider;
}

export function getLLMProvider(): LLMProvider {
  return createWorkspaceLLMProvider(resolveWorkspaceSettings('default'));
}

export function setLLMProvider(provider: LLMProvider): void {
  llmProviderOverride = provider;
}

let llmProviderOverride: LLMProvider | null = null;

export function getWorkspaceLLMProvider(settings: WorkspaceSettings): LLMProvider {
  return llmProviderOverride ?? createWorkspaceLLMProvider(settings);
}

export interface ProviderStatusInfo {
  id: string;
  kind: 'embedding' | 'decision' | 'llm';
  executionLocation: 'local' | 'remote' | 'unknown' | string;
  modelId: string;
  ready: boolean;
  reason?: string;
  supportsOffline: boolean;
  requiresNetwork: boolean;
}

export async function getProvidersReadiness(workspaceId = 'default'): Promise<{
  db: { ready: boolean; reason?: string };
  providers: ProviderStatusInfo[];
}> {
  let dbReady = true;
  let dbReason: string | undefined;

  try {
    const db = getDatabase();
    db.prepare('SELECT 1').get();
  } catch (err) {
    dbReady = false;
    dbReason = err instanceof Error ? err.message : String(err);
  }

  const emb = getEmbeddingProvider();
  const dec = getDecisionProvider();
  const llm = getWorkspaceLLMProvider(resolveWorkspaceSettings(workspaceId));

  const [embReady, decReady, llmReady] = await Promise.all([
    emb.readiness().catch((e) => ({ ready: false, reason: e.message })),
    dec.readiness().catch((e) => ({ ready: false, reason: e.message })),
    llm.readiness().catch((e) => ({ ready: false, reason: e.message })),
  ]);

  const providers: ProviderStatusInfo[] = [
    {
      id: emb.manifest.id,
      kind: emb.manifest.kind,
      executionLocation: emb.manifest.executionLocation,
      modelId: emb.manifest.modelId,
      ready: embReady.ready,
      reason: embReady.reason,
      supportsOffline: emb.manifest.supportsOffline,
      requiresNetwork: emb.manifest.requiresNetwork,
    },
    {
      id: dec.manifest.id,
      kind: dec.manifest.kind,
      executionLocation: dec.manifest.executionLocation,
      modelId: dec.manifest.modelId,
      ready: decReady.ready,
      reason: decReady.reason,
      supportsOffline: dec.manifest.supportsOffline,
      requiresNetwork: dec.manifest.requiresNetwork,
    },
    {
      id: llm.manifest.id,
      kind: llm.manifest.kind,
      executionLocation: llm.manifest.executionLocation,
      modelId: llm.manifest.modelId,
      ready: llmReady.ready,
      reason: llmReady.reason,
      supportsOffline: llm.manifest.supportsOffline,
      requiresNetwork: llm.manifest.requiresNetwork,
    },
  ];

  return {
    db: { ready: dbReady, reason: dbReason },
    providers,
  };
}
