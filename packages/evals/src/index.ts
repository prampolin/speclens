import type { ResponseEnvelope } from '@speclens/ai-core';

export interface EvalTestCase {
  id: string;
  query: string;
  expectedOperationId?: string;
  expectedMethod?: string;
  expectedPath?: string;
  locale: 'pt-BR' | 'en-US';
}

export interface EvalResult {
  testCaseId: string;
  passed: boolean;
  score: number;
  durationMs: number;
  response?: ResponseEnvelope;
  errors?: string[];
}

export interface EvalReport {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  accuracy: number;
  meanDurationMs: number;
  results: EvalResult[];
}

export * from './retrieval-eval.js';
