import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { parseOpenAPIDocument, normalizeDocument } from '@speclens/openapi-core';
import {
  createDatabase,
  WorkspaceRepository,
  SpecificationRepository,
} from '@speclens/db';
import {
  LocalFlatVectorIndex,
  RuleDecisionProvider,
  HybridRetrievalImpl,
  indexOperations,
  type EmbeddingProvider,
} from '@speclens/ai-core';

export interface PercentileMetric {
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  samples: number;
}

export interface MemoryMetric {
  rssBeforeMb: number;
  rssAfterMb: number;
  heapUsedBeforeMb: number;
  heapUsedAfterMb: number;
  deltaHeapMb: number;
}

export interface LatencyBaselineReport {
  timestamp: string;
  hardware: {
    arch: string;
    platform: string;
    totalMemMb: number;
    freeMemMb: number;
    cpuModel: string;
    cpuCores: number;
    nodeVersion: string;
  };
  metrics: {
    openApiParse: PercentileMetric;
    normalization: PercentileMetric;
    intentClassification: PercentileMetric;
    indexing50Operations: PercentileMetric;
    hybridSearch: PercentileMetric;
  };
  memory: {
    indexing50Operations: MemoryMetric;
  };
}

function calculatePercentiles(durations: number[]): PercentileMetric {
  if (durations.length === 0) {
    return { p50Ms: 0, p95Ms: 0, meanMs: 0, minMs: 0, maxMs: 0, samples: 0 };
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const p50Index = Math.min(Math.floor(sorted.length * 0.5), sorted.length - 1);
  const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    p50Ms: Number(sorted[p50Index].toFixed(3)),
    p95Ms: Number(sorted[p95Index].toFixed(3)),
    meanMs: Number((sum / sorted.length).toFixed(3)),
    minMs: Number(sorted[0].toFixed(3)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(3)),
    samples: sorted.length,
  };
}

function createSyntheticSpecWithOperations(count: number): string {
  let pathsYaml = '';
  for (let i = 1; i <= count; i++) {
    pathsYaml += `
  /resource-${i}:
    get:
      operationId: getResource${i}
      summary: "Obter recurso ${i}"
      description: "Recupera dados detalhados para o recurso de teste número ${i} com parâmetros de consulta."
      tags:
        - "Resources"
      parameters:
        - name: id
          in: query
          required: false
          schema:
            type: string
      responses:
        "200":
          description: "Sucesso"
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  title:
                    type: string
`;
  }

  return `
openapi: "3.0.3"
info:
  title: "Synthetic Benchmark API"
  version: "1.0.0"
  description: "API gerada sinteticamente para medição de latência e consumo de memória."
paths:
${pathsYaml}
`;
}

/**
 * Executes repeatable benchmark measurements without fabricated SLOs, recording actual system baselines.
 */
export async function runLatencyBenchmark(iterations = 15): Promise<LatencyBaselineReport> {
  const specContent = createSyntheticSpecWithOperations(50);

  // 1. Benchmark: OpenAPI Parse
  const parseTimes: number[] = [];
  let parsedDoc: any;
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    parsedDoc = parseOpenAPIDocument(specContent);
    const t1 = performance.now();
    parseTimes.push(t1 - t0);
  }

  // 2. Benchmark: Normalization
  const normTimes: number[] = [];
  let normalizedOps: any[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    normalizedOps = normalizeDocument(parsedDoc, 'bench-spec-50');
    const t1 = performance.now();
    normTimes.push(t1 - t0);
  }

  // 3. Benchmark: Intent Classification (RuleDecisionProvider)
  const ruleProvider = new RuleDecisionProvider();
  const classifyTimes: number[] = [];
  const testQueries = [
    'Como buscar um recurso por id?',
    'Gerar código para consultar /resource-1',
    'Explicar o schema de retorno',
    'Comparar endpoint /resource-1 com /resource-2',
  ];

  for (let i = 0; i < iterations; i++) {
    const q = testQueries[i % testQueries.length];
    const t0 = performance.now();
    await ruleProvider.classify(q);
    const t1 = performance.now();
    classifyTimes.push(t1 - t0);
  }

  // 4. Benchmark & Memory: Indexing 50 Operations (embed + FTS5)
  // Deterministic mock embedding provider to isolate pure engine indexing pipeline
  const mockEmbeddingProvider: EmbeddingProvider = {
    manifest: {
      id: 'bench-embed',
      kind: 'embedding',
      implementationVersion: '1.0.0',
      executionLocation: 'local',
      requiresNetwork: false,
      modelId: 'bench-model',
      modelRevision: '1.0',
      supportsOffline: true,
    },
    dimensions: async () => 8,
    embed: async (text: string) => {
      const v = new Array(8).fill(0);
      for (let j = 0; j < text.length; j++) {
        v[j % 8] = (v[j % 8] + text.charCodeAt(j)) % 100 / 100;
      }
      return v;
    },
    embedBatch: async (texts: string[]) => {
      return texts.map((t) => {
        const v = new Array(8).fill(0);
        for (let j = 0; j < t.length; j++) {
          v[j % 8] = (v[j % 8] + t.charCodeAt(j)) % 100 / 100;
        }
        return v;
      });
    },
    readiness: async () => ({ ready: true }),
  };

  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage();

  const indexTimes: number[] = [];
  let benchDb = createDatabase(':memory:');
  let benchVectorIndex = new LocalFlatVectorIndex();

  for (let i = 0; i < Math.min(iterations, 5); i++) {
    const db = createDatabase(':memory:');
    const wsRepo = new WorkspaceRepository(db);
    wsRepo.create({ id: 'bench-ws', title: 'Benchmark WS' });
    const specRepo = new SpecificationRepository(db);
    specRepo.create({
      id: 'bench-spec-50',
      workspaceId: 'bench-ws',
      title: 'Benchmark Spec',
      version: '1.0.0',
      dialect: 'openapi-3.0',
      sourceChecksum: 'bench-checksum',
      sourceContent: '',
    });

    const vIndex = new LocalFlatVectorIndex();
    const t0 = performance.now();
    await indexOperations({
      db,
      vectorIndex: vIndex,
      embeddingProvider: mockEmbeddingProvider,
      workspaceId: 'bench-ws',
      specificationId: 'bench-spec-50',
      operations: normalizedOps,
    });
    const t1 = performance.now();
    indexTimes.push(t1 - t0);

    // Keep the last db and vIndex for search benchmark
    benchDb = db;
    benchVectorIndex = vIndex;
  }

  const memAfter = process.memoryUsage();

  // 5. Benchmark: Hybrid Search (lexical + vector + RRF)
  const retrieval = new HybridRetrievalImpl({
    db: benchDb,
    vectorIndex: benchVectorIndex,
    embeddingProvider: mockEmbeddingProvider,
  });

  const searchTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await retrieval.search({
      text: 'obter dados detalhados recurso',
      workspaceId: 'bench-ws',
      topK: 5,
    });
    const t1 = performance.now();
    searchTimes.push(t1 - t0);
  }

  const cpus = os.cpus();
  const report: LatencyBaselineReport = {
    timestamp: new Date().toISOString(),
    hardware: {
      arch: process.arch,
      platform: process.platform,
      totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
      cpuModel: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cpuCores: cpus.length,
      nodeVersion: process.version,
    },
    metrics: {
      openApiParse: calculatePercentiles(parseTimes),
      normalization: calculatePercentiles(normTimes),
      intentClassification: calculatePercentiles(classifyTimes),
      indexing50Operations: calculatePercentiles(indexTimes),
      hybridSearch: calculatePercentiles(searchTimes),
    },
    memory: {
      indexing50Operations: {
        rssBeforeMb: Number((memBefore.rss / (1024 * 1024)).toFixed(2)),
        rssAfterMb: Number((memAfter.rss / (1024 * 1024)).toFixed(2)),
        heapUsedBeforeMb: Number((memBefore.heapUsed / (1024 * 1024)).toFixed(2)),
        heapUsedAfterMb: Number((memAfter.heapUsed / (1024 * 1024)).toFixed(2)),
        deltaHeapMb: Number(((memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024)).toFixed(2)),
      },
    },
  };

  return report;
}

/**
 * Saves latency baseline to the versioned baseline path.
 */
export async function saveLatencyBaseline(
  report: LatencyBaselineReport,
  filePath?: string
): Promise<string> {
  const targetPath =
    filePath ??
    path.resolve(process.cwd(), 'packages/evals/baselines/latency-baseline.json');

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(report, null, 2), 'utf8');
  return targetPath;
}
