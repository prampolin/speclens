export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head'
  | 'trace';

export type ParameterIn = 'path' | 'query' | 'header' | 'cookie';
export type ParameterLocation = ParameterIn;

export type OpenAPIDialect = 'openapi-3.0' | 'openapi-3.1' | 'swagger-2.0' | 'unknown' | 'swagger_2' | 'openapi_3_0' | 'openapi_3_1';

export interface NormalizedServer {
  url: string;
  description?: string;
}

export interface NormalizedExample {
  summary?: string;
  description?: string;
  value?: unknown;
}

export interface NormalizedParameter {
  name: string;
  in: ParameterIn;
  required: boolean;
  description?: string;
  deprecated?: boolean;
  schema?: Record<string, unknown>;
  example?: unknown;
  examples?: Record<string, NormalizedExample>;
}

export interface NormalizedMediaType {
  schema?: Record<string, unknown>;
  example?: unknown;
  examples?: Record<string, NormalizedExample>;
}

export interface NormalizedRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, NormalizedMediaType>;
}

export interface NormalizedResponse {
  description: string;
  headers?: Record<string, Record<string, unknown>>;
  content?: Record<string, NormalizedMediaType>;
}

export type NormalizedSecurityRequirement = Record<string, string[]>;

export interface NormalizedOperation {
  id: string; // {specId}:{method}:{path}
  specId: string;
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  servers: NormalizedServer[];
  parameters: NormalizedParameter[];
  requestBody?: NormalizedRequestBody;
  responses: Record<string, NormalizedResponse>;
  security?: NormalizedSecurityRequirement[];
  deprecated?: boolean;
  sourcePointer: string;
  indexText?: string;
}

export interface SpecificationSummary {
  id: string;
  workspaceId: string;
  title: string;
  version: string;
  dialect: OpenAPIDialect;
  sourceChecksum: string;
  operationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OpenAPIDocumentInfo {
  title: string;
  version: string;
  description?: string;
}

export interface ParsedDocument {
  dialect: OpenAPIDialect;
  info: OpenAPIDocumentInfo;
  servers: NormalizedServer[];
  raw: Record<string, unknown>;
  warnings: string[];
}

export interface ParseOptions {
  maxSizeBytes?: number;
  filename?: string;
  parseTimeoutMs?: number;
}

export interface RefResolverOptions {
  privateMode?: boolean;
  maxDepth?: number;
  onWarning?: (warning: string) => void;
}

export interface NormalizeOptions extends RefResolverOptions {
  maxOperations?: number;
}
