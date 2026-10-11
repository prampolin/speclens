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
      const val = param.isPlaceholder ? param.value : encodeURIComponent(param.value);
      return `${key}=${val}`;
    });
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}${queryParts.join('&')}`;
  }

  return fullUrl;
}

export function generateFetch(model: RequestModel, options?: { baseUrl?: string }): string {
  const targetUrl = buildUrl(model, options?.baseUrl);
  const isMultipart = model.contentType === 'multipart/form-data';
  const hasBody = Boolean(
    model.body &&
    model.contentType &&
    model.method !== 'GET' &&
    model.method !== 'HEAD'
  );

  // Filter headers (do not set Content-Type manually when using FormData)
  const effectiveHeaders = model.headers.filter((h) => {
    if (isMultipart && h.name.toLowerCase() === 'content-type') {
      return false;
    }
    return true;
  });

  const lines: string[] = [];

  // Setup FormData if multipart
  if (hasBody && isMultipart && model.body) {
    lines.push('const formData = new FormData();');
    for (const [key, value] of Object.entries(model.body.example)) {
      lines.push(`formData.append('${key}', '${String(value)}');`);
    }
    lines.push('');
  }

  // Setup URLSearchParams if form-urlencoded
  if (hasBody && model.contentType === 'application/x-www-form-urlencoded' && model.body) {
    lines.push('const searchParams = new URLSearchParams();');
    for (const [key, value] of Object.entries(model.body.example)) {
      lines.push(`searchParams.append('${key}', '${String(value)}');`);
    }
    lines.push('');
  }

  lines.push(`const response = await fetch('${targetUrl}', {`);
  lines.push(`  method: '${model.method}',`);

  if (effectiveHeaders.length > 0) {
    lines.push('  headers: {');
    for (let i = 0; i < effectiveHeaders.length; i++) {
      const h = effectiveHeaders[i];
      const comma = i < effectiveHeaders.length - 1 ? ',' : '';
      lines.push(`    '${h.name}': '${h.value}'${comma}`);
    }
    lines.push('  }' + (hasBody ? ',' : ''));
  }

  if (hasBody && model.body) {
    if (model.contentType === 'application/json') {
      const indentedJson = JSON.stringify(model.body.example, null, 2)
        .split('\n')
        .map((line, idx) => (idx === 0 ? line : `    ${line}`))
        .join('\n');
      lines.push(`  body: JSON.stringify(${indentedJson})`);
    } else if (model.contentType === 'application/x-www-form-urlencoded') {
      lines.push('  body: searchParams');
    } else if (model.contentType === 'multipart/form-data') {
      lines.push('  body: formData');
    }
  }

  lines.push('});');
  lines.push('const data = await response.json();');

  return lines.join('\n');
}
