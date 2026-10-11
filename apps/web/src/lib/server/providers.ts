import {
  LocalFlatVectorIndex,
  TransformersLocalEmbeddingProvider,
  LayaLocalProvider,
  RuleDecisionProvider,
  DecisionOrchestrator,
  OllamaLLMProvider,
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

let llmProviderInstance: LLMProvider = new OllamaLLMProvider({
  baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  modelId: process.env.OLLAMA_MODEL_ID ?? 'llama3.2:latest',
  privateMode: true,
  timeoutMs: 30000,
});

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
  return llmProviderInstance;
}

export function setLLMProvider(provider: LLMProvider): void {
  llmProviderInstance = provider;
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

export async function getProvidersReadiness(): Promise<{
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
  const llm = getLLMProvider();

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
