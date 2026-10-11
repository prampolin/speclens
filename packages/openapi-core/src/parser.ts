import yaml from 'yaml';
import { OpenAPIDialect, ParsedDocument, ParseOptions } from './types.js';
import { MinimalDocumentSchema } from './schemas.js';

export class OpenAPIParseError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: unknown) {
    super(message);
    this.name = 'OpenAPIParseError';
  }
}

export function detectDialect(doc: Record<string, unknown>): OpenAPIDialect {
  if (typeof doc.openapi === 'string') {
    if (doc.openapi.startsWith('3.0')) return 'openapi-3.0';
    if (doc.openapi.startsWith('3.1')) return 'openapi-3.1';
    return 'openapi-3.0'; // Default 3.x
  }
  if (typeof doc.swagger === 'string' && doc.swagger.startsWith('2.0')) {
    return 'swagger-2.0';
  }
  return 'unknown';
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_PARSE_TIMEOUT_MS = 30000; // 30s

/**
 * Parses and validates an OpenAPI / Swagger document from string or Buffer (JSON or YAML).
 */
export function parseOpenAPIDocument(
  content: string | Buffer,
  options: ParseOptions = {}
): ParsedDocument {
  const startTime = Date.now();
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const timeoutMs = options.parseTimeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS;
  const filename = options.filename ?? 'document';

  const byteLength = Buffer.isBuffer(content)
    ? content.length
    : Buffer.byteLength(content, 'utf8');

  if (byteLength > maxSizeBytes) {
    throw new OpenAPIParseError(
      `File size (${byteLength} bytes) exceeds limit of ${maxSizeBytes} bytes`,
      'FILE_TOO_LARGE',
      { size: byteLength, limit: maxSizeBytes, filename }
    );
  }

  const rawString = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  const trimmed = rawString.trim();

  if (!trimmed) {
    throw new OpenAPIParseError(
      `Document "${filename}" is empty`,
      'EMPTY_DOCUMENT',
      { filename }
    );
  }

  let parsed: unknown;

  // Try JSON first if it starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      parsed = JSON.parse(rawString);
    } catch (jsonErr: any) {
      // Fallback to YAML parse in case JSON formatting had minor YAML compatibility or report error
      try {
        parsed = yaml.parse(rawString);
      } catch {
        throw new OpenAPIParseError(
          `Failed to parse JSON in "${filename}": ${jsonErr.message}`,
          'INVALID_JSON',
          { originalError: jsonErr.message }
        );
      }
    }
  } else {
    try {
      parsed = yaml.parse(rawString);
    } catch (yamlErr: any) {
      throw new OpenAPIParseError(
        `Failed to parse YAML in "${filename}": ${yamlErr.message}`,
        'INVALID_YAML',
        { originalError: yamlErr.message }
      );
    }
  }

  if (Date.now() - startTime > timeoutMs) {
    throw new OpenAPIParseError(
      `OpenAPI parsing exceeded timeout limit of ${timeoutMs}ms`,
      'PARSE_TIMEOUT',
      { elapsedMs: Date.now() - startTime, limitMs: timeoutMs }
    );
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new OpenAPIParseError(
      `Invalid OpenAPI document format in "${filename}": expected an object at root`,
      'INVALID_ROOT_TYPE'
    );
  }

  const doc = parsed as Record<string, unknown>;
  const dialect = detectDialect(doc);

  if (dialect === 'unknown') {
    throw new OpenAPIParseError(
      `Unsupported or missing OpenAPI/Swagger version in "${filename}". Expected "openapi: 3.x" or "swagger: 2.0"`,
      'UNSUPPORTED_DIALECT',
      { openapi: doc.openapi, swagger: doc.swagger }
    );
  }

  const validationResult = MinimalDocumentSchema.safeParse(doc);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors
      .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
      .join('; ');
    throw new OpenAPIParseError(
      `Validation error in "${filename}": ${errorMessages}`,
      'SCHEMA_VALIDATION_FAILED',
      validationResult.error.errors
    );
  }

  const warnings: string[] = [];

  // Parse servers or Swagger 2.0 host/basePath/schemes
  const servers: Array<{ url: string; description?: string }> = [];

  if (dialect === 'swagger-2.0') {
    const host = typeof doc.host === 'string' ? doc.host : 'localhost';
    const basePath = typeof doc.basePath === 'string' ? doc.basePath : '';
    const schemes = Array.isArray(doc.schemes) ? (doc.schemes as string[]) : ['https'];

    for (const scheme of schemes) {
      const cleanBasePath = basePath.startsWith('/') ? basePath : basePath ? `/${basePath}` : '';
      servers.push({
        url: `${scheme}://${host}${cleanBasePath}`.replace(/\/+$/, '') || '/',
      });
    }
  } else if (Array.isArray(doc.servers) && doc.servers.length > 0) {
    for (const s of doc.servers) {
      if (s && typeof s === 'object' && typeof s.url === 'string') {
        servers.push({
          url: s.url,
          description: typeof s.description === 'string' ? s.description : undefined,
        });
      }
    }
  }

  if (servers.length === 0) {
    servers.push({ url: '/' });
  }

  return {
    dialect,
    info: {
      title: validationResult.data.info.title,
      version: validationResult.data.info.version,
      description: validationResult.data.info.description,
    },
    servers,
    raw: doc,
    warnings,
  };
}
