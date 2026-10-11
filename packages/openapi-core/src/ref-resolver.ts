import { RefResolverOptions } from './types.js';
import { getValueAtPointer } from './source-mapper.js';

export class RefResolutionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'RefResolutionError';
  }
}

export function isRemoteRef(ref: string): boolean {
  return (
    ref.startsWith('http://') ||
    ref.startsWith('https://') ||
    ref.startsWith('//') ||
    (!ref.startsWith('#') && (ref.includes('://') || ref.endsWith('.json') || ref.endsWith('.yaml') || ref.endsWith('.yml')))
  );
}

/**
 * Safely resolves $ref references within a document.
 * In privateMode (default true), remote references (HTTP/HTTPS/external) are strictly forbidden.
 * Circular references are caught and broken to prevent infinite recursion.
 */
export function resolveRefs<T = unknown>(
  rootDoc: Record<string, unknown>,
  options: RefResolverOptions = {}
): T {
  const {
    privateMode = true,
    maxDepth = 20,
    onWarning = (msg: string) => console.warn(`[OpenAPI RefResolver] ${msg}`),
  } = options;

  function traverse(
    node: unknown,
    depth: number,
    activeStack: Set<string>
  ): unknown {
    if (depth > maxDepth) {
      onWarning(`Max recursion depth (${maxDepth}) reached during $ref resolution`);
      return { $refCycle: 'max-depth-reached', type: 'object' };
    }

    if (node === null || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item) => traverse(item, depth, activeStack));
    }

    const obj = node as Record<string, unknown>;

    // Check if this object is a $ref
    if (typeof obj.$ref === 'string') {
      const ref = obj.$ref;

      if (isRemoteRef(ref)) {
        if (privateMode) {
          throw new RefResolutionError(
            `Remote reference "${ref}" is rejected because privateMode=true. Local references only.`,
            'REMOTE_REF_FORBIDDEN'
          );
        } else {
          onWarning(`Remote reference "${ref}" skipped in resolver.`);
          return obj;
        }
      }

      if (!ref.startsWith('#/')) {
        onWarning(`Unrecognized reference format: "${ref}". Expected local pointer starting with "#/"`);
        return obj;
      }

      // Check circular reference
      if (activeStack.has(ref)) {
        return {
          $refCycle: ref,
          type: 'object',
          description: `Circular reference to ${ref}`,
        };
      }

      // Resolve local pointer
      const target = getValueAtPointer(rootDoc, ref);
      if (target === undefined) {
        onWarning(`Unresolved local reference: "${ref}" could not be found in document`);
        return obj;
      }

      const nextStack = new Set(activeStack);
      nextStack.add(ref);

      const resolvedTarget = traverse(target, depth + 1, nextStack);

      // Preserve any sibling properties on the referencing object (e.g. description override in OpenAPI 3.1)
      if (resolvedTarget && typeof resolvedTarget === 'object' && !Array.isArray(resolvedTarget)) {
        const result: Record<string, unknown> = { ...(resolvedTarget as Record<string, unknown>) };
        for (const [key, val] of Object.entries(obj)) {
          if (key !== '$ref') {
            result[key] = traverse(val, depth + 1, nextStack);
          }
        }
        return result;
      }

      return resolvedTarget;
    }

    // Traverse object properties
    const result: Record<string, unknown> = {};

    // Explicitly handle allOf / oneOf / anyOf composition if present
    if (Array.isArray(obj.allOf)) {
      result.allOf = obj.allOf.map((sub) => traverse(sub, depth + 1, activeStack));
    }
    if (Array.isArray(obj.oneOf)) {
      result.oneOf = obj.oneOf.map((sub) => traverse(sub, depth + 1, activeStack));
    }
    if (Array.isArray(obj.anyOf)) {
      result.anyOf = obj.anyOf.map((sub) => traverse(sub, depth + 1, activeStack));
    }

    for (const [key, val] of Object.entries(obj)) {
      if (key === 'allOf' || key === 'oneOf' || key === 'anyOf') continue;
      result[key] = traverse(val, depth, activeStack);
    }

    return result;
  }

  return traverse(rootDoc, 0, new Set()) as T;
}
