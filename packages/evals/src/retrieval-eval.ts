import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createDatabase,
  type Database,
} from '@speclens/db';
import {
  parseOpenAPIDocument,
  normalizeDocument,
  type NormalizedOperation,
} from '@speclens/openapi-core';
import {
  HybridRetrievalImpl,
  indexOperations,
  LocalFlatVectorIndex,
  type EmbeddingProvider,
  type RetrievalResult,
} from '@speclens/ai-core';

export interface RetrievalEvalQuestion {
  id: string;
  query: string;
  expectedOperationId: string;
  expectedMethod: string;
  expectedPath: string;
  language: 'pt' | 'en';
}

export interface RetrievalMetricScores {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  top1Accuracy: number;
  totalQuestions: number;
  durationMs: number;
}

export interface RetrievalEvalItemResult {
  questionId: string;
  query: string;
  expectedOperationId: string;
  retrievedOperationId: string | null;
  retrievedRank: number | null;
  recallAt5: boolean;
  rr: number; // reciprocal rank
}

export interface RetrievalEvalSuiteResult {
  metrics: RetrievalMetricScores;
  results: RetrievalEvalItemResult[];
  timestamp: string;
}

/**
 * 10 Benchmark Evaluation Questions across PT-BR and EN-US based on Petstore 3.0
 */
export const PETSTORE_EVAL_DATASET: RetrievalEvalQuestion[] = [
  // 1. List pets - EN
  {
    id: 'q01-en-list-pets',
    query: 'How can I list all available pets in the store?',
    expectedOperationId: 'listPets',
    expectedMethod: 'GET',
    expectedPath: '/pets',
    language: 'en',
  },
  // 2. List pets - PT
  {
    id: 'q02-pt-list-pets',
    query: 'Quais endpoints me permitem listar todos os animais cadastrados?',
    expectedOperationId: 'listPets',
    expectedMethod: 'GET',
    expectedPath: '/pets',
    language: 'pt',
  },
  // 3. Create pet - EN
  {
    id: 'q03-en-create-pet',
    query: 'What endpoint adds or creates a new pet?',
    expectedOperationId: 'createPet',
    expectedMethod: 'POST',
    expectedPath: '/pets',
    language: 'en',
  },
  // 4. Create pet - PT
  {
    id: 'q04-pt-create-pet',
    query: 'Como cadastrar um novo pet no sistema?',
    expectedOperationId: 'createPet',
    expectedMethod: 'POST',
    expectedPath: '/pets',
    language: 'pt',
  },
  // 5. Show pet by ID - EN
  {
    id: 'q05-en-get-pet-by-id',
    query: 'Fetch pet details and info using petId',
    expectedOperationId: 'showPetById',
    expectedMethod: 'GET',
    expectedPath: '/pets/{petId}',
    language: 'en',
  },
  // 6. Show pet by ID - PT
  {
    id: 'q06-pt-get-pet-by-id',
    query: 'Buscar informações de um pet específico pelo identificador',
    expectedOperationId: 'showPetById',
    expectedMethod: 'GET',
    expectedPath: '/pets/{petId}',
    language: 'pt',
  },
  // 7. Delete pet - EN
  {
    id: 'q07-en-delete-pet',
    query: 'Delete or remove a pet from the database',
    expectedOperationId: 'deletePet',
    expectedMethod: 'DELETE',
    expectedPath: '/pets/{petId}',
    language: 'en',
  },
  // 8. Delete pet - PT
  {
    id: 'q08-pt-delete-pet',
    query: 'Excluir ou remover um animal pelo id',
    expectedOperationId: 'deletePet',
    expectedMethod: 'DELETE',
    expectedPath: '/pets/{petId}',
    language: 'pt',
  },
  // 9. Exact operation ID query
  {
    id: 'q09-exact-opid',
    query: 'showPetById',
    expectedOperationId: 'showPetById',
    expectedMethod: 'GET',
    expectedPath: '/pets/{petId}',
    language: 'en',
  },
  // 10. Filter query - Status filter
  {
    id: 'q10-filter-query',
    query: 'Filter pets by status available, pending or sold',
    expectedOperationId: 'listPets',
    expectedMethod: 'GET',
    expectedPath: '/pets',
    language: 'en',
  },
];

/**
 * Metric calculator functions: recall_at_k, mrr, top1_accuracy
 */
export function recallAtK(rank: number | null, k: number): number {
  return rank !== null && rank <= k ? 1.0 : 0.0;
}

export function reciprocalRank(rank: number | null): number {
  return rank !== null && rank > 0 ? 1.0 / rank : 0.0;
}

export function top1Accuracy(rank: number | null): number {
  return rank === 1 ? 1.0 : 0.0;
}

/**
 * Creates a deterministic local embedding provider for evals with domain keywords
 */
export function createEvalEmbeddingProvider(): EmbeddingProvider {
  return {
    manifest: {
      id: 'eval-deterministic-embed',
      kind: 'embedding',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'eval-bge-small',
      modelRevision: 'v1.0',
      supportsOffline: true,
    },
    dimensions: async () => 4,
    readiness: async () => ({ ready: true }),
    embed: async (text: string) => {
      const lower = text.toLowerCase();
      // d0: list/get/listar/status/todos/all
      // d1: create/add/cadastrar/novo/new/post
      // d2: id/petid/específico/details/details
      // d3: delete/remove/excluir/remover
      let d0 = 0.05;
      let d1 = 0.05;
      let d2 = 0.05;
      let d3 = 0.05;

      if (lower.includes('list') || lower.includes('listar') || lower.includes('todos') || lower.includes('status')) d0 += 0.9;
      if (lower.includes('create') || lower.includes('add') || lower.includes('cadastrar') || lower.includes('novo')) d1 += 0.9;
      if (lower.includes('id') || lower.includes('específico') || lower.includes('details') || lower.includes('showpetbyid')) d2 += 0.9;
      if (lower.includes('delete') || lower.includes('remove') || lower.includes('excluir') || lower.includes('remover')) d3 += 0.9;

      const norm = Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3);
      return [d0 / norm, d1 / norm, d2 / norm, d3 / norm];
    },
    embedBatch: async function (texts: string[]) {
      return Promise.all(texts.map((t) => this.embed(t)));
    },
  };
}

/**
 * Executes evaluation suite on a database with Petstore operations indexed
 */
export async function runRetrievalEvaluation(options?: {
  db?: Database;
  operations?: NormalizedOperation[];
}): Promise<RetrievalEvalSuiteResult> {
  const startTime = Date.now();
  const db = options?.db ?? createDatabase(':memory:');
  const vectorIndex = new LocalFlatVectorIndex();
  const embeddingProvider = createEvalEmbeddingProvider();

  const workspaceId = 'ws-eval';
  const specificationId = 'spec-petstore-3.0';

  // Load Petstore YAML fixture
  let operations = options?.operations;
  if (!operations) {
    const yamlPath = resolve(
      process.cwd(),
      'packages/openapi-core/src/__tests__/fixtures/petstore-3.0.yaml'
    );
    const yamlContent = readFileSync(yamlPath, 'utf8');
    const parsed = parseOpenAPIDocument(yamlContent, { filename: 'petstore-3.0.yaml' });
    operations = normalizeDocument(parsed, specificationId);
  }

  // Seed db workspace & specification
  db.prepare(`
    INSERT OR IGNORE INTO workspaces (id, title, created_at, updated_at)
    VALUES (?, 'Eval Workspace', datetime('now'), datetime('now'))
  `).run(workspaceId);

  db.prepare(`
    INSERT OR IGNORE INTO specifications (id, workspace_id, title, version, dialect, source_checksum, is_active, imported_at, created_at, updated_at)
    VALUES (?, ?, 'Petstore 3.0', '1.0.0', 'openapi_3_0', 'eval-chk', 1, datetime('now'), datetime('now'), datetime('now'))
  `).run(specificationId, workspaceId);

  // Index operations
  await indexOperations({
    db,
    vectorIndex,
    embeddingProvider,
    workspaceId,
    specificationId,
    operations,
  });

  const retriever = new HybridRetrievalImpl({
    db,
    vectorIndex,
    embeddingProvider,
    fusionConfig: { k: 60, topK: 5 },
  });

  const results: RetrievalEvalItemResult[] = [];
  let sumRecallAt1 = 0;
  let sumRecallAt3 = 0;
  let sumRecallAt5 = 0;
  let sumMRR = 0;
  let sumTop1 = 0;

  for (const q of PETSTORE_EVAL_DATASET) {
    const searchHits = await retriever.search({
      text: q.query,
      workspaceId,
      specificationId,
      topK: 5,
    });

    // Find expected operation in ranked results
    let foundRank: number | null = null;
    let foundOpId: string | null = null;

    for (let i = 0; i < searchHits.length; i++) {
      const hit = searchHits[i]!;
      // An operation matches if operationId matches or path + method matches
      // Retrieve operation details from db
      const entity = db
        .prepare('SELECT operation_id, method, path FROM operations WHERE id = ?')
        .get(hit.operationId) as { operation_id: string; method: string; path: string } | undefined;

      if (
        entity &&
        (entity.operation_id === q.expectedOperationId ||
          (entity.method.toUpperCase() === q.expectedMethod.toUpperCase() &&
            entity.path === q.expectedPath))
      ) {
        foundRank = i + 1;
        foundOpId = entity.operation_id;
        break;
      }
    }

    const r1 = recallAtK(foundRank, 1);
    const r3 = recallAtK(foundRank, 3);
    const r5 = recallAtK(foundRank, 5);
    const rr = reciprocalRank(foundRank);
    const top1 = top1Accuracy(foundRank);

    sumRecallAt1 += r1;
    sumRecallAt3 += r3;
    sumRecallAt5 += r5;
    sumMRR += rr;
    sumTop1 += top1;

    results.push({
      questionId: q.id,
      query: q.query,
      expectedOperationId: q.expectedOperationId,
      retrievedOperationId: foundOpId,
      retrievedRank: foundRank,
      recallAt5: r5 === 1.0,
      rr,
    });
  }

  const n = PETSTORE_EVAL_DATASET.length;
  const metrics: RetrievalMetricScores = {
    recallAt1: sumRecallAt1 / n,
    recallAt3: sumRecallAt3 / n,
    recallAt5: sumRecallAt5 / n,
    mrr: sumMRR / n,
    top1Accuracy: sumTop1 / n,
    totalQuestions: n,
    durationMs: Date.now() - startTime,
  };

  return {
    metrics,
    results,
    timestamp: new Date().toISOString(),
  };
}
