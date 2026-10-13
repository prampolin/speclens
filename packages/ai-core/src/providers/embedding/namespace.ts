import { createHash } from 'node:crypto';
import type { EmbeddingSpaceSpec, VectorNamespaceKey } from '../types.js';
import { VectorNamespaceKeySchema } from '../schemas.js';
import { embeddingSpaceSpecSchema } from '@speclens/db';

/**
 * Generates a deterministic SHA-256 fingerprint for an EmbeddingSpaceSpec.
 * Any change to providerId, implementationVersion, modelId, modelRevision,
 * assetDigest, dimensions, pooling, normalize, preprocessingVersion,
 * operationTextVersion, or encodingVersion produces a distinct fingerprint.
 */
export function computeEmbeddingFingerprint(space: EmbeddingSpaceSpec): string {
  const validated = embeddingSpaceSpecSchema.parse(space);
  const payload = [
    `provider:${validated.providerId}`,
    `impl:${validated.implementationVersion}`,
    `model:${validated.modelId}`,
    `rev:${validated.modelRevision}`,
    `digest:${validated.assetDigest}`,
    `dim:${validated.dimensions}`,
    `pool:${validated.pooling}`,
    `norm:${validated.normalize ? '1' : '0'}`,
    `preproc:${validated.preprocessingVersion}`,
    `optext:${validated.operationTextVersion}`,
    `enc:${validated.encodingVersion}`,
  ].join('|');

  const hash = createHash('sha256').update(payload).digest('hex');
  return `emb_${validated.providerId}_${hash.slice(0, 32)}`;
}

/**
 * Checks whether two EmbeddingSpaceSpec configurations are strictly compatible.
 */
export function areEmbeddingSpacesCompatible(
  a: EmbeddingSpaceSpec,
  b: EmbeddingSpaceSpec
): boolean {
  return (
    a.providerId === b.providerId &&
    a.implementationVersion === b.implementationVersion &&
    a.modelId === b.modelId &&
    a.modelRevision === b.modelRevision &&
    a.assetDigest === b.assetDigest &&
    a.dimensions === b.dimensions &&
    a.pooling === b.pooling &&
    a.normalize === b.normalize &&
    a.preprocessingVersion === b.preprocessingVersion &&
    a.operationTextVersion === b.operationTextVersion &&
    a.encodingVersion === b.encodingVersion &&
    computeEmbeddingFingerprint(a) === computeEmbeddingFingerprint(b)
  );
}

/**
 * Generates a deterministic SHA-256 fingerprint for a vector namespace.
 * Guarantees that any change to workspace, spec, provider, implementation version,
 * model, revision, asset digest, dimensions, pooling, normalization, preprocessing,
 * operation-text version, encoding version, or chunking version produces a distinct namespace.
 */
export function namespaceId(key: VectorNamespaceKey): string {
  const validated = VectorNamespaceKeySchema.parse(key);

  const parts = [
    `workspace:${validated.workspaceId}`,
    `spec:${validated.specificationId}`,
    `provider:${validated.providerId}`,
    `model:${validated.modelId}`,
    `rev:${validated.modelRevision}`,
    `dim:${validated.dimensions}`,
    `chunking:${validated.chunkingVersion}`,
  ];

  if (validated.implementationVersion !== undefined) {
    parts.push(`impl:${validated.implementationVersion}`);
  }
  if (validated.assetDigest !== undefined) {
    parts.push(`digest:${validated.assetDigest}`);
  }
  if (validated.pooling !== undefined) {
    parts.push(`pool:${validated.pooling}`);
  }
  if (validated.normalize !== undefined) {
    parts.push(`norm:${validated.normalize ? '1' : '0'}`);
  }
  if (validated.preprocessingVersion !== undefined) {
    parts.push(`preproc:${validated.preprocessingVersion}`);
  }
  if (validated.operationTextVersion !== undefined) {
    parts.push(`optext:${validated.operationTextVersion}`);
  }
  if (validated.encodingVersion !== undefined) {
    parts.push(`enc:${validated.encodingVersion}`);
  }

  const payload = parts.join('|');
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
    a.chunkingVersion === b.chunkingVersion &&
    (a.implementationVersion ?? '1.0.0') === (b.implementationVersion ?? '1.0.0') &&
    (a.assetDigest ?? '') === (b.assetDigest ?? '') &&
    (a.pooling ?? 'mean') === (b.pooling ?? 'mean') &&
    (a.normalize ?? true) === (b.normalize ?? true) &&
    (a.preprocessingVersion ?? 'v1') === (b.preprocessingVersion ?? 'v1') &&
    (a.operationTextVersion ?? a.chunkingVersion) ===
      (b.operationTextVersion ?? b.chunkingVersion) &&
    (a.encodingVersion ?? 'float32_le_v1') === (b.encodingVersion ?? 'float32_le_v1')
  );
}
