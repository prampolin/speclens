import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  TransformersLocalEmbeddingProvider,
  PrivacyViolationError,
  LocalFlatVectorIndex,
  cosineSimilarity,
  namespaceId,
  areNamespacesCompatible,
  VectorNamespaceKey,
} from '../src/index.js';

describe('TransformersLocalEmbeddingProvider & VectorIndex', () => {
  const testDir = resolve(tmpdir(), 'speclens-test-embedding-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      void testDir;
    }
  });

  it('fails readiness and throws PrivacyViolationError on embed when model is missing and privateMode=true', async () => {
    const missingPath = resolve(testDir, 'nonexistent-model');
    const provider = new TransformersLocalEmbeddingProvider({
      modelPath: missingPath,
      revision: 'v1.0',
      privateMode: true,
      dimensions: 384,
    });

    const ready = await provider.readiness();
    expect(ready.ready).toBe(false);
    expect(ready.reason).toContain('Local model files not found');

    await expect(provider.embed('hello world')).rejects.toThrow(
      PrivacyViolationError
    );
    await expect(provider.embed('hello world')).rejects.toThrow(
      /Remote download is strictly prohibited/
    );
  });

  it('generates normalized unit vector when local model directory exists', async () => {
    // Simulate pre-provisioned local weights directory
    const modelDir = resolve(testDir, 'local-bge');
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(resolve(modelDir, 'config.json'), '{"dims": 384}');

    const provider = new TransformersLocalEmbeddingProvider({
      modelPath: modelDir,
      revision: 'pinned-rev',
      privateMode: true,
      dimensions: 384,
    });

    const ready = await provider.readiness();
    expect(ready.ready).toBe(true);

    const vec = await provider.embed('POST /items create item');
    expect(vec).toHaveLength(384);

    // Verify L2 norm is 1.0 (normalized unit vector)
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('calculates exact cosine similarity correctly', () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    const v3 = [1, 0, 0];
    const v4 = [-1, 0, 0];

    // Orthogonal
    expect(cosineSimilarity(v1, v2)).toBe(0);

    // Identical
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(1.0, 5);

    // Opposite
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(-1.0, 5);

    // Arbitrary vectors
    const a = [3, 4]; // norm = 5
    const b = [4, 3]; // norm = 5, dot = 12 + 12 = 24 -> 24 / 25 = 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.96, 5);
  });

  it('upserts and searches in LocalFlatVectorIndex with ranking', async () => {
    const index = new LocalFlatVectorIndex();
    const ns = 'test-namespace';

    await index.upsert(ns, [
      { id: 'item-1', vector: [1, 0, 0], metadata: { title: 'First' } },
      { id: 'item-2', vector: [0.8, 0.6, 0], metadata: { title: 'Second' } },
      { id: 'item-3', vector: [0, 1, 0], metadata: { title: 'Third' } },
    ]);

    expect(index.count(ns)).toBe(3);

    // Query closest to item-1
    const hits = await index.search(ns, [1, 0, 0], 2);
    expect(hits).toHaveLength(2);
    expect(hits[0]!.id).toBe('item-1');
    expect(hits[0]!.score).toBeCloseTo(1.0, 5);
    expect(hits[1]!.id).toBe('item-2');
    expect(hits[1]!.score).toBeCloseTo(0.8, 5);

    // Delete namespace
    await index.deleteNamespace(ns);
    expect(index.count(ns)).toBe(0);
    const emptyHits = await index.search(ns, [1, 0, 0], 10);
    expect(emptyHits).toHaveLength(0);
  });

  describe('Vector Namespace Fingerprinting', () => {
    const baseKey: VectorNamespaceKey = {
      workspaceId: 'ws-123',
      specificationId: 'spec-456',
      providerId: 'transformers-local',
      modelId: 'bge-small-en-v1.5',
      modelRevision: 'rev-1',
      dimensions: 384,
      chunkingVersion: 'v1.0.0',
    };

    it('generates deterministic namespaceId for identical inputs', () => {
      const id1 = namespaceId(baseKey);
      const id2 = namespaceId({ ...baseKey });

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^ns_transformers-local_[a-f0-9]{32}$/);
    });

    it('generates different namespaceId when modelRevision or dimensions change', () => {
      const idOriginal = namespaceId(baseKey);

      const idNewRev = namespaceId({ ...baseKey, modelRevision: 'rev-2' });
      expect(idNewRev).not.toBe(idOriginal);

      const idNewDims = namespaceId({ ...baseKey, dimensions: 768 });
      expect(idNewDims).not.toBe(idOriginal);

      const idNewChunking = namespaceId({
        ...baseKey,
        chunkingVersion: 'v2.0.0',
      });
      expect(idNewChunking).not.toBe(idOriginal);
    });

    it('validates namespace compatibility', () => {
      expect(areNamespacesCompatible(baseKey, { ...baseKey })).toBe(true);

      expect(
        areNamespacesCompatible(baseKey, { ...baseKey, dimensions: 512 })
      ).toBe(false);

      expect(
        areNamespacesCompatible(baseKey, {
          ...baseKey,
          modelRevision: 'other-rev',
        })
      ).toBe(false);
    });
  });
});
