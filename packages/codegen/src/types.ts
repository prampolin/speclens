import type { NormalizedOperation } from '@speclens/openapi-core';
import type { CodeSnippet } from '@speclens/ai-core';

export type SupportedLanguage = 'curl' | 'javascript' | 'python';

export type AuthType = 'bearer' | 'apiKey' | 'basic' | 'unknown';

export interface Param {
  name: string;
  value: string;
  required: boolean;
  isPlaceholder: boolean;
}

export interface BodyModel {
  schema?: Record<string, unknown>;
  example: Record<string, unknown>;
  unknownFields: string[];
}

export interface AuthModel {
  type: AuthType;
  placeholder: string;
  headerName?: string;
}

export interface RequestModel {
  method: string;
  url: string;
  queryParams: Param[];
  headers: Param[];
  body: BodyModel | null;
  contentType: string | null;
  auth: AuthModel | null;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export interface CodegenRequest {
  operation: NormalizedOperation;
  languages: SupportedLanguage[];
  groundedValues?: Record<string, unknown>;
  baseUrl?: string;
}

export interface CodegenResult {
  snippets: CodeSnippet[];
  requestModel: RequestModel;
}

export interface CodegenOptions {
  language: SupportedLanguage;
  serverUrl?: string;
  baseUrl?: string;
  groundedValues?: Record<string, unknown>;
}

export interface CodeGenerator {
  generate(operation: NormalizedOperation, options: CodegenOptions): Promise<CodeSnippet>;
}

export type Placeholder = `<REQUIRED_${string}>` | string;
