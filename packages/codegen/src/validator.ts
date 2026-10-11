import type { NormalizedOperation } from '@speclens/openapi-core';
import type { RequestModel, ValidationResult } from './types.js';

const SUPPORTED_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
];

function extractSchemaPropertyNames(schema?: Record<string, unknown>): Set<string> | null {
  if (!schema || typeof schema !== 'object') {
    return null;
  }

  const names = new Set<string>();

  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      if (typeof sub === 'object' && sub !== null) {
        const subNames = extractSchemaPropertyNames(sub as Record<string, unknown>);
        if (subNames) {
          for (const name of subNames) names.add(name);
        }
      }
    }
  }

  if (
    (!schema.properties || Object.keys(schema.properties).length === 0) &&
    (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf))
  ) {
    const variants = (schema.oneOf ?? schema.anyOf) as unknown[];
    if (variants.length > 0 && typeof variants[0] === 'object' && variants[0] !== null) {
      const subNames = extractSchemaPropertyNames(variants[0] as Record<string, unknown>);
      if (subNames) {
        for (const name of subNames) names.add(name);
      }
    }
  }

  if (schema.properties && typeof schema.properties === 'object') {
    for (const key of Object.keys(schema.properties)) {
      names.add(key);
    }
  }

  return names;
}

export function validateSnippet(model: RequestModel, op: NormalizedOperation): ValidationResult {
  const warnings: string[] = [];

  // 1. Check path params
  const declaredPathParams = new Set(
    (op.parameters || []).filter((p) => p.in === 'path').map((p) => p.name)
  );

  const pathMatches = op.path.match(/\{([^}]+)\}/g) || [];
  for (const match of pathMatches) {
    const paramName = match.slice(1, -1);
    if (!declaredPathParams.has(paramName)) {
      warnings.push(`Path param {${paramName}} not found in parameters`);
    }
  }

  // 2. Check method match
  if (model.method.toUpperCase() !== op.method.toUpperCase()) {
    warnings.push(
      `Method "${model.method}" does not match operation method "${op.method.toUpperCase()}"`
    );
  }

  // 3. Check content-type support
  if (model.contentType && !SUPPORTED_CONTENT_TYPES.includes(model.contentType)) {
    warnings.push(`Content-Type "${model.contentType}" is not supported`);
  }

  // 4. Check body fields against schema & unknown fields
  if (model.body) {
    const validPropertyNames = extractSchemaPropertyNames(model.body.schema);

    // Check unknownFields in BodyModel
    for (const unknownField of model.body.unknownFields) {
      warnings.push(`Field "${unknownField}" in body not present in schema`);
    }

    // Check actual example fields if validPropertyNames is defined
    if (validPropertyNames && validPropertyNames.size > 0) {
      for (const field of Object.keys(model.body.example)) {
        if (!validPropertyNames.has(field) && !model.body.unknownFields.includes(field)) {
          warnings.push(`Field "${field}" in body not present in schema`);
        }
      }
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
