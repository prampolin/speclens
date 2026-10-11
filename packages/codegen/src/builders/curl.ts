import type { RequestModel } from '../types.js';

function buildUrl(model: RequestModel, baseUrlOption?: string): string {
  const base = baseUrlOption ?? 'https://api.example.com';
  let fullUrl: string;

  if (model.url.startsWith('http://') || model.url.startsWith('https://')) {
    fullUrl = model.url;
  } else {
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = model.url.startsWith('/') ? model.url : `/${model.url}`;
    fullUrl = `${cleanBase}${cleanPath}`;
  }

  if (model.queryParams.length > 0) {
    const queryParts = model.queryParams.map((param) => {
      const key = encodeURIComponent(param.name);
      // Keep placeholders readable (<REQUIRED_foo>), encode normal values
      const val = param.isPlaceholder ? param.value : encodeURIComponent(param.value);
      return `${key}=${val}`;
    });
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}${queryParts.join('&')}`;
  }

  return fullUrl;
}

export function generateCurl(model: RequestModel, options?: { baseUrl?: string }): string {
  const lines: string[] = [];
  const targetUrl = buildUrl(model, options?.baseUrl);

  lines.push(`curl -X ${model.method} \\`);
  lines.push(`  '${targetUrl}'`);

  // Headers: omit Content-Type for multipart since -F handles boundary automatically
  const isMultipart = model.contentType === 'multipart/form-data';
  const effectiveHeaders = model.headers.filter((h) => {
    if (isMultipart && h.name.toLowerCase() === 'content-type') {
      return false;
    }
    return true;
  });

  for (const h of effectiveHeaders) {
    // Add trailing backslash to previous line
    lines[lines.length - 1] = `${lines[lines.length - 1]} \\`;
    lines.push(`  -H '${h.name}: ${h.value}'`);
  }

  // Body
  if (model.body && model.contentType && model.method !== 'GET' && model.method !== 'HEAD') {
    if (model.contentType === 'application/json') {
      const jsonStr = JSON.stringify(model.body.example).replace(/'/g, "'\\''");
      lines[lines.length - 1] = `${lines[lines.length - 1]} \\`;
      lines.push(`  -d '${jsonStr}'`);
    } else if (model.contentType === 'application/x-www-form-urlencoded') {
      const entries = Object.entries(model.body.example);
      for (const [key, value] of entries) {
        lines[lines.length - 1] = `${lines[lines.length - 1]} \\`;
        lines.push(`  --data-urlencode '${key}=${String(value)}'`);
      }
    } else if (model.contentType === 'multipart/form-data') {
      const entries = Object.entries(model.body.example);
      for (const [key, value] of entries) {
        lines[lines.length - 1] = `${lines[lines.length - 1]} \\`;
        lines.push(`  -F '${key}=${String(value)}'`);
      }
    }
  }

  return lines.join('\n');
}
