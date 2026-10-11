import type { ProviderManifest } from '../types.js';
import { PrivacyViolationError } from '../providers/errors.js';

export { PrivacyViolationError };

const ALLOWED_LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export interface PrivateModeSettingsLike {
  privateMode?: boolean;
  [key: string]: unknown;
}

export interface ProviderLike {
  manifest: ProviderManifest;
  endpointUrl?: string;
  [key: string]: unknown;
}

/**
 * Validates that a provider complies with fail-closed Private Mode constraints.
 * Fails closed: if settings.privateMode is undefined, treats as true.
 *
 * Throws PrivacyViolationError if:
 * - provider executionLocation !== 'local'
 * - provider requiresNetwork === true
 * - provider supportsOffline === false
 * - provider endpointUrl is not on loopback allowlist
 */
export function assertPrivateMode(
  settings: PrivateModeSettingsLike | undefined,
  providerOrManifest: ProviderLike | ProviderManifest
): void {
  const isPrivate = settings?.privateMode !== false; // Default fail-closed to true
  const manifest = 'manifest' in providerOrManifest ? providerOrManifest.manifest : providerOrManifest;

  if (!isPrivate) {
    return;
  }

  if (manifest.executionLocation !== 'local') {
    throw new PrivacyViolationError(
      `Provider "${manifest.id}" cannot execute in private mode: executionLocation is "${manifest.executionLocation}" (must be "local").`
    );
  }

  if (manifest.requiresNetwork) {
    throw new PrivacyViolationError(
      `Provider "${manifest.id}" is forbidden in private mode: requiresNetwork is true.`
    );
  }

  if (!manifest.supportsOffline) {
    throw new PrivacyViolationError(
      `Provider "${manifest.id}" is forbidden in private mode: supportsOffline is false.`
    );
  }

  // If provider has an endpoint URL configured, verify loopback allowlist
  const endpoint = 'endpointUrl' in providerOrManifest && typeof providerOrManifest.endpointUrl === 'string'
    ? providerOrManifest.endpointUrl
    : undefined;

  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      const host = parsed.hostname.toLowerCase();
      if (!ALLOWED_LOOPBACK_HOSTS.has(host)) {
        throw new PrivacyViolationError(
          `Provider "${manifest.id}" endpoint host "${host}" is not on loopback allowlist in private mode.`
        );
      }
    } catch (urlErr) {
      if (urlErr instanceof PrivacyViolationError) {
        throw urlErr;
      }
      throw new PrivacyViolationError(
        `Provider "${manifest.id}" contains an invalid endpoint URL: "${endpoint}".`
      );
    }
  }
}

/**
 * Reusable helper ensuring a provider operates strictly locally under workspace settings.
 */
export function assertLocalProvider(
  provider: ProviderLike | ProviderManifest,
  settings?: PrivateModeSettingsLike
): void {
  assertPrivateMode(settings, provider);
}
