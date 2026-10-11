import type {
  NormalizedOperation,
  ProviderManifest,
  ProviderReadiness,
  SourceCitation,
  CodeSnippet,
  ResponseEnvelope,
} from '../types.js';

export type {
  NormalizedOperation,
  ProviderManifest,
  ProviderReadiness,
  SourceCitation,
  CodeSnippet,
  ResponseEnvelope,
};

export type OperationSource = SourceCitation;

export type ExplanationEvent =
  | { type: 'status'; stage: string; message: string }
  | { type: 'token'; token: string; content?: string }
  | { type: 'sources'; sources: SourceCitation[] }
  | { type: 'snippets'; snippets: CodeSnippet[] }
  | { type: 'final'; envelope: ResponseEnvelope; response?: ResponseEnvelope }
  | { type: 'error'; code: string; message: string; recoverable: boolean; retryable?: boolean };

export interface StreamExplanationInput {
  query: string;
  groundedOperations: NormalizedOperation[];
  locale: 'pt-BR' | 'en-US';
}

export interface LLMProvider {
  manifest: ProviderManifest;
  streamExplanation(
    input: StreamExplanationInput,
    signal?: AbortSignal,
  ): AsyncIterable<ExplanationEvent>;
  readiness(): Promise<ProviderReadiness>;
}

export interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
  remote_host?: string;
}

export interface OllamaModelInfo {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
  parent_model?: string;
  remote_host?: string;
}

export interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

export interface OllamaStreamChunk {
  model?: string;
  created_at?: string;
  message?: {
    role: string;
    content: string;
  };
  response?: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaProviderConfig {
  baseUrl?: string;
  modelId?: string;
  privateMode?: boolean;
  allowedBaseUrls?: string[];
  timeoutMs?: number;
  implementationVersion?: string;
}
