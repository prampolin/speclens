import { describe, it, expect } from 'vitest';
import {
  runPrivacyEvaluation,
  runAdversarialEvaluation,
  runLatencyBenchmark,
  saveLatencyBaseline,
} from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

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
