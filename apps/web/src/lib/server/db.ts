import {
  createDatabase,
  type Database,
  WorkspaceRepository,
  SpecificationRepository,
  OperationRepository,
  SettingsRepository,
  IngestionJobRepository,
  VectorNamespaceRepository,
} from '@speclens/db';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

let dbInstance: Database | null = null;

function ensureDefaultWorkspace(db: Database): void {
  try {
    const workspaceRepo = new WorkspaceRepository(db);
    const defaultWs = workspaceRepo.findById('default');
    if (!defaultWs) {
      workspaceRepo.create({
        id: 'default',
        title: 'Default Workspace',
      });
    }

    const settingsRepo = new SettingsRepository(db);
    settingsRepo.getOrDefault('default');
  } catch {
    // Ignore initialization if tables not ready
  }
}

export function getDatabasePath(): string {
  if (process.env.SPECLENS_DB_PATH) {
    return process.env.SPECLENS_DB_PATH;
  }
  const defaultDir = resolve(process.cwd(), '.speclens');
  if (!existsSync(defaultDir)) {
    try {
      mkdirSync(defaultDir, { recursive: true });
    } catch {
      // Ignore directory creation failure in readonly test environments
    }
  }
  return resolve(defaultDir, 'speclens.db');
}

export function getDatabase(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.NODE_ENV === 'test' && !process.env.SPECLENS_DB_PATH
    ? ':memory:'
    : getDatabasePath();

  dbInstance = createDatabase(dbPath);
  ensureDefaultWorkspace(dbInstance);

  return dbInstance;
}

export function setTestDatabase(testDb: Database | null): void {
  dbInstance = testDb;
  if (testDb) {
    ensureDefaultWorkspace(testDb);
  }
}

export function getWorkspaceRepo(): WorkspaceRepository {
  return new WorkspaceRepository(getDatabase());
}

export function getSpecificationRepo(): SpecificationRepository {
  return new SpecificationRepository(getDatabase());
}

export function getOperationRepo(): OperationRepository {
  return new OperationRepository(getDatabase());
}

export function getSettingsRepo(): SettingsRepository {
  return new SettingsRepository(getDatabase());
}

export function getIngestionJobRepo(): IngestionJobRepository {
  return new IngestionJobRepository(getDatabase());
}

export function getVectorNamespaceRepo(): VectorNamespaceRepository {
  return new VectorNamespaceRepository(getDatabase());
}
