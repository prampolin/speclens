import type { OllamaModelInfo } from './types.js';

import { PrivacyViolationError } from '../providers/errors.js';
export { PrivacyViolationError };

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const CLOUD_MODEL_PREFIXES = [
  'cloud/',
  'remote/',
  'openai/',
  'anthropic/',
  'claude/',
  'gemini/',
  'azure/',
  'bedrock/',
  'cohere/',
  'mistral-cloud/',
];

/**
 * Validates that an Ollama service URL complies with Privacy Mode rules.
 * Throws PrivacyViolationError when violating local privacy boundaries.
 */
export function validateOllamaUrl(
  url: string,
  privateMode: boolean,
  allowedUrls: string[] = ['http://127.0.0.1:11434', 'http://localhost:11434'],
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PrivacyViolationError(`Invalid URL provided: "${url}"`);
  }

  if (privateMode) {
    const hostname = parsed.hostname.toLowerCase();
    const isLoopback = LOOPBACK_HOSTNAMES.has(hostname);

    if (!isLoopback) {
      throw new PrivacyViolationError(
        `[PrivateMode] Denied: Non-loopback host "${hostname}" is forbidden in private mode.`,
      );
    }

    const cleanInputUrl = url.replace(/\/+$/, '');
    const cleanOrigin = parsed.origin.replace(/\/+$/, '');
    const isAllowed = allowedUrls.some((allowed) => {
      const cleanAllowed = allowed.replace(/\/+$/, '');
      return cleanInputUrl === cleanAllowed || cleanOrigin === cleanAllowed;
    });

    if (!isAllowed) {
      throw new PrivacyViolationError(
        `[PrivateMode] Denied: URL "${url}" is not in the explicit allowlist (${allowedUrls.join(', ')}).`,
      );
    }
  }
}

/**
 * Determines whether a model is cloud-backed or proxied to external servers.
 */
export function isCloudBackedModel(modelInfo: OllamaModelInfo): boolean {
  const modelName = (modelInfo.name || modelInfo.model || '').toLowerCase();

  for (const prefix of CLOUD_MODEL_PREFIXES) {
    if (modelName.startsWith(prefix)) {
      return true;
    }
  }

  if (modelInfo.remote_host || modelInfo.details?.remote_host) {
    return true;
  }

  const parentModel = (modelInfo.parent_model || modelInfo.details?.parent_model || '').toLowerCase();
  if (parentModel.startsWith('http://') || parentModel.startsWith('https://')) {
    return true;
  }

  for (const prefix of CLOUD_MODEL_PREFIXES) {
    if (parentModel.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates that the selected model is local and not routed through cloud proxies in private mode.
 */
export function validateModelNotCloud(modelInfo: OllamaModelInfo, privateMode: boolean): void {
  if (privateMode && isCloudBackedModel(modelInfo)) {
    throw new PrivacyViolationError(
      `[PrivateMode] Denied: Cloud-backed or proxied model "${modelInfo.name}" is forbidden.`,
    );
  }
}
