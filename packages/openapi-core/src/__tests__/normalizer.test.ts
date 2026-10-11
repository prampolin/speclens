import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseOpenAPIDocument } from '../parser.js';
import { normalizeDocument, toIndexText } from '../normalizer.js';

const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('normalizeDocument', () => {
  it('normalizes OpenAPI 3.0 document with expected operation counts and fields', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'petstore-3.0.yaml'), 'utf8');
    const parsed = parseOpenAPIDocument(content);
    const operations = normalizeDocument(parsed, 'spec-petstore-3');

    // Endpoints in fixture:
    // GET /pets
    // POST /pets
    // GET /pets/{petId}
    // DELETE /pets/{petId}
    expect(operations).toHaveLength(4);

    const getPets = operations.find((op) => op.method === 'get' && op.path === '/pets');
    expect(getPets).toBeDefined();
    expect(getPets?.id).toBe('spec-petstore-3:get:/pets');
    expect(getPets?.operationId).toBe('listPets');
    expect(getPets?.tags).toEqual(['pets']);
    expect(getPets?.parameters).toHaveLength(2);
    expect(getPets?.parameters.map((p) => p.name)).toEqual(['limit', 'status']);
    expect(getPets?.sourcePointer).toBe('#/paths/~1pets/get');

    // Check path-level parameter inheritance in /pets/{petId}
    const showPet = operations.find((op) => op.method === 'get' && op.path === '/pets/{petId}');
    expect(showPet).toBeDefined();
    expect(showPet?.id).toBe('spec-petstore-3:get:/pets/{petid}');
    expect(showPet?.parameters).toHaveLength(1);
    expect(showPet?.parameters[0].name).toBe('petId');
    expect(showPet?.parameters[0].in).toBe('path');
    expect(showPet?.parameters[0].required).toBe(true);

    // POST /pets security and requestBody
    const postPet = operations.find((op) => op.method === 'post' && op.path === '/pets');
    expect(postPet).toBeDefined();
    expect(postPet?.security).toEqual([{ ApiKeyAuth: [] }]);
    expect(postPet?.requestBody?.required).toBe(true);
    expect(postPet?.requestBody?.content['application/json']?.schema).toBeDefined();

    // Snapshot structure validation
    expect(getPets).toMatchSnapshot();
  });

  it('normalizes Swagger 2.0 document converting body parameters and servers', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'petstore-2.0.yaml'), 'utf8');
    const parsed = parseOpenAPIDocument(content);
    const operations = normalizeDocument(parsed, 'spec-swagger-2');

    // GET /pets and POST /pets
    expect(operations).toHaveLength(2);

    const postPet = operations.find((op) => op.method === 'post' && op.path === '/pets');
    expect(postPet).toBeDefined();
    expect(postPet?.id).toBe('spec-swagger-2:post:/pets');
    expect(postPet?.servers.length).toBeGreaterThan(0);
    expect(postPet?.servers[0].url).toContain('petstore.swagger.io/v2');

    // Body parameter was converted to requestBody
    expect(postPet?.requestBody).toBeDefined();
    expect(postPet?.requestBody?.required).toBe(true);
    expect(postPet?.requestBody?.content['application/json']).toBeDefined();

    // Responses converted from Swagger 2.0
    expect(postPet?.responses['200']?.content?.['application/json']).toBeDefined();
  });

  it('normalizes multipart form data and composition schemas', () => {
    const content = fs.readFileSync(
      path.join(fixturesDir, 'composition-and-multipart.yaml'),
      'utf8'
    );
    const parsed = parseOpenAPIDocument(content);
    const operations = normalizeDocument(parsed, 'spec-multipart');

    expect(operations).toHaveLength(1);
    const uploadOp = operations[0];
    expect(uploadOp.method).toBe('post');
    expect(uploadOp.path).toBe('/upload');
    expect(uploadOp.requestBody?.content['multipart/form-data']).toBeDefined();
  });

  it('handles casing differences and normalizes duplicate path variants', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'duplicate-paths.yaml'), 'utf8');
    const parsed = parseOpenAPIDocument(content);
    const operations = normalizeDocument(parsed, 'spec-duplicate');

    expect(operations).toHaveLength(2);
    expect(operations[0].sourcePointer).toBe('#/paths/~1users/get');
    expect(operations[1].sourcePointer).toBe('#/paths/~1Users/get');
  });

  it('generates rich, non-empty indexText via toIndexText', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'petstore-3.0.yaml'), 'utf8');
    const parsed = parseOpenAPIDocument(content);
    const operations = normalizeDocument(parsed, 'spec-petstore-3');

    const postPet = operations.find((op) => op.method === 'post' && op.path === '/pets')!;
    const text = toIndexText(postPet);

    expect(text).toContain('POST /pets');
    expect(text).toContain('id: createPet');
    expect(text).toContain('tags: pets');
    expect(text).toContain('body fields:');
    expect(text).toContain('name');
    expect(text).toContain('responses:');
  });
});
