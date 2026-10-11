import { createHash } from 'node:crypto';
import { VectorNamespaceKey } from '../types.js';
import { VectorNamespaceKeySchema } from '../schemas.js';

/**
 * Generates a deterministic SHA-256 fingerprint for a vector namespace.
 * Guarantees that any change to workspace, spec, provider, model, revision,
 * dimensions, or chunking version produces a distinct namespace.
 */
export function namespaceId(key: VectorNamespaceKey): string {
  const validated = VectorNamespaceKeySchema.parse(key);

  const payload = [
    `workspace:${validated.workspaceId}`,
    `spec:${validated.specificationId}`,
    `provider:${validated.providerId}`,
    `model:${validated.modelId}`,
    `rev:${validated.modelRevision}`,
    `dim:${validated.dimensions}`,
    `chunking:${validated.chunkingVersion}`,
  ].join('|');

  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 32);
  return `ns_${validated.providerId}_${hash}`;
}

/**
 * Validates whether two namespace keys represent compatible vector spaces.
 * Embeddings from different spaces must NEVER be compared.
 */
export function areNamespacesCompatible(
  a: VectorNamespaceKey,
  b: VectorNamespaceKey
): boolean {
  return (
    a.providerId === b.providerId &&
    a.modelId === b.modelId &&
    a.modelRevision === b.modelRevision &&
    a.dimensions === b.dimensions &&
    a.chunkingVersion === b.chunkingVersion
  );
}
