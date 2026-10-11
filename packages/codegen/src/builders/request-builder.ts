import type {
  NormalizedOperation,
  NormalizedParameter,
} from '@speclens/openapi-core';
import type {
  RequestModel,
  Param,
  BodyModel,
  AuthModel,
  AuthType,
} from '../types.js';

interface ExtractedSchemaInfo {
  properties: Record<string, Record<string, unknown>>;
  required: string[];
}

function extractPropertiesAndRequired(schema?: Record<string, unknown>): ExtractedSchemaInfo {
  const result: ExtractedSchemaInfo = {
    properties: {},
    required: [],
  };

  if (!schema || typeof schema !== 'object') {
    return result;
  }

  // Handle allOf: combine all sub-schemas
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      if (typeof sub === 'object' && sub !== null) {
        const subInfo = extractPropertiesAndRequired(sub as Record<string, unknown>);
        Object.assign(result.properties, subInfo.properties);
        result.required.push(...subInfo.required);
      }
    }
  }

  // Handle oneOf / anyOf if no direct properties: take the first one as representative
  if (
    (!schema.properties || Object.keys(schema.properties).length === 0) &&
    (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf))
  ) {
    const variants = (schema.oneOf ?? schema.anyOf) as unknown[];
    if (variants.length > 0 && typeof variants[0] === 'object' && variants[0] !== null) {
      const subInfo = extractPropertiesAndRequired(variants[0] as Record<string, unknown>);
      Object.assign(result.properties, subInfo.properties);
      result.required.push(...subInfo.required);
    }
  }

  // Handle direct properties
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, propVal] of Object.entries(schema.properties)) {
      if (typeof propVal === 'object' && propVal !== null) {
        result.properties[key] = propVal as Record<string, unknown>;
      } else {
        result.properties[key] = {};
      }
    }
  }

  // Handle direct required list
  if (Array.isArray(schema.required)) {
    for (const req of schema.required) {
      if (typeof req === 'string' && !result.required.includes(req)) {
        result.required.push(req);
      }
    }
  }

  return result;
}

function generatePlaceholderValue(fieldName: string, propSchema: Record<string, unknown>): unknown {
  const type = propSchema.type;
  if (type === 'integer' || type === 'number') {
    return 0;
  }
  if (type === 'boolean') {
    return false;
  }
  if (type === 'array') {
    return [];
  }
  if (type === 'object') {
    return {};
  }
  return `<REQUIRED_${fieldName}>`;
}

function resolveSecurity(op: NormalizedOperation): AuthModel | null {
  if (!op.security || op.security.length === 0) {
    return null;
  }

  const firstRequirement = op.security[0];
  if (!firstRequirement) return null;

  const schemeKeys = Object.keys(firstRequirement);
  if (schemeKeys.length === 0) return null;

  const schemeName = schemeKeys[0];
  const lower = schemeName.toLowerCase();

  let type: AuthType = 'unknown';
  let placeholder = '<YOUR_TOKEN>';
  let headerName: string | undefined;

  if (lower.includes('bearer') || lower.includes('jwt') || lower.includes('token') || lower.includes('oauth')) {
    type = 'bearer';
    placeholder = '<YOUR_TOKEN>';
  } else if (lower.includes('basic')) {
    type = 'basic';
    placeholder = '<YOUR_BASIC_AUTH>';
  } else if (lower.includes('api') || lower.includes('key')) {
    type = 'apiKey';
    placeholder = '<YOUR_API_KEY>';
    headerName = 'X-API-KEY';
  } else {
    type = 'unknown';
    placeholder = '<YOUR_TOKEN>';
  }

  return { type, placeholder, headerName };
}

export function buildRequestModel(
  op: NormalizedOperation,
  groundedOrOptions?: Record<string, unknown> | { groundedValues?: Record<string, unknown> },
): RequestModel {
  let groundedValues: Record<string, unknown> | undefined;

  if (groundedOrOptions) {
    if ('groundedValues' in groundedOrOptions) {
      groundedValues = groundedOrOptions.groundedValues;
    } else {
      groundedValues = groundedOrOptions as Record<string, unknown>;
    }
  }

  // 1. Resolve Path and Path Parameters
  let url = op.path;
  const pathParams = (op.parameters || []).filter((p) => p.in === 'path');
  const pathParamNames = new Set<string>();

  for (const param of pathParams) {
    pathParamNames.add(param.name);
    const placeholderPattern = new RegExp(`\\{${param.name}\\}`, 'g');
    if (groundedValues && groundedValues[param.name] !== undefined) {
      url = url.replace(placeholderPattern, String(groundedValues[param.name]));
    } else {
      url = url.replace(placeholderPattern, `<REQUIRED_${param.name}>`);
    }
  }

  // Replace any remaining {param} in path not explicitly listed in parameters with <REQUIRED_param>
  url = url.replace(/\{([^}]+)\}/g, (_match, name) => {
    if (groundedValues && groundedValues[name] !== undefined) {
      return String(groundedValues[name]);
    }
    return `<REQUIRED_${name}>`;
  });

  // 2. Resolve Query Parameters
  const queryParams: Param[] = [];
  const queryParamDefs = (op.parameters || []).filter((p) => p.in === 'query');

  for (const param of queryParamDefs) {
    if (groundedValues && groundedValues[param.name] !== undefined) {
      queryParams.push({
        name: param.name,
        value: String(groundedValues[param.name]),
        required: param.required,
        isPlaceholder: false,
      });
    } else if (param.required) {
      queryParams.push({
        name: param.name,
        value: `<REQUIRED_${param.name}>`,
        required: true,
        isPlaceholder: true,
      });
    }
    // Optional query params without grounded value are omitted
  }

  // 3. Resolve Headers
  const headers: Param[] = [];
  const headerParamDefs = (op.parameters || []).filter((p) => p.in === 'header');

  for (const param of headerParamDefs) {
    if (groundedValues && groundedValues[param.name] !== undefined) {
      headers.push({
        name: param.name,
        value: String(groundedValues[param.name]),
        required: param.required,
        isPlaceholder: false,
      });
    } else if (param.required) {
      headers.push({
        name: param.name,
        value: `<REQUIRED_${param.name}>`,
        required: true,
        isPlaceholder: true,
      });
    }
  }

  // 4. Resolve Body & Content-Type
  let body: BodyModel | null = null;
  let contentType: string | null = null;

  if (op.requestBody && op.requestBody.content) {
    const contentTypes = Object.keys(op.requestBody.content);
    if (contentTypes.length > 0) {
      if (contentTypes.includes('application/json')) {
        contentType = 'application/json';
      } else if (contentTypes.includes('application/x-www-form-urlencoded')) {
        contentType = 'application/x-www-form-urlencoded';
      } else if (contentTypes.includes('multipart/form-data')) {
        contentType = 'multipart/form-data';
      } else {
        contentType = contentTypes[0];
      }

      const mediaTypeObj = op.requestBody.content[contentType];
      const schema = mediaTypeObj?.schema;
      const { properties, required } = extractPropertiesAndRequired(schema);

      const example: Record<string, unknown> = {};
      const unknownFields: string[] = [];

      // Ground or placeholder required fields
      for (const reqField of required) {
        if (groundedValues && groundedValues[reqField] !== undefined) {
          example[reqField] = groundedValues[reqField];
        } else {
          const propSchema = properties[reqField] || {};
          example[reqField] = generatePlaceholderValue(reqField, propSchema);
        }
      }

      // Ground optional schema fields if provided in groundedValues
      for (const [propName] of Object.entries(properties)) {
        if (!required.includes(propName) && groundedValues && groundedValues[propName] !== undefined) {
          example[propName] = groundedValues[propName];
        }
      }

      // Check for unknown / invented fields provided in groundedValues
      if (groundedValues) {
        const knownParamNames = new Set(
          (op.parameters || []).map((p: NormalizedParameter) => p.name)
        );
        for (const [key, val] of Object.entries(groundedValues)) {
          if (!properties[key] && !knownParamNames.has(key)) {
            unknownFields.push(key);
            example[key] = val;
          }
        }
      }

      body = {
        schema,
        example,
        unknownFields,
      };
    }
  }

  // 5. Add Content-Type header if applicable
  if (contentType) {
    headers.push({
      name: 'Content-Type',
      value: contentType,
      required: true,
      isPlaceholder: false,
    });
  }

  // 6. Resolve Security / Auth
  const auth = resolveSecurity(op);
  if (auth) {
    if (auth.type === 'bearer') {
      headers.push({
        name: 'Authorization',
        value: `Bearer ${auth.placeholder}`,
        required: true,
        isPlaceholder: true,
      });
    } else if (auth.type === 'basic') {
      headers.push({
        name: 'Authorization',
        value: `Basic ${auth.placeholder}`,
        required: true,
        isPlaceholder: true,
      });
    } else if (auth.type === 'apiKey') {
      headers.push({
        name: auth.headerName ?? 'X-API-KEY',
        value: auth.placeholder,
        required: true,
        isPlaceholder: true,
      });
    } else {
      headers.push({
        name: 'Authorization',
        value: `Bearer ${auth.placeholder}`,
        required: true,
        isPlaceholder: true,
      });
    }
  }

  return {
    method: op.method.toUpperCase(),
    url,
    queryParams,
    headers,
    body,
    contentType,
    auth,
  };
}
