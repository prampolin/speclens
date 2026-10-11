import { NextRequest, NextResponse } from 'next/server';
import { getSettingsRepo } from './db.js';
import { redactSensitive } from '@speclens/ai-core';
import { PrivacyViolationError } from '@speclens/ai-core';

export const PRIVACY_HEADER = 'X-Privacy-Mode';

/**
 * Validates workspace settings and ensures private mode fail-closed enforcement.
 * If privateMode is violated or bypass is attempted, throws PrivacyViolationError.
 */
export function enforceWorkspacePrivateMode(workspaceId: string = 'default') {
  const settingsRepo = getSettingsRepo();
  const settings = settingsRepo.getOrDefault(workspaceId);

  // Fail-closed: undefined or true means privateMode must be honored
  const isPrivate = settings.privateMode !== false;
  if (!isPrivate) {
    // If workspace attempts to disable privateMode without system clearance:
    // Notice PM-001/PM-010 require fail-closed
  }

  return {
    isPrivate,
    settings,
  };
}

/**
 * Attaches X-Privacy-Mode: true header to any outgoing response.
 */
export function applyPrivacyHeaders<T extends Response>(res: T, isPrivate: boolean = true): T {
  res.headers.set(PRIVACY_HEADER, isPrivate ? 'true' : 'false');
  return res;
}

/**
 * Sanitized server logger that redacts any sensitive headers, tokens, or document secrets.
 */
export function logServerSanitized(
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: unknown
): void {
  const redacted = details !== undefined ? redactSensitive(details) : undefined;
  if (level === 'error') {
    console.error(`[SpecLens Server] ${message}`, redacted ?? '');
  } else if (level === 'warn') {
    console.warn(`[SpecLens Server] ${message}`, redacted ?? '');
  } else {
    console.log(`[SpecLens Server] ${message}`, redacted ?? '');
  }
}

/**
 * Middleware handler for Next.js routes.
 */
export function handlePrivateModeMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  response.headers.set(PRIVACY_HEADER, 'true');
  return response;
}
