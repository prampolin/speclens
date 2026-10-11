import type { RequestModel } from '../types.js';

function toPythonLiteral(val: unknown, indentLevel = 0): string {
  const indent = ' '.repeat(indentLevel * 4);
  const nextIndent = ' '.repeat((indentLevel + 1) * 4);

  if (val === null || val === undefined) {
    return 'None';
  }
  if (typeof val === 'boolean') {
    return val ? 'True' : 'False';
  }
  if (typeof val === 'number') {
    return String(val);
  }
  if (typeof val === 'string') {
    const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const items = val.map((item) => `${nextIndent}${toPythonLiteral(item, indentLevel + 1)}`).join(',\n');
    return `[\n${items},\n${indent}]`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const escapedK = k.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `${nextIndent}'${escapedK}': ${toPythonLiteral(v, indentLevel + 1)}`;
    });
    return `{\n${lines.join(',\n')},\n${indent}}`;
  }

  return `'${String(val)}'`;
}

function buildBaseUrl(model: RequestModel, baseUrlOption?: string): string {
  const base = baseUrlOption ?? 'https://api.example.com';
  if (model.url.startsWith('http://') || model.url.startsWith('https://')) {
    return model.url;
  }
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = model.url.startsWith('/') ? model.url : `/${model.url}`;
  return `${cleanBase}${cleanPath}`;
}

export function generatePython(model: RequestModel, options?: { baseUrl?: string }): string {
  const targetUrl = buildBaseUrl(model, options?.baseUrl);
  const isMultipart = model.contentType === 'multipart/form-data';
  const hasBody = Boolean(
    model.body &&
    model.contentType &&
    model.method !== 'GET' &&
    model.method !== 'HEAD'
  );

  const effectiveHeaders = model.headers.filter((h) => {
    if (isMultipart && h.name.toLowerCase() === 'content-type') {
      return false;
    }
    return true;
  });

  const lines: string[] = ['import requests', ''];
  lines.push(`url = '${targetUrl}'`);

  const callArgs: string[] = ['url'];

  if (effectiveHeaders.length > 0) {
    const headerDict: Record<string, string> = {};
    for (const h of effectiveHeaders) {
      headerDict[h.name] = h.value;
    }
    lines.push(`headers = ${toPythonLiteral(headerDict)}`);
    callArgs.push('headers=headers');
  }

  if (model.queryParams.length > 0) {
    const paramDict: Record<string, unknown> = {};
    for (const q of model.queryParams) {
      // try to parse number or boolean if numeric/bool
      if (q.value === 'true') paramDict[q.name] = true;
      else if (q.value === 'false') paramDict[q.name] = false;
      else if (!isNaN(Number(q.value)) && !q.value.startsWith('<') && q.value.trim() !== '') {
        paramDict[q.name] = Number(q.value);
      } else {
        paramDict[q.name] = q.value;
      }
    }
    lines.push(`params = ${toPythonLiteral(paramDict)}`);
    callArgs.push('params=params');
  }

  if (hasBody && model.body) {
    if (model.contentType === 'application/json') {
      lines.push(`payload = ${toPythonLiteral(model.body.example)}`);
      callArgs.push('json=payload');
    } else if (model.contentType === 'application/x-www-form-urlencoded') {
      lines.push(`data = ${toPythonLiteral(model.body.example)}`);
      callArgs.push('data=data');
    } else if (model.contentType === 'multipart/form-data') {
      // Multipart format in requests: (None, 'value') for fields
      const filesObj: Record<string, [null, unknown]> = {};
      for (const [k, v] of Object.entries(model.body.example)) {
        filesObj[k] = [null, v];
      }
      lines.push(`files = ${toPythonLiteral(filesObj)}`);
      callArgs.push('files=files');
    }
  }

  lines.push('');
  const method = model.method.toLowerCase();
  lines.push(`response = requests.${method}(${callArgs.join(', ')})`);
  lines.push('print(response.json())');

  return lines.join('\n');
}
