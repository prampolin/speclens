import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runRetrievalEvaluation } from '../src/retrieval-eval.js';

describe('Fase 05 — Retrieval Evaluation Suite', () => {
  it('05.06 — executa dataset mínimo e valida recall@5 >= 0.6, gerando baseline', async () => {
    const suiteResult = await runRetrievalEvaluation();

    const { metrics, results } = suiteResult;

    // Log metrics
    console.log('\n--- RETRIEVAL EVALUATION METRICS ---');
    console.log(`Total questions: ${metrics.totalQuestions}`);
    console.log(`Top-1 Accuracy:  ${(metrics.top1Accuracy * 100).toFixed(1)}%`);
    console.log(`Recall@1:        ${(metrics.recallAt1 * 100).toFixed(1)}%`);
    console.log(`Recall@3:        ${(metrics.recallAt3 * 100).toFixed(1)}%`);
    console.log(`Recall@5:        ${(metrics.recallAt5 * 100).toFixed(1)}%`);
    console.log(`MRR:             ${metrics.mrr.toFixed(3)}`);
    console.log(`Duration:        ${metrics.durationMs}ms`);
    console.log('------------------------------------\n');

    // Save baseline file
    const baselineDir = resolve(process.cwd(), 'packages/evals/baselines');
    mkdirSync(baselineDir, { recursive: true });
    const baselinePath = resolve(baselineDir, 'retrieval-baseline.json');
    writeFileSync(baselinePath, JSON.stringify(suiteResult, null, 2), 'utf8');

    // Assertions required by Phase 05:
    // recall@5 >= 0.6
    expect(metrics.recallAt5).toBeGreaterThanOrEqual(0.6);
    expect(metrics.totalQuestions).toBe(10);
    expect(results).toHaveLength(10);
    expect(metrics.mrr).toBeGreaterThan(0.5);
  });
});
