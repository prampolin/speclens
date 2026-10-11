import type { NormalizedOperation } from '@speclens/openapi-core';
import type { CodeSnippet } from '@speclens/ai-core';

export type SupportedLanguage = 'curl' | 'javascript' | 'python';

export interface CodegenOptions {
  language: SupportedLanguage;
  serverUrl?: string;
}

export interface CodeGenerator {
  generate(operation: NormalizedOperation, options: CodegenOptions): Promise<CodeSnippet>;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['curl', 'javascript', 'python'];
