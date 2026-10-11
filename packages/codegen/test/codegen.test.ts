import { describe, it, expect } from 'vitest';
import type { NormalizedOperation } from '@speclens/openapi-core';
import {
  buildRequestModel,
  generateCurl,
  generateFetch,
  generatePython,
  validateSnippet,
  generateSnippets,
  DeterministicCodeGenerator,
  requestModelSchema,
  codegenResultSchema,
} from '../src/index.js';

describe('Fase 08 — Codegen Determinístico', () => {
  const getOperationWithoutBody: NormalizedOperation = {
    id: 'spec-1:get:/pets',
    specId: 'spec-1',
    method: 'get',
    path: '/pets',
    tags: ['pets'],
    servers: [{ url: 'https://api.example.com' }],
    parameters: [
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer' },
      },
      {
        name: 'status',
        in: 'query',
        required: false,
        schema: { type: 'string' },
      },
    ],
    responses: {
      '200': { description: 'Success' },
    },
    sourcePointer: '#/paths/~1pets/get',
  };

  const postOperationJson: NormalizedOperation = {
    id: 'spec-1:post:/pets',
    specId: 'spec-1',
    method: 'post',
    path: '/pets',
    tags: ['pets'],
    servers: [{ url: 'https://api.example.com' }],
    parameters: [],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'age', 'isAdopted', 'tags'],
            properties: {
              name: { type: 'string' },
              age: { type: 'integer' },
              isAdopted: { type: 'boolean' },
              tags: { type: 'array' },
              note: { type: 'string' }, // optional
            },
          },
        },
      },
    },
    responses: {
      '201': { description: 'Created' },
    },
    sourcePointer: '#/paths/~1pets/post',
  };

  const postOperationMultipart: NormalizedOperation = {
    id: 'spec-1:post:/upload',
    specId: 'spec-1',
    method: 'post',
    path: '/upload',
    tags: ['files'],
    servers: [{ url: 'https://api.example.com' }],
    parameters: [],
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file', 'description'],
            properties: {
              file: { type: 'string', format: 'binary' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Uploaded' },
    },
    sourcePointer: '#/paths/~1upload/post',
  };

  const getOperationWithPathParam: NormalizedOperation = {
    id: 'spec-1:get:/pets/{id}',
    specId: 'spec-1',
    method: 'get',
    path: '/pets/{id}',
    tags: ['pets'],
    servers: [{ url: 'https://api.example.com' }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      {
        name: 'optionalFilter',
        in: 'query',
        required: false,
        schema: { type: 'string' },
      },
    ],
    responses: {
      '200': { description: 'Pet details' },
    },
    sourcePointer: '#/paths/~1pets/~1{id}/get',
  };

  const postOperationBearerAuth: NormalizedOperation = {
    id: 'spec-1:post:/secure',
    specId: 'spec-1',
    method: 'post',
    path: '/secure',
    tags: ['auth'],
    servers: [{ url: 'https://api.example.com' }],
    parameters: [],
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['data'],
            properties: {
              data: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'OK' },
    },
    sourcePointer: '#/paths/~1secure/post',
  };

  it('08.01 — constrói RequestModel válido validado por Zod schema', () => {
    const model = buildRequestModel(getOperationWithoutBody);
    expect(model.method).toBe('GET');
    expect(model.url).toBe('/pets');
    expect(model.body).toBeNull();
    expect(model.contentType).toBeNull();

    const parsed = requestModelSchema.safeParse(model);
    expect(parsed.success).toBe(true);
  });

  it('08.02 — GET sem body: cURL sem -d, fetch sem body, Python sem json/data', () => {
    const result = generateSnippets({
      operation: getOperationWithoutBody,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    expect(result.snippets).toHaveLength(3);

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    const js = result.snippets.find((s) => s.language === 'javascript')!;
    const py = result.snippets.find((s) => s.language === 'python')!;

    expect(curl.code).toContain('curl -X GET');
    expect(curl.code).not.toContain('-d');
    expect(curl.code).not.toContain('--data-urlencode');
    expect(curl.code).not.toContain('-F');

    expect(js.code).toContain("method: 'GET'");
    expect(js.code).not.toContain('body:');

    expect(py.code).toContain('requests.get');
    expect(py.code).not.toContain('json=');
    expect(py.code).not.toContain('data=');
    expect(py.code).not.toContain('files=');

    expect(curl.validated).toBe(true);
    expect(js.validated).toBe(true);
    expect(py.validated).toBe(true);
  });

  it('08.03 — POST JSON com campos obrigatórios: preenche placeholders tipados para não-groundáveis', () => {
    const result = generateSnippets({
      operation: postOperationJson,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    const model = result.requestModel;
    expect(model.body).not.toBeNull();
    expect(model.body?.example).toEqual({
      name: '<REQUIRED_name>',
      age: 0,
      isAdopted: false,
      tags: [],
    });

    // Optional field 'note' should NOT be invented
    expect(model.body?.example).not.toHaveProperty('note');

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    const js = result.snippets.find((s) => s.language === 'javascript')!;
    const py = result.snippets.find((s) => s.language === 'python')!;

    expect(curl.code).toContain('-d \'{"name":"<REQUIRED_name>","age":0,"isAdopted":false,"tags":[]}\'');
    expect(js.code).toContain('"name": "<REQUIRED_name>"');
    expect(py.code).toContain("'name': '<REQUIRED_name>'");
    expect(py.code).toContain("'isAdopted': False"); // Python boolean
  });

  it('08.03b — POST JSON com valores grounded substitui placeholders', () => {
    const result = generateSnippets({
      operation: postOperationJson,
      languages: ['curl', 'javascript', 'python'],
      groundedValues: {
        name: 'Rex',
        age: 3,
        note: 'Healthy dog', // optional field grounded explicitly
      },
      baseUrl: 'https://api.example.com',
    });

    const model = result.requestModel;
    expect(model.body?.example.name).toBe('Rex');
    expect(model.body?.example.age).toBe(3);
    expect(model.body?.example.isAdopted).toBe(false); // still placeholder
    expect(model.body?.example.note).toBe('Healthy dog');

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    expect(curl.code).toContain('"name":"Rex"');
  });

  it('08.04 — POST multipart/form-data gera -F no cURL e FormData no fetch', () => {
    const result = generateSnippets({
      operation: postOperationMultipart,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    const js = result.snippets.find((s) => s.language === 'javascript')!;
    const py = result.snippets.find((s) => s.language === 'python')!;

    // cURL should use -F
    expect(curl.code).toContain("-F 'file=<REQUIRED_file>'");
    expect(curl.code).toContain("-F 'description=<REQUIRED_description>'");
    expect(curl.code).not.toContain("-H 'Content-Type: multipart/form-data'"); // -F sets boundary

    // JS Fetch should use FormData
    expect(js.code).toContain('const formData = new FormData();');
    expect(js.code).toContain("formData.append('file', '<REQUIRED_file>');");
    expect(js.code).toContain("formData.append('description', '<REQUIRED_description>');");
    expect(js.code).toContain('body: formData');

    // Python should use files=
    expect(py.code).toContain('files = {');
    expect(py.code).toContain('files=files');
  });

  it('08.05 — path param {id} é substituído por placeholder <REQUIRED_id> quando não grounded', () => {
    const result = generateSnippets({
      operation: getOperationWithPathParam,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    expect(result.requestModel.url).toBe('/pets/<REQUIRED_id>');

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    expect(curl.code).toContain("'https://api.example.com/pets/<REQUIRED_id>'");

    const js = result.snippets.find((s) => s.language === 'javascript')!;
    expect(js.code).toContain("'https://api.example.com/pets/<REQUIRED_id>'");

    const py = result.snippets.find((s) => s.language === 'python')!;
    expect(py.code).toContain("'https://api.example.com/pets/<REQUIRED_id>'");
  });

  it('08.05b — path param {id} é substituído pelo valor quando grounded', () => {
    const result = generateSnippets({
      operation: getOperationWithPathParam,
      languages: ['curl', 'javascript', 'python'],
      groundedValues: { id: 'pet-42' },
      baseUrl: 'https://api.example.com',
    });

    expect(result.requestModel.url).toBe('/pets/pet-42');

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    expect(curl.code).toContain("'https://api.example.com/pets/pet-42'");
  });

  it('08.06 — query params opcionais são omitidos por padrão', () => {
    const result = generateSnippets({
      operation: getOperationWithPathParam,
      languages: ['curl'],
      baseUrl: 'https://api.example.com',
    });

    // optionalFilter should not be present in URL
    expect(result.requestModel.queryParams).toHaveLength(0);
    expect(result.snippets[0].code).not.toContain('optionalFilter');
  });

  it('08.06b — query params opcionais são incluídos se grounded', () => {
    const result = generateSnippets({
      operation: getOperationWithPathParam,
      languages: ['curl'],
      groundedValues: { optionalFilter: 'active' },
      baseUrl: 'https://api.example.com',
    });

    expect(result.requestModel.queryParams).toHaveLength(1);
    expect(result.requestModel.queryParams[0].name).toBe('optionalFilter');
    expect(result.requestModel.queryParams[0].value).toBe('active');
    expect(result.snippets[0].code).toContain('optionalFilter=active');
  });

  it('08.07 — auth bearer gera header Authorization: Bearer <YOUR_TOKEN>', () => {
    const result = generateSnippets({
      operation: postOperationBearerAuth,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    const model = result.requestModel;
    expect(model.auth).not.toBeNull();
    expect(model.auth?.type).toBe('bearer');
    expect(model.auth?.placeholder).toBe('<YOUR_TOKEN>');

    const curl = result.snippets.find((s) => s.language === 'curl')!;
    expect(curl.code).toContain("-H 'Authorization: Bearer <YOUR_TOKEN>'");

    const js = result.snippets.find((s) => s.language === 'javascript')!;
    expect(js.code).toContain("'Authorization': 'Bearer <YOUR_TOKEN>'");

    const py = result.snippets.find((s) => s.language === 'python')!;
    expect(py.code).toContain("'Authorization': 'Bearer <YOUR_TOKEN>'");
  });

  it('08.08 — validação: campo inventado no body gera validationWarning', () => {
    const result = generateSnippets({
      operation: postOperationJson,
      languages: ['curl'],
      groundedValues: {
        inventedField: 'hacked',
      },
      baseUrl: 'https://api.example.com',
    });

    const snippet = result.snippets[0];
    expect(snippet.validated).toBe(false);
    expect(snippet.validationWarnings.length).toBeGreaterThan(0);
    expect(snippet.validationWarnings.some((w) => w.includes('inventedField'))).toBe(true);
  });

  it('08.08b — validação: path param não declarado na rota gera warning', () => {
    const brokenOp: NormalizedOperation = {
      ...getOperationWithoutBody,
      path: '/items/{missingParam}',
      parameters: [], // missingParam not in parameters
    };

    const model = buildRequestModel(brokenOp);
    const validation = validateSnippet(model, brokenOp);

    expect(validation.valid).toBe(false);
    expect(validation.warnings.some((w) => w.includes('missingParam'))).toBe(true);
  });

  it('08.09 — snapshot determinístico: mesmo input produz exatamente o mesmo output', () => {
    const run1 = generateSnippets({
      operation: postOperationJson,
      languages: ['curl', 'javascript', 'python'],
      groundedValues: { name: 'Fido', age: 2 },
      baseUrl: 'https://api.example.com',
    });

    const run2 = generateSnippets({
      operation: postOperationJson,
      languages: ['curl', 'javascript', 'python'],
      groundedValues: { name: 'Fido', age: 2 },
      baseUrl: 'https://api.example.com',
    });

    expect(run1.snippets).toEqual(run2.snippets);
    expect(run1.requestModel).toEqual(run2.requestModel);
  });

  it('08.10 — nenhum snippet contém segredos reais (nenhuma credencial vazada)', () => {
    const result = generateSnippets({
      operation: postOperationBearerAuth,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    for (const snippet of result.snippets) {
      // Must not contain actual tokens or secrets
      expect(snippet.code).not.toMatch(/Bearer [a-zA-Z0-9_.-]{20,}/);
      expect(snippet.code).toContain('<YOUR_TOKEN>');
    }
  });

  it('08.11 — DeterministicCodeGenerator implementa interface CodeGenerator', async () => {
    const generator = new DeterministicCodeGenerator();
    const snippet = await generator.generate(getOperationWithoutBody, {
      language: 'curl',
      baseUrl: 'https://api.example.com',
    });

    expect(snippet.language).toBe('curl');
    expect(snippet.label).toBe('cURL');
    expect(snippet.validated).toBe(true);
    expect(snippet.code).toContain('curl -X GET');
  });

  it('08.12 — CodegenResult atende ao Zod schema central', () => {
    const result = generateSnippets({
      operation: postOperationJson,
      languages: ['curl', 'javascript', 'python'],
      baseUrl: 'https://api.example.com',
    });

    const parsed = codegenResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('08.13 — builders individuais (curl, fetch, python) funcionam diretamente com RequestModel', () => {
    const model = buildRequestModel(getOperationWithoutBody);
    const curl = generateCurl(model, { baseUrl: 'https://api.example.com' });
    const js = generateFetch(model, { baseUrl: 'https://api.example.com' });
    const py = generatePython(model, { baseUrl: 'https://api.example.com' });

    expect(curl).toContain('curl -X GET');
    expect(js).toContain("fetch('https://api.example.com/pets'");
    expect(py).toContain("url = 'https://api.example.com/pets'");
  });
});
