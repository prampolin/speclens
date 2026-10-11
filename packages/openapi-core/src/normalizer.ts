import {
  HttpMethod,
  NormalizedMediaType,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedRequestBody,
  NormalizedResponse,
  NormalizedSecurityRequirement,
  NormalizedServer,
  ParsedDocument,
  RefResolverOptions,
  NormalizeOptions,
} from './types.js';
import { resolveRefs } from './ref-resolver.js';
import { getOperationSourcePointer } from './source-mapper.js';
import { NormalizedOperationSchema } from './schemas.js';
import { OpenAPIParseError } from './parser.js';

const VALID_HTTP_METHODS: Set<HttpMethod> = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
]);

/**
 * Extracts property names recursively from a JSON schema (for requestBody index terms)
 */
function extractSchemaFieldNames(schema: unknown, depth = 0): string[] {
  if (depth > 5 || !schema || typeof schema !== 'object') return [];
  const s = schema as Record<string, unknown>;
  const fields = new Set<string>();

  if (s.properties && typeof s.properties === 'object') {
    for (const [key, val] of Object.entries(s.properties as Record<string, unknown>)) {
      fields.add(key);
      const sub = extractSchemaFieldNames(val, depth + 1);
      for (const f of sub) fields.add(f);
    }
  }

  if (s.items && typeof s.items === 'object') {
    const sub = extractSchemaFieldNames(s.items, depth + 1);
    for (const f of sub) fields.add(f);
  }

  if (Array.isArray(s.allOf)) {
    for (const sub of s.allOf) {
      for (const f of extractSchemaFieldNames(sub, depth + 1)) fields.add(f);
    }
  }

  return Array.from(fields);
}

/**
 * Produces a dense, compact text representation of the operation for lexical (FTS5) and semantic retrieval.
 */
export function toIndexText(op: NormalizedOperation): string {
  const parts: string[] = [];

  // Core endpoint identification
  parts.push(`${op.method.toUpperCase()} ${op.path}`);

  if (op.operationId) {
    parts.push(`id: ${op.operationId}`);
  }

  if (op.summary) {
    parts.push(`summary: ${op.summary}`);
  }

  if (op.description) {
    parts.push(`description: ${op.description}`);
  }

  if (op.tags.length > 0) {
    parts.push(`tags: ${op.tags.join(', ')}`);
  }

  if (op.parameters.length > 0) {
    const paramStrings = op.parameters.map((p) => {
      const req = p.required ? 'required' : 'optional';
      const desc = p.description ? ` - ${p.description}` : '';
      return `${p.name} (${p.in}, ${req}${desc})`;
    });
    parts.push(`parameters: ${paramStrings.join('; ')}`);
  }

  if (op.requestBody) {
    const bodyFields = new Set<string>();
    for (const [, mediaType] of Object.entries(op.requestBody.content)) {
      if (mediaType.schema) {
        for (const field of extractSchemaFieldNames(mediaType.schema)) {
          bodyFields.add(field);
        }
      }
    }
    if (bodyFields.size > 0) {
      parts.push(`body fields: ${Array.from(bodyFields).join(', ')}`);
    }
  }

  const responseCodes = Object.keys(op.responses);
  if (responseCodes.length > 0) {
    const resSummaries = responseCodes.map((code) => {
      const res = op.responses[code];
      return `${code} ${res.description || ''}`.trim();
    });
    parts.push(`responses: ${resSummaries.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Normalizes an OpenAPI 3.x or Swagger 2.0 document into a list of canonical NormalizedOperation entities.
 */
export function normalizeDocument(
  parsedDoc: ParsedDocument,
  specId: string,
  options: NormalizeOptions = {}
): NormalizedOperation[] {
  const maxOperations = options.maxOperations ?? 5000;

  // 1. Resolve references safely
  const resolvedRaw = resolveRefs<Record<string, unknown>>(parsedDoc.raw, options);

  const dialect = parsedDoc.dialect;
  const docServers = parsedDoc.servers;
  const docSecurity = Array.isArray(resolvedRaw.security)
    ? (resolvedRaw.security as NormalizedSecurityRequirement[])
    : undefined;

  const docConsumes: string[] = Array.isArray(resolvedRaw.consumes)
    ? (resolvedRaw.consumes as string[])
    : ['application/json'];
  const docProduces: string[] = Array.isArray(resolvedRaw.produces)
    ? (resolvedRaw.produces as string[])
    : ['application/json'];

  const pathsObj = resolvedRaw.paths;
  if (!pathsObj || typeof pathsObj !== 'object') {
    return [];
  }

  const operations: NormalizedOperation[] = [];

  for (const [pathStr, pathItemVal] of Object.entries(pathsObj as Record<string, unknown>)) {
    if (!pathItemVal || typeof pathItemVal !== 'object') continue;
    const pathItem = pathItemVal as Record<string, unknown>;

    // Path-level servers (OpenAPI 3.x)
    const pathServers: NormalizedServer[] = Array.isArray(pathItem.servers)
      ? pathItem.servers
          .filter((s) => s && typeof s === 'object' && typeof s.url === 'string')
          .map((s) => ({
            url: s.url,
            description: typeof s.description === 'string' ? s.description : undefined,
          }))
      : [];

    const effectiveBaseServers = pathServers.length > 0 ? pathServers : docServers;

    // Path-level parameters
    const pathLevelParameters: unknown[] = Array.isArray(pathItem.parameters)
      ? pathItem.parameters
      : [];

    for (const [key, opItemVal] of Object.entries(pathItem)) {
      const lowerKey = key.toLowerCase() as HttpMethod;
      if (!VALID_HTTP_METHODS.has(lowerKey)) continue;
      if (!opItemVal || typeof opItemVal !== 'object') continue;

      const opItem = opItemVal as Record<string, unknown>;

      // Operation-level servers
      const opServers: NormalizedServer[] = Array.isArray(opItem.servers)
        ? opItem.servers
            .filter((s) => s && typeof s === 'object' && typeof s.url === 'string')
            .map((s) => ({
              url: s.url,
              description: typeof s.description === 'string' ? s.description : undefined,
            }))
        : effectiveBaseServers;

      // Merge parameters (operation-level overrides path-level with same name + in)
      const opParameters: unknown[] = Array.isArray(opItem.parameters)
        ? opItem.parameters
        : [];

      const rawParams = [...pathLevelParameters, ...opParameters];
      const paramMap = new Map<string, NormalizedParameter>();

      let convertedRequestBody: NormalizedRequestBody | undefined;

      // In Swagger 2.0, operation consumes/produces can override root
      const opConsumes: string[] = Array.isArray(opItem.consumes)
        ? (opItem.consumes as string[])
        : docConsumes;
      const opProduces: string[] = Array.isArray(opItem.produces)
        ? (opItem.produces as string[])
        : docProduces;

      for (const p of rawParams) {
        if (!p || typeof p !== 'object') continue;
        const paramObj = p as Record<string, unknown>;
        const paramName = String(paramObj.name || '');
        const paramIn = String(paramObj.in || '').toLowerCase();

        // Special handling for Swagger 2.0 in: "body"
        if (dialect === 'swagger-2.0' && paramIn === 'body') {
          const contentMap: Record<string, NormalizedMediaType> = {};
          for (const mediaType of opConsumes) {
            contentMap[mediaType] = {
              schema: (paramObj.schema as Record<string, unknown>) || undefined,
            };
          }
          convertedRequestBody = {
            description: typeof paramObj.description === 'string' ? paramObj.description : undefined,
            required: Boolean(paramObj.required),
            content: contentMap,
          };
          continue;
        }

        // Special handling for Swagger 2.0 in: "formData"
        if (dialect === 'swagger-2.0' && paramIn === 'formdata') {
          const mediaType = 'multipart/form-data';
          if (!convertedRequestBody) {
            convertedRequestBody = {
              required: false,
              content: { [mediaType]: { schema: { type: 'object', properties: {} } } },
            };
          }
          const bodySchema = convertedRequestBody.content[mediaType]?.schema as Record<string, any>;
          if (bodySchema && bodySchema.properties) {
            bodySchema.properties[paramName] = {
              type: paramObj.type || 'string',
              description: paramObj.description,
            };
            if (paramObj.required) {
              bodySchema.required = bodySchema.required || [];
              bodySchema.required.push(paramName);
              convertedRequestBody.required = true;
            }
          }
          continue;
        }

        if (
          paramIn === 'path' ||
          paramIn === 'query' ||
          paramIn === 'header' ||
          paramIn === 'cookie'
        ) {
          const key = `${paramIn}:${paramName.toLowerCase()}`;
          const isRequired = paramIn === 'path' ? true : Boolean(paramObj.required);

          // In Swagger 2.0, schema properties like type, format are directly on parameter
          let paramSchema = paramObj.schema as Record<string, unknown> | undefined;
          if (!paramSchema && paramObj.type) {
            paramSchema = {
              type: paramObj.type,
              format: paramObj.format,
              items: paramObj.items,
              enum: paramObj.enum,
              default: paramObj.default,
            };
          }

          paramMap.set(key, {
            name: paramName,
            in: paramIn,
            required: isRequired,
            description: typeof paramObj.description === 'string' ? paramObj.description : undefined,
            deprecated: Boolean(paramObj.deprecated),
            schema: paramSchema,
            example: paramObj.example,
          });
        }
      }

      const parameters: NormalizedParameter[] = Array.from(paramMap.values());

      // Parse requestBody (OpenAPI 3.x)
      let requestBody: NormalizedRequestBody | undefined = convertedRequestBody;

      if (opItem.requestBody && typeof opItem.requestBody === 'object') {
        const rbObj = opItem.requestBody as Record<string, unknown>;
        const contentMap: Record<string, NormalizedMediaType> = {};

        if (rbObj.content && typeof rbObj.content === 'object') {
          for (const [mtKey, mtVal] of Object.entries(rbObj.content as Record<string, unknown>)) {
            if (!mtVal || typeof mtVal !== 'object') continue;
            const mtObj = mtVal as Record<string, unknown>;
            contentMap[mtKey] = {
              schema: mtObj.schema as Record<string, unknown> | undefined,
              example: mtObj.example,
            };
          }
        }

        requestBody = {
          description: typeof rbObj.description === 'string' ? rbObj.description : undefined,
          required: Boolean(rbObj.required),
          content: contentMap,
        };
      }

      // Parse responses
      const responses: Record<string, NormalizedResponse> = {};

      if (opItem.responses && typeof opItem.responses === 'object') {
        for (const [statusCode, resVal] of Object.entries(
          opItem.responses as Record<string, unknown>
        )) {
          if (!resVal || typeof resVal !== 'object') continue;
          const resObj = resVal as Record<string, unknown>;
          const description = typeof resObj.description === 'string' ? resObj.description : '';

          const contentMap: Record<string, NormalizedMediaType> = {};

          if (dialect === 'swagger-2.0') {
            if (resObj.schema) {
              for (const mediaType of opProduces) {
                contentMap[mediaType] = {
                  schema: resObj.schema as Record<string, unknown>,
                };
              }
            }
          } else if (resObj.content && typeof resObj.content === 'object') {
            for (const [mtKey, mtVal] of Object.entries(resObj.content as Record<string, unknown>)) {
              if (!mtVal || typeof mtVal !== 'object') continue;
              const mtObj = mtVal as Record<string, unknown>;
              contentMap[mtKey] = {
                schema: mtObj.schema as Record<string, unknown> | undefined,
                example: mtObj.example,
              };
            }
          }

          responses[statusCode] = {
            description,
            content: Object.keys(contentMap).length > 0 ? contentMap : undefined,
          };
        }
      }

      // Security
      let security: NormalizedSecurityRequirement[] | undefined;
      if (Array.isArray(opItem.security)) {
        security = opItem.security as NormalizedSecurityRequirement[];
      } else if (docSecurity) {
        security = docSecurity;
      }

      // Tags
      const tags: string[] = Array.isArray(opItem.tags)
        ? (opItem.tags as string[]).map(String)
        : [];

      // Stable ID: {specId}:{method}:{path}
      const canonicalPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
      const stableId = `${specId}:${lowerKey}:${canonicalPath.toLowerCase()}`;
      const sourcePointer = getOperationSourcePointer(pathStr, lowerKey);

      const normalizedOp: NormalizedOperation = {
        id: stableId,
        specId,
        method: lowerKey,
        path: canonicalPath,
        operationId: typeof opItem.operationId === 'string' ? opItem.operationId : undefined,
        summary: typeof opItem.summary === 'string' ? opItem.summary : undefined,
        description: typeof opItem.description === 'string' ? opItem.description : undefined,
        tags,
        servers: opServers,
        parameters,
        requestBody,
        responses,
        security,
        deprecated: Boolean(opItem.deprecated),
        sourcePointer,
      };

      normalizedOp.indexText = toIndexText(normalizedOp);

      // Validate through Zod to guarantee strict conformance
      NormalizedOperationSchema.parse(normalizedOp);

      if (operations.length >= maxOperations) {
        throw new OpenAPIParseError(
          `Document exceeds maximum operation limit of ${maxOperations} operations`,
          'MAX_OPERATIONS_EXCEEDED',
          { maxOperations, specId }
        );
      }

      operations.push(normalizedOp);
    }
  }

  return operations;
}
