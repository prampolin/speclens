const SENSITIVE_KEY_PATTERNS = [
  /^authorization$/i,
  /^api[_-]?key$/i,
  /^x-api-key$/i,
  /^token$/i,
  /^access[_-]?token$/i,
  /^refresh[_-]?token$/i,
  /^password$/i,
  /^passphrase$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^secret$/i,
  /^client[_-]?secret$/i,
  /^private[_-]?key$/i,
  /^bearer$/i,
  /^session[_-]?token$/i,
];

// Preserved operational fields that must never be redacted even if they match substring
const PRESERVED_OPERATIONAL_KEYS = new Set([
  'method',
  'path',
  'operationId',
  'operationid',
  'operation_id',
  'tags',
  'status',
  'statusCode',
  'status_code',
  'code',
  'query',
  'locale',
  'specificationId',
  'workspaceId',
  'timestamp',
]);

/**
 * Checks whether a property or header key is considered sensitive.
 */
export function isSensitiveKey(key: string): boolean {
  if (PRESERVED_OPERATIONAL_KEYS.has(key)) {
    return false;
  }
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

const BEARER_OR_AUTH_STRING_REGEX = /^(Bearer\s+|Basic\s+|Token\s+).+$/i;

/**
 * Recursively redacts sensitive keys and values from objects, arrays, or strings.
 * Safe for JSON serialization and logging.
 */
export function redactSensitive(obj: unknown, seen = new WeakSet<object>()): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact header strings like "Bearer xyz123"
    if (BEARER_OR_AUTH_STRING_REGEX.test(obj.trim())) {
      return '[REDACTED]';
    }
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj as object)) {
    return '[CIRCULAR]';
  }
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, seen));
  }

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: redactSensitive(obj.message, seen),
      stack: obj.stack ? redactSensitive(obj.stack, seen) : undefined,
    };
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitive(value, seen);
    }
  }

  return result;
}
