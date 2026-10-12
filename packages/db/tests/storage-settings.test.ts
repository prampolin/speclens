import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ZodError } from 'zod';
import {
  createDatabase,
  runMigrations,
  type Database,
  WorkspaceRepository,
  SpecificationRepository,
  OperationRepository,
  SettingsRepository,
  IngestionJobRepository,
  VectorNamespaceRepository,
  EvaluationRunRepository,
  createDefaultWorkspaceSettings,
  workspaceSettingsSchema,
} from '../src/index.js';

describe('Fase 03 — Storage & Settings (@speclens/db)', () => {
  let db: Database;
  let workspaceRepo: WorkspaceRepository;
  let specRepo: SpecificationRepository;
  let opRepo: OperationRepository;
  let settingsRepo: SettingsRepository;
  let jobRepo: IngestionJobRepository;
  let vectorRepo: VectorNamespaceRepository;
  let evalRepo: EvaluationRunRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    workspaceRepo = new WorkspaceRepository(db);
    specRepo = new SpecificationRepository(db);
    opRepo = new OperationRepository(db);
    settingsRepo = new SettingsRepository(db);
    jobRepo = new IngestionJobRepository(db);
    vectorRepo = new VectorNamespaceRepository(db);
    evalRepo = new EvaluationRunRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('03.01 & 03.02 — Client SQLite e Migrations', () => {
    it('deve aplicar pragmas foreign_keys e busy_timeout no client', () => {
      const fk = db.pragma('foreign_keys', { simple: true });
      expect(fk).toBe(1);

      const timeout = db.pragma('busy_timeout', { simple: true });
      expect(timeout).toBe(5000);
    });

    it('deve ter registrado a migration 001_initial_schema na tabela _migrations', () => {
      const rows = db.prepare('SELECT * FROM _migrations').all() as Array<{
        id: number;
        name: string;
        applied_at: string;
      }>;

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(1);
      expect(rows[0].name).toBe('001_initial_schema');
      expect(rows[0].applied_at).toBeTruthy();
    });

    it('deve ser idempotente ao rodar runMigrations novamente', () => {
      const result = runMigrations(db);
      expect(result.appliedCount).toBe(0);
      expect(result.appliedMigrations).toEqual([]);
    });
  });

  describe('03.03 & 03.05 — Workspaces, Specifications e Isolamento', () => {
    it('deve criar e listar workspaces', () => {
      const ws = workspaceRepo.create({ title: 'Workspace Alpha' });
      expect(ws.id).toBeTruthy();
      expect(ws.title).toBe('Workspace Alpha');

      const found = workspaceRepo.findById(ws.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Workspace Alpha');

      const list = workspaceRepo.list();
      expect(list.some((w) => w.id === ws.id)).toBe(true);
    });

    it('deve gerenciar especificações e suportar detecção de duplicatas por SHA-256', () => {
      const ws = workspaceRepo.create({ title: 'Workspace Spec Test' });

      const spec = specRepo.create({
        workspaceId: ws.id,
        title: 'Petstore API',
        version: '1.0.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sha256-abc123def456',
        sourceContent: 'openapi: 3.0.0...',
        isActive: true,
      });

      expect(spec.id).toBeTruthy();
      expect(spec.isActive).toBe(true);
      expect(spec.dialect).toBe('openapi_3_0');

      // Idempotência por checksum
      const duplicate = specRepo.findByChecksum(ws.id, 'sha256-abc123def456');
      expect(duplicate).not.toBeNull();
      expect(duplicate?.id).toBe(spec.id);

      // Checksum em outro workspace não deve retornar nada (isolamento)
      const otherWs = workspaceRepo.create({ title: 'Other Workspace' });
      expect(specRepo.findByChecksum(otherWs.id, 'sha256-abc123def456')).toBeNull();
    });

    it('deve alternar especificação ativa atomicamente por workspace', () => {
      const ws = workspaceRepo.create({ title: 'Active Spec Test' });

      const spec1 = specRepo.create({
        workspaceId: ws.id,
        title: 'API v1',
        version: '1.0.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sum-1',
        isActive: true,
      });

      const spec2 = specRepo.create({
        workspaceId: ws.id,
        title: 'API v2',
        version: '2.0.0',
        dialect: 'openapi_3_1',
        sourceChecksum: 'sum-2',
        isActive: false,
      });

      expect(specRepo.getActive(ws.id)?.id).toBe(spec1.id);

      specRepo.setActive(spec2.id, ws.id);

      expect(specRepo.getActive(ws.id)?.id).toBe(spec2.id);
      expect(specRepo.findById(spec1.id)?.isActive).toBe(false);
      expect(specRepo.findById(spec2.id)?.isActive).toBe(true);
    });

    it('deve limpar dados em cascata ao deletar workspace', () => {
      const ws = workspaceRepo.create({ title: 'Cascade Workspace' });

      const spec = specRepo.create({
        workspaceId: ws.id,
        title: 'API Cascade',
        version: '1.0.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sum-cascade',
      });

      const op = opRepo.create({
        specificationId: spec.id,
        method: 'GET',
        path: '/cascade-test',
        operationId: 'cascadeTest',
        tags: ['test'],
        normalizedJson: { summary: 'test' },
        sourcePointer: '#/paths/~1cascade-test/get',
        indexText: 'GET /cascade-test test',
      });

      settingsRepo.save(ws.id, createDefaultWorkspaceSettings(ws.id));
      jobRepo.create({ workspaceId: ws.id, specificationId: spec.id });
      vectorRepo.create({
        workspaceId: ws.id,
        specificationId: spec.id,
        providerId: 'transformers-local',
        modelId: 'minilm',
        revision: 'main',
        dimensions: 384,
        chunkingVersion: 'v1',
      });

      expect(opRepo.findById(op.id)).not.toBeNull();
      expect(settingsRepo.get(ws.id)).not.toBeNull();

      // Deletar workspace
      const deleted = workspaceRepo.delete(ws.id);
      expect(deleted).toBe(true);

      // Cascata limpou especificações, operações, settings, jobs e vector namespaces
      expect(specRepo.findById(spec.id)).toBeNull();
      expect(opRepo.findById(op.id)).toBeNull();
      expect(settingsRepo.get(ws.id)).toBeNull();
      expect(jobRepo.findByWorkspace(ws.id)).toHaveLength(0);
      expect(vectorRepo.listByWorkspace(ws.id)).toHaveLength(0);
    });
  });

  describe('03.04 & 03.03 — Settings e Validação Zod', () => {
    it('deve validar schema Zod exportado diretamente', () => {
      const valid = createDefaultWorkspaceSettings('ws-schema-test');
      expect(workspaceSettingsSchema.safeParse(valid).success).toBe(true);
    });

    it('deve ter privateMode=true por padrão em createDefaultWorkspaceSettings', () => {
      const defaultSettings = createDefaultWorkspaceSettings('ws-123');
      expect(defaultSettings.privateMode).toBe(true);
      expect(defaultSettings.schemaVersion).toBe(1);
      expect(defaultSettings.embedding.providerId).toBe('transformers-local');
      expect(defaultSettings.decision.providerId).toBe('laya-local');
      expect(defaultSettings.llm.providerId).toBe('ollama-local');
      expect(defaultSettings.llm.modelId).toBe('llama3.2:3b');
    });

    it('deve salvar e recuperar configurações válidas', () => {
      const ws = workspaceRepo.create({ title: 'Settings Test' });
      const settings = createDefaultWorkspaceSettings(ws.id);

      const saved = settingsRepo.save(ws.id, settings);
      expect(saved.privateMode).toBe(true);

      const loaded = settingsRepo.get(ws.id);
      expect(loaded).toEqual(settings);
    });

    it('preserva a seleção de modelo já persistida ao carregar settings', () => {
      const ws = workspaceRepo.create({ title: 'Legacy Model Test' });
      const settings = { ...createDefaultWorkspaceSettings(ws.id), llm: {
        providerId: 'ollama-local', modelId: 'llama3.2:latest',
      } };
      settingsRepo.save(ws.id, settings);
      expect(settingsRepo.get(ws.id)?.llm.modelId).toBe('llama3.2:latest');
    });

    it('deve rejeitar configurações com topK não-positivo no save e falhar fechado', () => {
      const ws = workspaceRepo.create({ title: 'Invalid Settings Test' });
      const invalid = {
        ...createDefaultWorkspaceSettings(ws.id),
        retrieval: {
          lexicalEnabled: true,
          vectorEnabled: true,
          topK: 0, // inválido (deve ser positive)
        },
      };

      expect(() => settingsRepo.save(ws.id, invalid)).toThrow(ZodError);
      expect(settingsRepo.get(ws.id)).toBeNull();
    });

    it('deve rejeitar schemaVersion diferente de 1', () => {
      const ws = workspaceRepo.create({ title: 'Version Test' });
      const invalid = {
        ...createDefaultWorkspaceSettings(ws.id),
        schemaVersion: 2,
      };

      expect(() => settingsRepo.save(ws.id, invalid)).toThrow(ZodError);
    });

    it('deve validar no startup/get e lançar erro se o JSON estiver corrompido no banco', () => {
      const ws = workspaceRepo.create({ title: 'Corrupted DB Test' });

      // Injeta JSON corrompido/inválido diretamente na tabela
      db.prepare(
        `
        INSERT INTO workspace_settings (workspace_id, schema_version, settings_json, changed_at, updated_at)
        VALUES (?, 1, ?, ?, ?)
      `
      ).run(
        ws.id,
        JSON.stringify({ schemaVersion: 1, workspaceId: ws.id, privateMode: 'NOT_A_BOOLEAN' }),
        new Date().toISOString(),
        new Date().toISOString()
      );

      // get() deve validar contra o schema e falhar fechado
      expect(() => settingsRepo.get(ws.id)).toThrow(ZodError);
    });
  });

  describe('03.05 & 03.06 — Operações e Busca FTS5', () => {
    it('deve indexar operações automaticamente no FTS5 e buscar por termos parciais e método', () => {
      const ws = workspaceRepo.create({ title: 'FTS Test Workspace' });
      const spec = specRepo.create({
        workspaceId: ws.id,
        title: 'Catalog API',
        version: '1.0.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sum-fts',
      });

      opRepo.createBatch([
        {
          specificationId: spec.id,
          method: 'POST',
          path: '/v1/catalog/items',
          operationId: 'createCatalogItem',
          tags: ['catalog', 'items'],
          normalizedJson: { summary: 'Cadastra item no catálogo com desconto' },
          sourcePointer: '#/paths/~1v1~1catalog~1items/post',
          indexText: 'POST /v1/catalog/items createCatalogItem Cadastra item no catálogo com desconto catalog items',
        },
        {
          specificationId: spec.id,
          method: 'GET',
          path: '/v1/catalog/items',
          operationId: 'listCatalogItems',
          tags: ['catalog'],
          normalizedJson: { summary: 'Lista itens do catálogo' },
          sourcePointer: '#/paths/~1v1~1catalog~1items/get',
          indexText: 'GET /v1/catalog/items listCatalogItems Lista itens do catálogo catalog',
        },
        {
          specificationId: spec.id,
          method: 'DELETE',
          path: '/v1/users/{id}',
          operationId: 'deleteUser',
          tags: ['users'],
          normalizedJson: { summary: 'Remove usuário' },
          sourcePointer: '#/paths/~1v1~1users~1{id}/delete',
          indexText: 'DELETE /v1/users/{id} deleteUser Remove usuário users',
        },
      ]);

      // Busca por "cadastra item"
      const searchCadastra = opRepo.fullTextSearch('cadastra item', { workspaceId: ws.id });
      expect(searchCadastra.length).toBeGreaterThan(0);
      expect(searchCadastra[0].operation.operationId).toBe('createCatalogItem');

      // Busca por path parcial "catalog items"
      const searchPath = opRepo.fullTextSearch('catalog items', { workspaceId: ws.id });
      expect(searchPath.length).toBe(2);

      // Busca por termo de outro endpoint "usuário"
      const searchUser = opRepo.fullTextSearch('usuário', { workspaceId: ws.id });
      expect(searchUser.length).toBe(1);
      expect(searchUser[0].operation.path).toBe('/v1/users/{id}');
    });

    it('deve garantir isolamento de busca FTS entre workspaces', () => {
      const wsA = workspaceRepo.create({ title: 'Workspace A' });
      const specA = specRepo.create({
        workspaceId: wsA.id,
        title: 'API A',
        version: '1.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sum-a',
      });

      const wsB = workspaceRepo.create({ title: 'Workspace B' });
      const specB = specRepo.create({
        workspaceId: wsB.id,
        title: 'API B',
        version: '1.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sum-b',
      });

      opRepo.create({
        specificationId: specA.id,
        method: 'POST',
        path: '/secret-finance',
        operationId: 'postFinance',
        tags: ['finance'],
        normalizedJson: {},
        sourcePointer: '#/paths/~1secret-finance/post',
        indexText: 'POST /secret-finance postFinance dados financeiros confidenciais',
      });

      opRepo.create({
        specificationId: specB.id,
        method: 'GET',
        path: '/public-feed',
        operationId: 'getFeed',
        tags: ['feed'],
        normalizedJson: {},
        sourcePointer: '#/paths/~1public-feed/get',
        indexText: 'GET /public-feed getFeed feed público',
      });

      // Busca por "financeiros" no Workspace B deve retornar vazio
      const hitsB = opRepo.fullTextSearch('financeiros', { workspaceId: wsB.id });
      expect(hitsB).toHaveLength(0);

      // Busca no Workspace A deve retornar a operação
      const hitsA = opRepo.fullTextSearch('financeiros', { workspaceId: wsA.id });
      expect(hitsA).toHaveLength(1);
      expect(hitsA[0].operation.path).toBe('/secret-finance');
    });

    it('deve atualizar e deletar sincronizando com FTS5 através dos triggers', () => {
      const ws = workspaceRepo.create({ title: 'Trigger Test' });
      const spec = specRepo.create({
        workspaceId: ws.id,
        title: 'API',
        version: '1.0',
        dialect: 'openapi_3_0',
        sourceChecksum: 'sum-trigger',
      });

      const op = opRepo.create({
        specificationId: spec.id,
        method: 'GET',
        path: '/initial-endpoint',
        operationId: 'initialOp',
        tags: ['initial'],
        normalizedJson: {},
        sourcePointer: '#/paths/~1initial-endpoint/get',
        indexText: 'GET /initial-endpoint initialOp busca inicial',
      });

      expect(opRepo.fullTextSearch('inicial', { workspaceId: ws.id })).toHaveLength(1);

      // Deletar operação
      opRepo.delete(op.id);

      // FTS5 deve estar vazio
      expect(opRepo.fullTextSearch('inicial', { workspaceId: ws.id })).toHaveLength(0);
    });
  });

  describe('Persistência em Disco e Simulação de Reinício', () => {
    it('deve salvar dados em arquivo SQLite e recuperá-los intactos após fechar e reabrir conexão', () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'speclens-test-'));
      const dbPath = join(tempDir, 'speclens.db');

      try {
        // Sessão 1: Gravação
        const diskDb = createDatabase(dbPath);
        const diskWsRepo = new WorkspaceRepository(diskDb);
        const diskSpecRepo = new SpecificationRepository(diskDb);
        const diskOpRepo = new OperationRepository(diskDb);
        const diskSettingsRepo = new SettingsRepository(diskDb);

        const ws = diskWsRepo.create({ title: 'Persistent Workspace' });
        const spec = diskSpecRepo.create({
          workspaceId: ws.id,
          title: 'Persistent API',
          version: '1.0.0',
          dialect: 'openapi_3_0',
          sourceChecksum: 'persist-123',
          isActive: true,
        });

        diskOpRepo.create({
          specificationId: spec.id,
          method: 'GET',
          path: '/persistent-items',
          operationId: 'getPersistentItems',
          tags: ['persistent'],
          normalizedJson: { desc: 'persistente' },
          sourcePointer: '#/paths/~1persistent-items/get',
          indexText: 'GET /persistent-items getPersistentItems consulta persistente',
        });

        const settings = createDefaultWorkspaceSettings(ws.id);
        diskSettingsRepo.save(ws.id, settings);

        diskDb.close();

        // Sessão 2: Reinício do processo — reabertura da conexão
        const reopenedDb = createDatabase(dbPath);
        const reopenedWsRepo = new WorkspaceRepository(reopenedDb);
        const reopenedSpecRepo = new SpecificationRepository(reopenedDb);
        const reopenedOpRepo = new OperationRepository(reopenedDb);
        const reopenedSettingsRepo = new SettingsRepository(reopenedDb);

        const loadedWs = reopenedWsRepo.findById(ws.id);
        expect(loadedWs).not.toBeNull();
        expect(loadedWs?.title).toBe('Persistent Workspace');

        const loadedSpec = reopenedSpecRepo.getActive(ws.id);
        expect(loadedSpec).not.toBeNull();
        expect(loadedSpec?.title).toBe('Persistent API');

        const searchResult = reopenedOpRepo.fullTextSearch('persistente', { workspaceId: ws.id });
        expect(searchResult).toHaveLength(1);
        expect(searchResult[0].operation.path).toBe('/persistent-items');

        const loadedSettings = reopenedSettingsRepo.get(ws.id);
        expect(loadedSettings).not.toBeNull();
        expect(loadedSettings?.privateMode).toBe(true);

        reopenedDb.close();
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Ingestion Jobs e Evaluation Runs', () => {
    it('deve gerenciar estado do IngestionJob com progresso e avisos', () => {
      const ws = workspaceRepo.create({ title: 'Job Workspace' });
      const job = jobRepo.create({
        workspaceId: ws.id,
        status: 'pending',
        progress: 0,
      });

      expect(job.status).toBe('pending');
      expect(job.progress).toBe(0);

      const runningJob = jobRepo.updateState(job.id, {
        status: 'processing',
        progress: 50,
      });
      expect(runningJob?.status).toBe('processing');
      expect(runningJob?.progress).toBe(50);

      const completedJob = jobRepo.updateState(job.id, {
        status: 'completed',
        progress: 100,
        warnings: ['Warning: Deprecated parameter'],
      });
      expect(completedJob?.status).toBe('completed');
      expect(completedJob?.progress).toBe(100);
      expect(completedJob?.warnings).toContain('Warning: Deprecated parameter');
    });

    it('deve criar e listar Evaluation Runs', () => {
      const run = evalRepo.create({
        datasetVersion: 'v1.0.0',
        configSnapshotJson: { model: 'laya' },
        metricsJson: { accuracy: 0.95 },
      });

      expect(run.id).toBeTruthy();
      expect(run.datasetVersion).toBe('v1.0.0');

      const list = evalRepo.list();
      expect(list.some((r) => r.id === run.id)).toBe(true);
    });
  });
});
