import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseOpenAPIDocument, OpenAPIParseError } from '../parser.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('parseOpenAPIDocument', () => {
  it('parses valid OpenAPI 3.0 YAML document', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'petstore-3.0.yaml'), 'utf8');
    const parsed = parseOpenAPIDocument(content, { filename: 'petstore-3.0.yaml' });

    expect(parsed.dialect).toBe('openapi-3.0');
    expect(parsed.info.title).toBe('Petstore API 3.0');
    expect(parsed.info.version).toBe('1.0.0');
    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0].url).toBe('https://api.petstore.example.com/v1');
  });

  it('parses valid Swagger 2.0 YAML document and synthesizes servers', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'petstore-2.0.yaml'), 'utf8');
    const parsed = parseOpenAPIDocument(content, { filename: 'petstore-2.0.yaml' });

    expect(parsed.dialect).toBe('swagger-2.0');
    expect(parsed.info.title).toBe('Petstore Swagger 2.0');
    expect(parsed.servers.length).toBeGreaterThanOrEqual(1);
    expect(parsed.servers[0].url).toBe('https://petstore.swagger.io/v2');
  });

  it('parses valid JSON document from Buffer', () => {
    const jsonStr = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'JSON Test', version: '2.0.0' },
      paths: {},
    });
    const parsed = parseOpenAPIDocument(Buffer.from(jsonStr), { filename: 'test.json' });

    expect(parsed.dialect).toBe('openapi-3.1');
    expect(parsed.info.title).toBe('JSON Test');
  });

  it('rejects empty document with actionable error', () => {
    expect(() => parseOpenAPIDocument('', { filename: 'empty.yaml' })).toThrowError(
      OpenAPIParseError
    );
    try {
      parseOpenAPIDocument('   \n  ');
    } catch (err: any) {
      expect(err.code).toBe('EMPTY_DOCUMENT');
    }
  });

  it('rejects document exceeding size limit', () => {
    const content = 'openapi: "3.0.0"\ninfo:\n  title: T\n  version: 1';
    expect(() => parseOpenAPIDocument(content, { maxSizeBytes: 10 })).toThrowError(
      OpenAPIParseError
    );
    try {
      parseOpenAPIDocument(content, { maxSizeBytes: 10 });
    } catch (err: any) {
      expect(err.code).toBe('FILE_TOO_LARGE');
    }
  });

  it('rejects malformed YAML syntax with actionable message', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'malformed.yaml'), 'utf8');
    expect(() => parseOpenAPIDocument(content, { filename: 'malformed.yaml' })).toThrowError(
      OpenAPIParseError
    );
    try {
      parseOpenAPIDocument(content, { filename: 'malformed.yaml' });
    } catch (err: any) {
      expect(err.code).toBe('INVALID_YAML');
      expect(err.message).toContain('Failed to parse YAML');
    }
  });

  it('rejects document without openapi or swagger version', () => {
    const noVersion = 'info:\n  title: No Dialect\n  version: 1.0.0\npaths: {}';
    expect(() => parseOpenAPIDocument(noVersion)).toThrowError(OpenAPIParseError);
    try {
      parseOpenAPIDocument(noVersion);
    } catch (err: any) {
      expect(err.code).toBe('UNSUPPORTED_DIALECT');
    }
  });

  it('rejects document with missing info.title or info.version', () => {
    const missingTitle = 'openapi: "3.0.0"\ninfo:\n  version: 1.0.0\npaths: {}';
    expect(() => parseOpenAPIDocument(missingTitle)).toThrowError(OpenAPIParseError);
  });
});
