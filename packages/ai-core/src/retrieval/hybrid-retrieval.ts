import type { Database } from 'better-sqlite3';
import { OperationRepository } from '@speclens/db';
import type {
  EmbeddingProvider,
  VectorIndex,
  VectorNamespaceKey,
} from '../types.js';
import { namespaceId } from '../providers/embedding/namespace.js';
import {
  type HybridQuery,
  type HybridRetrieval,
  type RetrievalResult,
  type FusionConfig,
  hybridQuerySchema,
} from './types.js';

export interface HybridRetrievalConfig {
  db: Database;
  vectorIndex: VectorIndex;
  embeddingProvider: EmbeddingProvider;
  fusionConfig?: Partial<FusionConfig>;
  chunkingVersion?: string;
}

interface ScoredCandidate {
  id: string; // db operation id
  specificationId: string;
  method: string;
  path: string;
  tags: string[];
  lexicalScore: number | null;
  lexicalRank: number | null;
  vectorScore: number | null;
  vectorRank: number | null;
  fusedScore: number;
}

export class HybridRetrievalImpl implements HybridRetrieval {
  private readonly db: Database;
  private readonly vectorIndex: VectorIndex;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly fusionConfig: Required<Omit<FusionConfig, 'threshold'>> & {
    threshold?: number;
  };
  private readonly chunkingVersion: string;
  private readonly operationRepo: OperationRepository;

  constructor(config: HybridRetrievalConfig) {
    this.db = config.db;
    this.vectorIndex = config.vectorIndex;
    this.embeddingProvider = config.embeddingProvider;
    this.chunkingVersion = config.chunkingVersion ?? 'v1.0.0';
    this.operationRepo = new OperationRepository(this.db);

    const fc = config.fusionConfig ?? {};
    const kFactor = fc.k ?? fc.rrfK ?? 60;

    this.fusionConfig = {
      algorithm: fc.algorithm ?? 'rrf',
      k: kFactor,
      rrfK: kFactor,
      lexicalWeight: fc.lexicalWeight ?? 0.5,
      vectorWeight: fc.vectorWeight ?? 0.5,
      topK: fc.topK ?? 5,
      threshold: fc.threshold,
    };
  }

  async search(query: HybridQuery): Promise<RetrievalResult[]> {
    const validated = hybridQuerySchema.parse(query);
    const topK = validated.topK ?? this.fusionConfig.topK;

    const candidateMap = new Map<string, ScoredCandidate>();

    // 1. Lexical Search via SQLite FTS5 (OperationRepository)
    // Fetch a wider pool (topK * 4 or min 20) for rank fusion
    const searchLimit = Math.max(topK * 4, 20);
    const lexicalResults = this.operationRepo.fullTextSearch(validated.text, {
      workspaceId: validated.workspaceId,
      specificationId: validated.specificationId,
      limit: searchLimit,
    });

    lexicalResults.forEach((res, index) => {
      const op = res.operation;
      const rank = index + 1;
      // BM25 in SQLite is negative or positive depending on ranking function;
      // res.rank is bm25(operation_fts). Lower is better in raw SQLite bm25, but we record score and rank.
      candidateMap.set(op.id, {
        id: op.id,
        specificationId: op.specificationId,
        method: op.method,
        path: op.path,
        tags: op.tags,
        lexicalScore: res.rank,
        lexicalRank: rank,
        vectorScore: null,
        vectorRank: null,
        fusedScore: 0,
      });
    });

    // 2. Vector Search via VectorIndex
    let vectorNamespace: string | null = null;
    if (validated.specificationId) {
      const dims = await this.embeddingProvider.dimensions();
      const namespaceKey: VectorNamespaceKey = {
        workspaceId: validated.workspaceId,
        specificationId: validated.specificationId,
        providerId: this.embeddingProvider.manifest.id,
        modelId: this.embeddingProvider.manifest.modelId,
        modelRevision: this.embeddingProvider.manifest.modelRevision,
        dimensions: dims,
        chunkingVersion: this.chunkingVersion,
      };
      vectorNamespace = namespaceId(namespaceKey);
    } else {
      // Find namespaces for this workspace
      const stmt = this.db.prepare(
        'SELECT id FROM specifications WHERE workspace_id = ?'
      );
      const specs = stmt.all(validated.workspaceId) as Array<{
        id: string;
      }>;
      const dims = await this.embeddingProvider.dimensions();

      // If workspace has specifications, use their namespaces
      // For single or multiple, we search the namespaces in vectorIndex
      const namespacesToSearch: string[] = [];
      for (const spec of specs) {
        const key: VectorNamespaceKey = {
          workspaceId: validated.workspaceId,
          specificationId: spec.id,
          providerId: this.embeddingProvider.manifest.id,
          modelId: this.embeddingProvider.manifest.modelId,
          modelRevision: this.embeddingProvider.manifest.modelRevision,
          dimensions: dims,
          chunkingVersion: this.chunkingVersion,
        };
        namespacesToSearch.push(namespaceId(key));
      }

      // If we have namespaces, pick or iterate
      if (namespacesToSearch.length === 1) {
        vectorNamespace = namespacesToSearch[0]!;
      } else if (namespacesToSearch.length > 1) {
        // Multi-spec search: search all matching namespaces
        // We handle this below
      }
    }

    try {
      const queryEmbedding = await this.embeddingProvider.embed(validated.text);
      const allVectorHits: Array<{
        id: string;
        score: number;
        metadata?: Record<string, unknown>;
      }> = [];

      if (vectorNamespace) {
        const hits = await this.vectorIndex.search(
          vectorNamespace,
          queryEmbedding,
          searchLimit
        );
        allVectorHits.push(...hits);
      } else {
        // Search all known namespaces in vector index that match workspace
        const viAny = this.vectorIndex as unknown as { listNamespaces?: () => string[] };
        const allNs = typeof viAny.listNamespaces === 'function' ? viAny.listNamespaces() : [];
        for (const ns of allNs) {
          const hits = await this.vectorIndex.search(
            ns,
            queryEmbedding,
            searchLimit
          );
          allVectorHits.push(...hits);
        }
      }

      // Sort combined vector hits by descending cosine similarity
      allVectorHits.sort((a, b) => b.score - a.score);

      allVectorHits.forEach((hit, index) => {
        const rank = index + 1;
        const existing = candidateMap.get(hit.id);
        if (existing) {
          existing.vectorScore = hit.score;
          existing.vectorRank = rank;
        } else {
          // Candidate only in vector search; get operation metadata from db or hit metadata
          let specId = (hit.metadata?.specificationId as string) || '';
          let method = (hit.metadata?.method as string) || '';
          let path = (hit.metadata?.path as string) || '';
          let tags = (hit.metadata?.tags as string[]) || [];

          if (!method || !path) {
            const entity = this.operationRepo.findById(hit.id);
            if (entity) {
              specId = entity.specificationId;
              method = entity.method;
              path = entity.path;
              tags = entity.tags;
            }
          }

          if (method && path) {
            candidateMap.set(hit.id, {
              id: hit.id,
              specificationId: specId,
              method,
              path,
              tags,
              lexicalScore: null,
              lexicalRank: null,
              vectorScore: hit.score,
              vectorRank: rank,
              fusedScore: 0,
            });
          }
        }
      });
    } catch {
      // If embedding fails or is unavailable, lexical search alone can still contribute
    }

    // If both return empty -> return [] (never invent operations)
    if (candidateMap.size === 0) {
      return [];
    }

    // 3. Apply Filters (methods, tags, paths)
    const filters = validated.filters;
    let candidates = Array.from(candidateMap.values());

    if (filters) {
      if (filters.methods && filters.methods.length > 0) {
        const upperMethods = new Set(
          filters.methods.map((m) => m.toUpperCase())
        );
        candidates = candidates.filter((c) =>
          upperMethods.has(c.method.toUpperCase())
        );
      }
      if (filters.tags && filters.tags.length > 0) {
        const tagSet = new Set(filters.tags.map((t) => t.toLowerCase()));
        candidates = candidates.filter((c) =>
          c.tags.some((t) => tagSet.has(t.toLowerCase()))
        );
      }
      if (filters.paths && filters.paths.length > 0) {
        const pathSet = new Set(filters.paths);
        candidates = candidates.filter((c) => pathSet.has(c.path));
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    // 4. Fusion Calculation (RRF or Weighted)
    const k = this.fusionConfig.k;
    const wLex = this.fusionConfig.lexicalWeight;
    const wVec = this.fusionConfig.vectorWeight;

    for (const c of candidates) {
      let rrfScore = 0;
      if (c.lexicalRank !== null) {
        rrfScore += wLex * (1 / (k + c.lexicalRank));
      }
      if (c.vectorRank !== null) {
        rrfScore += wVec * (1 / (k + c.vectorRank));
      }
      c.fusedScore = rrfScore;
    }

    // 5. Rank and Sort
    // Deterministic tie-breaking: fusedScore DESC -> vectorScore DESC -> lexicalScore DESC -> id ASC
    candidates.sort((a, b) => {
      if (Math.abs(b.fusedScore - a.fusedScore) > 1e-9) {
        return b.fusedScore - a.fusedScore;
      }
      const vecA = a.vectorScore ?? -1;
      const vecB = b.vectorScore ?? -1;
      if (Math.abs(vecB - vecA) > 1e-6) {
        return vecB - vecA;
      }
      return a.id.localeCompare(b.id);
    });

    // 6. Apply threshold if configured
    if (this.fusionConfig.threshold !== undefined) {
      const thresh = this.fusionConfig.threshold;
      candidates = candidates.filter((c) => c.fusedScore >= thresh);
    }

    // 7. Select Top-K and construct RetrievalResult
    const topCandidates = candidates.slice(0, topK);

    return topCandidates.map((c, index) => ({
      operationId: c.id,
      specificationId: c.specificationId,
      method: c.method,
      path: c.path,
      lexicalScore: c.lexicalScore,
      vectorScore: c.vectorScore,
      fusedScore: c.fusedScore,
      rank: index + 1,
      lexicalRank: c.lexicalRank,
      vectorRank: c.vectorRank,
    }));
  }
}
