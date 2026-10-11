export type OpenAPIDialect = 'swagger_2' | 'openapi_3_0' | 'openapi_3_1';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'TRACE';

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface NormalizedParameter {
  name: string;
  in: ParameterLocation;
  description?: string;
  required: boolean;
  deprecated?: boolean;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface NormalizedRequestBody {
  description?: string;
  required: boolean;
  mediaType: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface NormalizedResponseMediaType {
  mediaType: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface NormalizedResponse {
  statusCode: string;
  description: string;
  mediaTypes?: NormalizedResponseMediaType[];
}

export interface NormalizedSecurityRequirement {
  schemeName: string;
  scopes: string[];
}

export interface NormalizedOperation {
  id: string;
  specificationId: string;
  method: HttpMethod | string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  servers: string[];
  parameters: NormalizedParameter[];
  requestBodies: NormalizedRequestBody[];
  responses: NormalizedResponse[];
  security: NormalizedSecurityRequirement[];
  sourcePointer: string;
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
