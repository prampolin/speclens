import { describe, it, expect } from 'vitest';
import {
  ProviderRegistry,
  PrivacyViolationError,
  EmbeddingProvider,
  DecisionProvider,
  ProviderManifest,
} from '../src/index.js';

describe('ProviderRegistry & Locality Enforcement', () => {
  const localEmbeddingManifest: ProviderManifest = {
    id: 'transformers-local',
    kind: 'embedding',
    implementationVersion: '1.0.0',
    executionLocation: 'local',
    requiresNetwork: false,
    modelId: 'bge-small',
    modelRevision: 'v1.0',
    supportsOffline: true,
  };

  const remoteEmbeddingManifest: ProviderManifest = {
    id: 'openai-remote',
    kind: 'embedding',
    implementationVersion: '1.0.0',
    executionLocation: 'remote',
    requiresNetwork: true,
    modelId: 'text-embedding-3-small',
    modelRevision: 'v1.0',
    supportsOffline: false,
  };

  const networkLocalManifest: ProviderManifest = {
    id: 'pseudo-local',
    kind: 'embedding',
    implementationVersion: '1.0.0',
    executionLocation: 'local',
    requiresNetwork: true, // Violates offline / privacy requirement
    modelId: 'some-model',
    modelRevision: 'v1.0',
    supportsOffline: true,
  };

  const unknownLocationManifest: ProviderManifest = {
    id: 'unknown-provider',
    kind: 'decision',
    implementationVersion: '1.0.0',
    executionLocation: 'unknown',
    requiresNetwork: false,
    modelId: 'decision-v1',
    modelRevision: 'v1.0',
    supportsOffline: true,
  };

  const mockLocalProvider: EmbeddingProvider = {
    manifest: localEmbeddingManifest,
    dimensions: async () => 384,
    embed: async () => [1, 0, 0],
    embedBatch: async () => [[1, 0, 0]],
    readiness: async () => ({ ready: true }),
  };

  const mockRemoteProvider: EmbeddingProvider = {
    manifest: remoteEmbeddingManifest,
    dimensions: async () => 1536,
    embed: async () => [0, 1, 0],
    embedBatch: async () => [[0, 1, 0]],
    readiness: async () => ({ ready: true }),
  };

  it('allows registering and getting valid local offline provider in privateMode=true', () => {
    const registry = new ProviderRegistry(true);
    registry.register(mockLocalProvider);

    expect(registry.has('transformers-local')).toBe(true);
    const retrieved = registry.get('transformers-local');
    expect(retrieved.manifest.id).toBe('transformers-local');
  });

  it('rejects remote provider when privateMode=true with PrivacyViolationError', () => {
    const registry = new ProviderRegistry(true);

    expect(() => {
      registry.register(mockRemoteProvider);
    }).toThrow(PrivacyViolationError);

    expect(() => {
      registry.register(mockRemoteProvider);
    }).toThrow(/executionLocation is "remote"/);
  });

  it('rejects provider requiring network when privateMode=true', () => {
    const registry = new ProviderRegistry(true);
    const mockNetworkProvider: EmbeddingProvider = {
      manifest: networkLocalManifest,
      dimensions: async () => 128,
      embed: async () => [1],
      embedBatch: async () => [[1]],
      readiness: async () => ({ ready: true }),
    };

    expect(() => {
      registry.register(mockNetworkProvider);
    }).toThrow(PrivacyViolationError);

    expect(() => {
      registry.register(mockNetworkProvider);
    }).toThrow(/requiresNetwork is true/);
  });

  it('rejects provider with unknown execution location in privateMode=true', () => {
    const registry = new ProviderRegistry(true);
    const mockUnknownProvider: DecisionProvider = {
      manifest: unknownLocationManifest,
      classify: async () => ({
        intent: 'search_endpoint',
        confidence: 1,
        abstained: false,
      }),
      readiness: async () => ({ ready: true }),
    };

    expect(() => {
      registry.register(mockUnknownProvider);
    }).toThrow(PrivacyViolationError);

    expect(() => {
      registry.register(mockUnknownProvider);
    }).toThrow(/must be "local"/);
  });

  it('allows remote provider when privateMode is explicitly false', () => {
    const registry = new ProviderRegistry(false);
    registry.register(mockRemoteProvider, { privateMode: false });

    expect(registry.has('openai-remote')).toBe(true);
    const retrieved = registry.get('openai-remote', { privateMode: false });
    expect(retrieved.manifest.id).toBe('openai-remote');
  });

  it('filters providers by kind', () => {
    const registry = new ProviderRegistry(true);
    registry.register(mockLocalProvider);

    const embeddingProviders = registry.list({ kind: 'embedding' });
    expect(embeddingProviders).toHaveLength(1);

    const decisionProviders = registry.list({ kind: 'decision' });
    expect(decisionProviders).toHaveLength(0);
  });
});
