import { IndexedVector, VectorHit, VectorIndex } from '../types.js';
import { IndexedVectorSchema } from '../schemas.js';

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalizes a vector to unit length (L2 norm).
 */
export function normalizeVector(vec: number[]): number[] {
  let sumSq = 0;
  for (const v of vec) {
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) {
    return vec.slice();
  }
  return vec.map((v) => v / norm);
}

/**
 * In-memory / development implementation of VectorIndex using exact flat cosine similarity.
 * Replaceable with SQLite-vec or sqlite-vss in subsequent phases.
 */
export class LocalFlatVectorIndex implements VectorIndex {
  private namespaces = new Map<string, Map<string, IndexedVector>>();

  public async upsert(
    namespace: string,
    vectors: IndexedVector[]
  ): Promise<void> {
    if (!this.namespaces.has(namespace)) {
      this.namespaces.set(namespace, new Map());
    }
    const store = this.namespaces.get(namespace)!;

    for (const v of vectors) {
      IndexedVectorSchema.parse(v);
      store.set(v.id, {
        id: v.id,
        vector: [...v.vector],
        metadata: v.metadata ? { ...v.metadata } : undefined,
      });
    }
  }

  public async search(
    namespace: string,
    vector: number[],
    limit: number
  ): Promise<VectorHit[]> {
    const store = this.namespaces.get(namespace);
    if (!store || store.size === 0) {
      return [];
    }

    const hits: VectorHit[] = [];

    for (const item of store.values()) {
      const score = cosineSimilarity(vector, item.vector);
      hits.push({
        id: item.id,
        score,
        metadata: item.metadata,
      });
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, Math.max(0, limit));
  }

  public async deleteNamespace(namespace: string): Promise<void> {
    this.namespaces.delete(namespace);
  }

  public count(namespace: string): number {
    return this.namespaces.get(namespace)?.size ?? 0;
  }

  public listNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  public clear(): void {
    this.namespaces.clear();
  }
}
