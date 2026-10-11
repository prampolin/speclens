export class SSRFViolationError extends Error {
  constructor(message: string, public readonly code: string = 'SSRF_VIOLATION') {
    super(`[SSRFViolation] ${message}`);
    this.name = 'SSRFViolationError';
    Object.setPrototypeOf(this, SSRFViolationError.prototype);
  }
}

const CLOUD_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  '169.254.169.253',
  'fd00:ec2::254',
  '100.100.100.200', // Alibaba cloud metadata
  'instance-data',
]);

/**
 * Checks whether an IPv4 address string falls into a private, loopback, or link-local range.
 */
function isDisallowedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [b0, b1] = parts;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private)
  if (b0 === 10) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (b0 === 192 && b1 === 168) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata)
  if (b0 === 169 && b1 === 254) return true;

  // 100.64.0.0/10 (Shared address space / Carrier Grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
  if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;
  if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;
  if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (b0 >= 224) return true;

  return false;
}

/**
 * Checks whether an IPv6 string is loopback, unique local (fc00::/7), or link-local (fe80::/10).
 */
function isDisallowedIpv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();

  // ::1 / :: (Loopback / unspecified)
  if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1') return true;

  // Link-local: fe80::/10
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
    return true;
  }

  // Unique local: fc00::/7 (fc.. or fd..)
  if (clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (clean.startsWith('::ffff:')) {
    const v4 = clean.substring('::ffff:'.length);
    if (isDisallowedIpv4(v4)) return true;
  }

  return false;
}

/**
 * Validates a specification import URL against SSRF and Private Mode policies.
 *
 * Rules:
 * 1. In privateMode (default), ALL remote URLs are rejected (only direct file uploads allowed).
 * 2. In any mode, blocks:
 *    - Non-HTTP(S) protocols (file:, ftp:, gopher:, dict:, etc.)
 *    - Cloud metadata addresses (169.254.169.254, metadata.google.internal, etc.)
 *    - Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *    - Loopback addresses (127.0.0.0/8, localhost, ::1)
 *    - Link-local addresses (169.254.0.0/16, fe80::/10)
 *    - Ambiguous integer / octal / hex encoded IPs
 */
export function validateImportUrl(url: string, privateMode: boolean = true): void {
  if (privateMode) {
    throw new SSRFViolationError(
      `Remote URL imports are disabled when privateMode=true. Use local file upload instead.`,
      'PRIVATE_MODE_REMOTE_URL_BLOCKED'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SSRFViolationError(`Invalid URL string: "${url}"`, 'INVALID_URL');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new SSRFViolationError(
      `Forbidden URL scheme "${parsed.protocol}". Only "http:" and "https:" are allowed.`,
      'FORBIDDEN_SCHEME'
    );
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Cloud metadata hosts
  if (CLOUD_METADATA_HOSTS.has(hostname) || hostname.endsWith('.metadata.google.internal')) {
    throw new SSRFViolationError(
      `Access to cloud metadata service at "${hostname}" is forbidden.`,
      'METADATA_ENDPOINT_BLOCKED'
    );
  }

  // Localhost & loopback aliases
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  ) {
    throw new SSRFViolationError(
      `Import from loopback / localhost host "${hostname}" is forbidden.`,
      'LOOPBACK_BLOCKED'
    );
  }

  // Check numeric IPv4 decimal (e.g., http://2130706433 or octal)
  if (/^\d+$/.test(hostname)) {
    throw new SSRFViolationError(
      `Numeric / integer IP addresses like "${hostname}" are forbidden.`,
      'NUMERIC_IP_BLOCKED'
    );
  }

  // Check IPv4 addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isDisallowedIpv4(hostname)) {
      throw new SSRFViolationError(
        `Destination IP "${hostname}" is within a restricted / private range.`,
        'PRIVATE_IP_BLOCKED'
      );
    }
  }

  // Check IPv6 addresses
  if (hostname.startsWith('[') || hostname.includes(':')) {
    if (isDisallowedIpv6(hostname)) {
      throw new SSRFViolationError(
        `Destination IPv6 "${hostname}" is within a restricted / private range.`,
        'PRIVATE_IP_BLOCKED'
      );
    }
  }
}

/**
 * Validates a redirect Location header target during remote fetching.
 */
export function validateRedirectUrl(locationUrl: string, baseUrl: string, privateMode: boolean = true): string {
  let resolved: string;
  try {
    resolved = new URL(locationUrl, baseUrl).toString();
  } catch {
    throw new SSRFViolationError(`Invalid redirect target "${locationUrl}"`, 'INVALID_REDIRECT');
  }

  validateImportUrl(resolved, privateMode);
  return resolved;
}
