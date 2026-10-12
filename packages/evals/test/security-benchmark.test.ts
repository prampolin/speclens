import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  runPrivacyEvaluation,
  runAdversarialEvaluation,
  runLatencyBenchmark,
  saveLatencyBaseline,
} from '../src/index.js';
import fs from 'node:fs';
import { OllamaLLMProvider } from '@speclens/ai-core';
import type { ExplanationEvent, NormalizedOperation } from '@speclens/ai-core';

const ollamaOperation = {
  id: 'fake-operation',
  specId: 'fake-spec',
  method: 'post',
  path: '/fake',
  tags: [],
  servers: [],
  parameters: [],
  responses: {},
  sourcePointer: '#/paths/~1fake/post',
} as NormalizedOperation;

async function consumePrivateGeneration(provider: OllamaLLMProvider) {
  const events: ExplanationEvent[] = [];
  for await (const event of provider.streamExplanation({
    query: 'SENTINELA_QUERY',
    groundedOperations: [ollamaOperation],
    locale: 'pt-BR',
  })) events.push(event);
  return events;
}

describe('OLL-06 — bloqueios de egress no caminho de geração', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ['host remoto', 'https://example.com:11434', 'llama3.2:3b'],
    ['porta fora da allowlist', 'http://127.0.0.1:9999', 'llama3.2:3b'],
  ])('bloqueia %s antes de enviar contexto', async (_caseName, baseUrl, modelId) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const events = await consumePrivateGeneration(
      new OllamaLLMProvider({ baseUrl, modelId, privateMode: true }),
    );
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      code: 'PRIVACY_POLICY_VIOLATION',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('não segue redirect externo do endpoint allowlisted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('', { status: 302, headers: { Location: 'https://example.com/forward' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const events = await consumePrivateGeneration(new OllamaLLMProvider());
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      code: 'PRIVACY_POLICY_VIOLATION',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual');
    vi.unstubAllGlobals();
  });

  it('bloqueia modelo remoto/proxy validado por metadata antes de enviar contexto', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'proxy-model:latest', remote_host: 'https://cloud.example.com' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const events = await consumePrivateGeneration(
      new OllamaLLMProvider({ modelId: 'proxy-model:latest' }),
    );
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      code: 'PRIVACY_POLICY_VIOLATION',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tags');
    vi.unstubAllGlobals();
  });

  it('retorna erro específico se Ollama estiver indisponível, sem tentar outro destino', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);
    const events = await consumePrivateGeneration(new OllamaLLMProvider());
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      code: 'OLLAMA_UNAVAILABLE',
      recoverable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://127.0.0.1:11434/api/tags');
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/^https?:\/\/(?!127\.0\.0\.1)/);
  });
});

describe('Fase 10 — Evals de Privacidade, Segurança Adversarial e Latência', () => {
  it('10.06 — Executa suite de privacidade offline/air-gap e bloqueia todos os violadores', async () => {
    const report = await runPrivacyEvaluation();

    console.log('\n--- AIR-GAP PRIVACY EVALUATION REPORT ---');
    console.log(`Total checks:  ${report.totalChecks}`);
    console.log(`Passed checks: ${report.passedChecks}`);
    console.log(`All violations blocked: ${report.allViolationsBlocked}`);
    for (const r of report.results) {
      console.log(` - [${r.passed ? 'PASS' : 'FAIL'}] ${r.checkId}: ${r.name}`);
    }
    console.log('-----------------------------------------\n');

    expect(report.totalChecks).toBeGreaterThanOrEqual(5);
    expect(report.passedChecks).toBe(report.totalChecks);
    expect(report.allViolationsBlocked).toBe(true);
  });

  it('10.06 — Executa testes adversariais (prompt injection, overrides, secrets)', async () => {
    const report = await runAdversarialEvaluation();

    console.log('\n--- ADVERSARIAL EVALUATION REPORT ---');
    console.log(`Total checks:  ${report.totalChecks}`);
    console.log(`Passed checks: ${report.passedChecks}`);
    for (const r of report.results) {
      console.log(` - [${r.passed ? 'PASS' : 'FAIL'}] ${r.checkId}: ${r.name}`);
    }
    console.log('-------------------------------------\n');

    expect(report.totalChecks).toBeGreaterThanOrEqual(4);
    expect(report.passedChecks).toBe(report.totalChecks);
  });

  it('10.07 — Mede e registra baseline real de latência e consumo de memória', async () => {
    const report = await runLatencyBenchmark(10);

    console.log('\n--- SYSTEM LATENCY & MEMORY BASELINE ---');
    console.log(`Hardware: ${report.hardware.cpuModel} (${report.hardware.arch}), ${report.hardware.totalMemMb}MB RAM, Node ${report.hardware.nodeVersion}`);
    console.log(`Parse OpenAPI (50 ops):     p50=${report.metrics.openApiParse.p50Ms}ms, p95=${report.metrics.openApiParse.p95Ms}ms`);
    console.log(`Normalização (50 ops):      p50=${report.metrics.normalization.p50Ms}ms, p95=${report.metrics.normalization.p95Ms}ms`);
    console.log(`Classificação de intenção:  p50=${report.metrics.intentClassification.p50Ms}ms, p95=${report.metrics.intentClassification.p95Ms}ms`);
    console.log(`Indexação (50 ops FTS+Vec): p50=${report.metrics.indexing50Operations.p50Ms}ms, p95=${report.metrics.indexing50Operations.p95Ms}ms`);
    console.log(`Busca Híbrida:              p50=${report.metrics.hybridSearch.p50Ms}ms, p95=${report.metrics.hybridSearch.p95Ms}ms`);
    console.log(`Memória Heap Usada:         antes=${report.memory.indexing50Operations.heapUsedBeforeMb}MB, depois=${report.memory.indexing50Operations.heapUsedAfterMb}MB, delta=${report.memory.indexing50Operations.deltaHeapMb}MB`);
    console.log('----------------------------------------\n');

    expect(report.metrics.openApiParse.p50Ms).toBeGreaterThan(0);
    expect(report.metrics.hybridSearch.p50Ms).toBeGreaterThan(0);
    expect(report.hardware.arch).toBeDefined();

    // Salvar baseline no arquivo versionado
    const savedPath = await saveLatencyBaseline(report);
    expect(fs.existsSync(savedPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
    expect(content.metrics.openApiParse).toBeDefined();
  });
});
